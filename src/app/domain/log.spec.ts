import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import {
    applyItemUpdate,
    holdsLog,
    itemUpdate,
    sessionFileName,
    sessionTitle,
    splitMinutes,
    freshItem,
    validateLogRequest
} from './log'
import type { LearningType } from './note-model'
import { computeItems } from './practice'
import { input } from './practice.spec'
import { createDefaultRules } from './rules'

const fields = createDefaultFieldNames()
const rules = createDefaultRules()
const VALUES = [
    '10 - Want to learn',
    '20 - Learning',
    '30 - Can play slowly',
    '40 - Can play at tempo',
    '50 - Rusty',
    '60 - Mastered'
]
const type: LearningType = {
    id: 'gc',
    name: 'Guitar Chords',
    typeTag: 'type/music/guitar/chord',
    domain: 'music',
    subject: 'guitar',
    kind: 'chord',
    tags: ['type/music/guitar/chord'],
    statusProperty: 'mastery',
    statusValues: VALUES,
    stamps: { '20 - Learning': 'date_started', '60 - Mastered': 'date_mastered' },
    fields: new Set([
        'mastery',
        'date_last_practiced',
        'bpm_current',
        'bpm_target',
        'time_spent',
        'last_reviewed',
        'review_interval',
        'review_count',
        'date_started',
        'date_mastered'
    ]),
    topPriority: 10,
    templatePath: null,
    allowedValues: {}
}
const DATE = '2026-10-28'
const ctx = (over = {}) => ({
    date: DATE,
    fields,
    rules,
    stampDates: false,
    current: {},
    ...over
})
const item = (over = {}) => computeItems([input('E', over)], DATE, rules)[0]!

describe('itemUpdate', () => {
    it('sets last practiced and adds no minutes (they come from the session notes)', () => {
        expect(itemUpdate(item(), type, { path: 'E.md' }, ctx())).toEqual({
            set: { date_last_practiced: DATE }
        })
    })

    it('writes BPM only when the item has a target', () => {
        expect(itemUpdate(item(), type, { path: 'E.md', bpm: 80 }, ctx()).set).not.toHaveProperty(
            'bpm_current'
        )
        expect(
            itemUpdate(item({ bpmTarget: 100 }), type, { path: 'E.md', bpm: 80 }, ctx()).set
        ).toMatchObject({ bpm_current: 80 })
    })

    it("writes a new level as the type's label and starts reviews at 30", () => {
        expect(itemUpdate(item(), type, { path: 'E.md', level: 30 }, ctx()).set).toMatchObject({
            mastery: '30 - Can play slowly',
            review_interval: 3
        })
    })

    it('applies a review result, failed dropping Mastered to Rusty', () => {
        const mastered = item({ level: 60, reviewInterval: 12, reviewCount: 4 })
        expect(itemUpdate(mastered, type, { path: 'E.md', review: 'failed' }, ctx()).set).toEqual({
            date_last_practiced: DATE,
            last_reviewed: DATE,
            review_count: 5,
            review_interval: 3,
            mastery: '50 - Rusty'
        })
        expect(
            itemUpdate(mastered, type, { path: 'E.md', review: 'good' }, ctx()).set
        ).toMatchObject({ review_interval: 24 })
    })

    it('stamps dates only when asked to and only when empty', () => {
        const wish = item({ level: 10 })
        expect(itemUpdate(wish, type, { path: 'E.md', level: 20 }, ctx()).set).not.toHaveProperty(
            'date_started'
        )
        expect(
            itemUpdate(wish, type, { path: 'E.md', level: 20 }, ctx({ stampDates: true })).set
        ).toMatchObject({ date_started: DATE })
        expect(
            itemUpdate(
                wish,
                type,
                { path: 'E.md', level: 20 },
                ctx({ stampDates: true, current: { date_started: '2026-01-01' } })
            ).set
        ).not.toHaveProperty('date_started')
    })

    it('refuses a level the type has no value for', () => {
        expect(() => itemUpdate(item(), type, { path: 'E.md', level: 35 }, ctx())).toThrow()
    })
})

describe('applyItemUpdate', () => {
    it('never moves the last practiced date back and never adds minutes', () => {
        const fm: Record<string, unknown> = { date_last_practiced: '2026-10-30', time_spent: 15 }
        applyItemUpdate(fm, { set: { date_last_practiced: DATE } }, fields)
        expect(fm).toEqual({ date_last_practiced: '2026-10-30', time_spent: 15 })
    })
})

describe('session naming', () => {
    it('puts the focus after the date and sanitizes it', () => {
        expect(sessionTitle(DATE)).toBe(DATE)
        expect(sessionTitle(DATE, ' Barre chords / F#  ')).toBe(`${DATE} Barre chords F`)
    })

    it('numbers further sessions before the suffix', () => {
        const affixes = { prefix: '', suffix: ' (Guitar Practice Session)' }
        expect(sessionFileName(DATE, 1, affixes)).toBe(`${DATE} (Guitar Practice Session).md`)
        expect(sessionFileName(DATE, 2, affixes)).toBe(`${DATE} 2 (Guitar Practice Session).md`)
    })

    it('splits the minutes between items, adding up to the total', () => {
        expect(splitMinutes(30, 3)).toEqual([10, 10, 10])
        expect(splitMinutes(20, 3)).toEqual([7, 7, 6])
        expect(splitMinutes(30, 0)).toEqual([])
    })
})

