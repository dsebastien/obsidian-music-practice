import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import {
    addTimeEntry,
    applyItemUpdate,
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
    minutes: 10,
    fields,
    rules,
    stampDates: false,
    current: {},
    ...over
})
const item = (over = {}) => computeItems([input('E', over)], DATE, rules)[0]!

describe('itemUpdate', () => {
    it('sets last practiced and adds minutes', () => {
        expect(itemUpdate(item(), type, { path: 'E.md' }, ctx())).toEqual({
            set: { date_last_practiced: DATE },
            addMinutes: { field: 'time_spent', minutes: 10 }
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
    it('never moves the last practiced date back and adds minutes', () => {
        const fm: Record<string, unknown> = { date_last_practiced: '2026-10-30', time_spent: 15 }
        applyItemUpdate(
            fm,
            {
                set: { date_last_practiced: DATE },
                addMinutes: { field: 'time_spent', minutes: 10 }
            },
            fields
        )
        expect(fm).toEqual({ date_last_practiced: '2026-10-30', time_spent: 25 })
    })
})

describe('addTimeEntry', () => {
    const entry = {
        startTime: '2026-10-28T18:00:00',
        endTime: '2026-10-28T18:30:00',
        description: '[[2026-10-28 (Guitar Practice Session)]]'
    }

    it('adds an entry, minutes and the last session date once', () => {
        const fm: Record<string, unknown> = { time_spent: 60, time_entries: [null] }
        expect(addTimeEntry(fm, entry, 30, DATE, fields)).toBe('added')
        expect(addTimeEntry(fm, entry, 30, DATE, fields)).toBe('exists')
        expect(fm).toEqual({ time_spent: 90, time_entries: [entry], date_last_session: DATE })
    })

    it("relabels the adopted timer's entry instead of adding one", () => {
        const start = new Date('2026-10-28T18:00:20').getTime()
        const fm: Record<string, unknown> = {
            time_spent: 30,
            time_entries: [{ ...entry, description: 'Timer' }]
        }
        expect(addTimeEntry(fm, entry, 30, DATE, fields, start)).toBe('adopted')
        expect(fm['time_spent']).toBe(30)
        expect((fm['time_entries'] as { description: string }[])[0]!.description).toBe(
            entry.description
        )
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
    it('keeps unknown time entries, skips non-list or non-numeric values', () => {
        const entry = {
            startTime: '2026-10-28T18:00:00',
            endTime: '2026-10-28T18:30:00',
            description: '[[S]]'
        }
        const fm: Record<string, unknown> = {
            time_entries: ['legacy text', null],
            time_spent: '60'
        }
        expect(addTimeEntry(fm, entry, 30, DATE, fields)).toBe('added')
        expect(fm['time_entries']).toEqual(['legacy text', entry])
        expect(fm['time_spent']).toBe(90)
        expect(addTimeEntry({ time_entries: 'oops' }, entry, 30, DATE, fields)).toBe('skipped')
        const text: Record<string, unknown> = { time_spent: '1h' }
        expect(addTimeEntry(text, entry, 30, DATE, fields)).toBe('skipped')
        expect(text).toEqual({ time_spent: '1h' })
    })

    it('never overwrites minutes that are not a number, nor moves review dates back', () => {
        const fm: Record<string, unknown> = {
            time_spent: '1h',
            last_reviewed: '2026-11-01',
            review_count: 4
        }
        const skipped = applyItemUpdate(
            fm,
            {
                set: { last_reviewed: DATE, review_count: 5, review_interval: 6 },
                addMinutes: { field: 'time_spent', minutes: 10 }
            },
            fields
        )
        expect(skipped).toEqual(['time_spent'])
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
    })
})
