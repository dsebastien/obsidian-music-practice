import { describe, expect, it } from 'bun:test'
import {
    MANUAL_ADJUSTMENT,
    applyActivityTime,
    createdDayStart,
    manualAdjustment,
    isSessionNote,
    linkedSessionOf,
    planActivityTime,
    sessionMinutes,
    wikilinkPath
} from './activity-time'
import type { LinkedSession } from './activity-time'
import { createDefaultFieldNames } from './fields'

const fields = createDefaultFieldNames()
const SESSION = 'Sessions/2026-11-03 (Guitar Practice Session).md'
const resolve = (link: string) => (link === '2026-11-03 (Guitar Practice Session)' ? SESSION : null)
const entry = (start: string, end: string, description = 'Timer') => ({
    startTime: start,
    endTime: end,
    description
})

describe('activity time: reading notes', () => {
    it('reads exactly one wikilink', () => {
        expect(wikilinkPath('[[Learn Guitar]]')).toBe('Learn Guitar')
        expect(wikilinkPath(' [[Learn Guitar#Log|LG]] ')).toBe('Learn Guitar')
        expect(wikilinkPath('Learn Guitar')).toBeNull()
        expect(wikilinkPath('[[A]] and [[B]]')).toBeNull()
        expect(wikilinkPath(null)).toBeNull()
    })

    it('marks session notes by type/session or a child tag, any case', () => {
        expect(isSessionNote({ tags: ['type/session/music/guitar'] })).toBe(true)
        expect(isSessionNote({ tags: '#Type/Session, other' })).toBe(true)
        expect(isSessionNote({ tag: 'type/session' })).toBe(true)
        expect(isSessionNote({ tags: ['type/sessions'] })).toBe(false)
        expect(isSessionNote({})).toBe(false)
    })

    it('rounds minutes and ignores what is not a number', () => {
        expect(sessionMinutes(29.6)).toBe(30)
        expect(sessionMinutes(' 12.4 ')).toBe(12)
        expect(sessionMinutes('1h')).toBe(0)
        expect(sessionMinutes(undefined)).toBe(0)
    })

    it('counts a session that links to the activity, once', () => {
        const fm = {
            tags: ['type/session/music/guitar'],
            related_activities: ['[[Learn Guitar]]', '[[Learn Guitar|again]]', 'Learn Guitar'],
            time_spent: 30,
            date: '2026-11-03'
        }
        const to = (link: string) => link === 'Learn Guitar'
        expect(linkedSessionOf(fm, fields, to)).toEqual({ minutes: 30, date: '2026-11-03' })
        expect(
            linkedSessionOf({ ...fm, related_activities: 'Learn Guitar' }, fields, to)
        ).toBeNull()
        expect(linkedSessionOf({ ...fm, tags: ['type/music/guitar/chord'] }, fields, to)).toBeNull()
    })
})

describe('activity time: recompute', () => {
    const linked = new Map<string, LinkedSession>([[SESSION, { minutes: 30, date: '2026-11-03' }]])

    it('stores entries plus linked sessions, never adds to the stored value', () => {
        const fm: Record<string, unknown> = {
            time_spent: 20,
            time_entries: [entry('2026-11-01T10:00:00', '2026-11-01T10:20:00')]
        }
        const plan = planActivityTime(fm, fields, linked, resolve)!
        expect(plan.minutes).toBe(50)
        expect(plan.lastSession).toBe('2026-11-03')
        applyActivityTime(fm, plan, fields)
        expect(fm).toEqual({
            time_spent: 50,
            time_entries: [entry('2026-11-01T10:00:00', '2026-11-01T10:20:00')],
            date_last_session: '2026-11-03'
        })
        // Running it again changes nothing.
        expect(planActivityTime(fm, fields, linked, resolve)!.changed).toBe(false)
    })

    it('skips an entry that links to a counted session (the old one-entry-per-log writes)', () => {
        const old = entry(
            '2026-11-03T18:00:00',
            '2026-11-03T18:30:00',
            '[[2026-11-03 (Guitar Practice Session)]]'
        )
        const fm: Record<string, unknown> = { time_spent: 30, time_entries: [old] }
        const plan = planActivityTime(fm, fields, linked, resolve)!
        expect(plan.minutes).toBe(30)
        expect(plan.entries).toEqual([old])
        // When the session has no minutes, its entry counts.
        const none = new Map<string, LinkedSession>([[SESSION, { minutes: 0, date: '2026-11-03' }]])
        expect(planActivityTime(fm, fields, none, resolve)!.minutes).toBe(30)
    })

    it("removes an adopted timer's entry: the session holds that time", () => {
        const start = new Date('2026-11-03T18:00:00').getTime()
        const timer = entry('2026-11-03T18:00:20', '2026-11-03T18:31:00')
        const other = entry('2026-10-30T09:00:00', '2026-10-30T09:10:00')
        const fm: Record<string, unknown> = { time_spent: 40, time_entries: [other, timer] }
        const plan = planActivityTime(fm, fields, linked, resolve, start)!
        expect(plan.adoptedFound).toBe(true)
        expect(plan.removed).toBe(1)
        expect(plan.minutes).toBe(40)
        applyActivityTime(fm, plan, fields)
        expect(fm['time_entries']).toEqual([other])
        expect(fm['time_spent']).toBe(40)
        // Not found: nothing removed.
        const missing = planActivityTime({ time_entries: [other] }, fields, linked, resolve, start)!
        expect(missing.adoptedFound).toBe(false)
        expect(missing.entries).toEqual([other])
    })

    it('rounds each entry up to a minute and dates it by its end', () => {
        const fm: Record<string, unknown> = {
            time_entries: [
                entry('2026-11-02T23:59:50', '2026-11-03T00:00:10'),
                entry('2026-11-04T10:00:00', '2026-11-04T09:00:00'),
                'legacy text',
                null
            ]
        }
        const plan = planActivityTime(fm, fields, new Map(), resolve)!
        expect(plan.minutes).toBe(1)
        expect(plan.lastSession).toBe('2026-11-04')
        expect(plan.entries).toHaveLength(4)
    })

    it('leaves the duration alone when nothing counts, and a non-list of entries untouched', () => {
        const fm: Record<string, unknown> = { time_spent: 15 }
        const plan = planActivityTime(fm, fields, new Map(), resolve)!
        expect(plan.minutes).toBeNull()
        expect(plan.changed).toBe(false)
        expect(planActivityTime({ time_entries: 'oops' }, fields, linked, resolve)).toBeNull()
    })

    it('keeps the key as the note spells it', () => {
        const fm: Record<string, unknown> = { Time_Spent: 10 }
        applyActivityTime(fm, planActivityTime(fm, fields, linked, resolve)!, fields)
        expect(fm).toEqual({ Time_Spent: 30, date_last_session: '2026-11-03' })
    })
})