describe('robust writes', () => {
    it('never moves review dates back (an older review leaves the counters alone)', () => {
        const fm: Record<string, unknown> = {
            time_spent: '1h',
            last_reviewed: '2026-11-01',
            review_count: 4
        }
        applyItemUpdate(
            fm,
            { set: { last_reviewed: DATE, review_count: 5, review_interval: 6 } },
            fields
        )
        expect(fm).toEqual({ time_spent: '1h', last_reviewed: '2026-11-01', review_count: 4 })
    })

    it('reads the item from the frontmatter being written', () => {
        const stale = item({ level: 20, reviewCount: 1, reviewInterval: 3 })
        const fresh = freshItem(
            stale,
            type,
            { mastery: '40 - Can play at tempo', review_count: 2, review_interval: '6' },
            fields
        )
        expect([fresh.level, fresh.reviewCount, fresh.reviewInterval]).toEqual([40, 2, 6])
    })
})

describe('validateLogRequest', () => {
    const ok = { date: DATE, minutes: 20, items: [{ path: 'E.md' }] }
    it('accepts a valid request', () => {
        expect(validateLogRequest(ok)).toBeNull()
    })
    it('rejects bad dates, minutes, times, items and values', () => {
        expect(validateLogRequest({ ...ok, date: '28/10/2026' })).toMatch(/date/)
        expect(validateLogRequest({ ...ok, minutes: Infinity })).toMatch(/Minutes/)
        expect(validateLogRequest({ ...ok, minutes: 2.5 })).toMatch(/Minutes/)
        expect(validateLogRequest({ ...ok, startTime: '25:00' })).toMatch(/start time/)
        expect(validateLogRequest({ ...ok, items: [] })).toMatch(/at least one/)
        expect(validateLogRequest({ ...ok, items: [{ path: 'E.md' }, { path: 'E.md' }] })).toMatch(
            /twice/
        )
        expect(validateLogRequest({ ...ok, items: [{ path: 'E.md', bpm: -3 }] })).toMatch(/BPM/)
        expect(
            validateLogRequest({ ...ok, items: [{ path: 'E.md', review: 'great' as never }] })
        ).toMatch(/review/)
        expect(validateLogRequest({ ...ok, activity: '  ' })).toMatch(/activity/)
        expect(validateLogRequest({ ...ok, activity: 3 as never })).toMatch(/activity/)
    })
    it('takes an activity name, or null for none', () => {
        expect(validateLogRequest({ ...ok, activity: 'Learn Guitar' })).toBeNull()
        expect(validateLogRequest({ ...ok, activity: null })).toBeNull()
    })
})

describe('holdsLog: a run again of the same log', () => {
    const session = {
        date: DATE,
        time_spent: 30,
        start_time: '18:30',
        practiced: ['[[A Minor]]', '[[E Minor|Em]]']
    }
    const key = { date: DATE, minutes: 30, items: ['e minor', 'A Minor'], startTime: '18:30' }
    const OLD = 24 * 3_600_000
    it('matches the same date, minutes, start and items, in any order and case', () => {
        expect(holdsLog(session, key, fields, OLD)).toBe(true)
        expect(holdsLog({ ...session, date: `${DATE}T18:30` }, key, fields, OLD)).toBe(true)
        expect(holdsLog({ ...session, time_spent: '30' }, key, fields, OLD)).toBe(true)
        expect(holdsLog(session, { ...key, startTime: '19:00' }, fields, OLD)).toBe(false)
    })
    it('without a given start time: only a note created less than 15 minutes ago', () => {
        const bare = { ...session, start_time: '' }
        const noStart = { ...key, startTime: null }
        expect(holdsLog(bare, noStart, fields, 60_000)).toBe(true)
        expect(holdsLog({ ...session, start_time: undefined }, noStart, fields, 60_000)).toBe(true)
        // Two real sessions that day: the earlier note is older than 15 minutes.
        expect(holdsLog(bare, noStart, fields, 15 * 60_000)).toBe(false)
        expect(holdsLog(bare, noStart, fields, OLD)).toBe(false)
        // The start time the plugin computed and wrote doesn't count.
        expect(holdsLog(session, noStart, fields, 60_000)).toBe(true)
        expect(holdsLog(session, noStart, fields, 20 * 60_000)).toBe(false)
    })
    it('does not match another date, other minutes or other items', () => {
        expect(holdsLog(session, { ...key, date: '2026-10-29' }, fields, OLD)).toBe(false)
        expect(holdsLog(session, { ...key, minutes: 31 }, fields, OLD)).toBe(false)
        expect(holdsLog(session, { ...key, items: ['A Minor'] }, fields, OLD)).toBe(false)
        expect(holdsLog(session, { ...key, items: ['A Minor', 'E Minor', 'G'] }, fields, OLD)).toBe(
            false
        )
        expect(holdsLog({ ...session, practiced: '[[A Minor]]' }, key, fields, OLD)).toBe(false)
    })
})
