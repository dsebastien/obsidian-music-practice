import { describe, expect, it } from 'bun:test'
import {
    applyActivityTime,
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
            time_spent: 999,
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
        const fm: Record<string, unknown> = { time_spent: 60, time_entries: [old] }
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
        const fm: Record<string, unknown> = { time_spent: 41, time_entries: [other, timer] }
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