describe('activity time: never lowered on its own', () => {
    const linked = new Map<string, LinkedSession>([[SESSION, { minutes: 30, date: '2026-11-03' }]])
    const timer = entry('2026-11-01T10:00:00', '2026-11-01T10:20:00')

    it('leaves a stored total above the computed one as it is, and reports it', () => {
        const fm: Record<string, unknown> = { time_spent: 120, time_entries: [timer] }
        const plan = planActivityTime(fm, fields, linked, resolve)!
        expect(plan.decision).toEqual({ stored: 120, computed: 50, difference: 70 })
        expect(plan.minutes).toBeNull()
        // The last session date is still written.
        expect(plan.changed).toBe(true)
        applyActivityTime(fm, plan, fields)
        expect(fm).toEqual({
            time_spent: 120,
            time_entries: [timer],
            date_last_session: '2026-11-03'
        })
    })

    it('reads a stored total written as text, rounded', () => {
        const plan = planActivityTime({ time_spent: '50.4' }, fields, linked, resolve)!
        expect(plan.decision).toEqual({ stored: 50, computed: 30, difference: 20 })
        expect(planActivityTime({ time_spent: '1h' }, fields, linked, resolve)!.decision).toBeNull()
        expect(planActivityTime({ time_spent: '' }, fields, linked, resolve)!.minutes).toBe(30)
    })

    it('raises a lower stored total, and reports nothing when nothing counts', () => {
        expect(planActivityTime({ time_spent: 10 }, fields, linked, resolve)!.minutes).toBe(30)
        const none = planActivityTime({ time_spent: 99 }, fields, new Map(), resolve)!
        expect([none.minutes, none.decision]).toEqual([null, null])
    })

    it('drops the difference when the user says so', () => {
        const fm: Record<string, unknown> = { time_spent: 120, time_entries: [timer] }
        const plan = planActivityTime(fm, fields, linked, resolve, null, 'drop')!
        expect([plan.minutes, plan.decision, plan.adjusted]).toEqual([50, null, 0])
        applyActivityTime(fm, plan, fields)
        expect(fm['time_spent']).toBe(50)
        expect(fm['time_entries']).toEqual([timer])
    })

    it('keeps the difference as a "Manual adjustment" entry on the created day', () => {
        const fm: Record<string, unknown> = {
            created: '2026-09-15T14:22:00',
            time_spent: 120,
            time_entries: [timer]
        }
        const now = new Date('2026-11-04T09:30:00').getTime()
        const plan = planActivityTime(fm, fields, linked, resolve, null, 'keep', now)!
        expect([plan.minutes, plan.decision, plan.adjusted]).toEqual([120, null, 70])
        applyActivityTime(fm, plan, fields)
        expect(fm['time_entries']).toEqual([
            timer,
            {
                startTime: '2026-09-15T00:00:00',
                endTime: '2026-09-15T01:10:00',
                description: MANUAL_ADJUSTMENT
            }
        ])
        expect(fm['time_spent']).toBe(120)
        // Settled: running it again changes nothing and asks nothing.
        const again = planActivityTime(fm, fields, linked, resolve)!
        expect([again.changed, again.decision, again.minutes]).toEqual([false, null, 120])
    })

    it('never ends the adjustment in the future (created today, or a created date ahead)', () => {
        const now = new Date('2026-11-04T01:00:00').getTime()
        // 300 minutes don't fit since midnight: the entry ends now.
        expect(manualAdjustment('2026-11-04T00:30:00', null, 300, now)).toEqual({
            startTime: '2026-11-03T20:00:00',
            endTime: '2026-11-04T01:00:00',
            description: MANUAL_ADJUSTMENT
        })
        expect(manualAdjustment('2027-01-01', null, 30, now)).toMatchObject({
            startTime: '2026-11-04T00:30:00',
            endTime: '2026-11-04T01:00:00'
        })
    })

    it("without created: midnight of the file's creation day, else of today", () => {
        const now = new Date('2026-11-04T09:30:00').getTime()
        const ctime = new Date('2026-08-20T16:45:00').getTime()
        expect(manualAdjustment(undefined, ctime, 15, now)).toMatchObject({
            startTime: '2026-08-20T00:00:00',
            endTime: '2026-08-20T00:15:00'
        })
        expect(manualAdjustment('soon', null, 15, now).startTime).toBe('2026-11-04T00:00:00')
        expect(createdDayStart('2026-09-15', now)).toBe(new Date('2026-09-15T00:00:00').getTime())
    })
})
