import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import {
    firstLinkPath,
    planItemTime,
    practicedMinutesValues,
    sessionItemMinutes
} from './item-time'

const fields = createDefaultFieldNames()
const PATHS: Record<string, string> = {
    'A Minor': 'Chords/A Minor.md',
    'E Minor': 'Chords/E Minor.md',
    'G Major': 'Chords/G Major.md'
}
const resolve = (link: string) => PATHS[link] ?? null
const A = PATHS['A Minor']!
const E = PATHS['E Minor']!
const G = PATHS['G Major']!
const session = (over: Record<string, unknown>) => ({
    tags: ['type/session/music/guitar'],
    date: '2026-11-03',
    ...over
})

describe('item time: what one session note gives each item', () => {
    it('reads the minutes per item', () => {
        const fm = session({
            time_spent: 30,
            practiced: ['[[A Minor]]', '[[E Minor]]'],
            practiced_minutes: ['20 [[A Minor]]', '10 [[E Minor|Em]]']
        })
        expect(sessionItemMinutes(fm, fields, resolve)).toEqual(
            new Map([
                [A, 20],
                [E, 10]
            ])
        )
    })

    it('splits the minutes evenly when only practiced lists the items, the first take the remainder', () => {
        const fm = session({
            time_spent: 20,
            practiced: ['[[A Minor]]', '[[E Minor]]', '[[G Major]]']
        })
        expect(sessionItemMinutes(fm, fields, resolve)).toEqual(
            new Map([
                [A, 7],
                [E, 7],
                [G, 6]
            ])
        )
    })

    it('gives the even share to items missing from the minutes per item', () => {
        const fm = session({
            time_spent: '31',
            practiced: ['[[A Minor]]', '[[E Minor]]', '[[A Minor]]'],
            practiced_minutes: ['25 [[A Minor]]']
        })
        // A listed twice counts once; the share is over the 2 listed items (31 → 16, 15).
        expect(sessionItemMinutes(fm, fields, resolve)).toEqual(
            new Map([
                [E, 15],
                [A, 25]
            ])
        )
    })

    it('adds two entries for one item, keeps decimals, and skips unresolved links', () => {
        const fm = session({
            practiced_minutes: ['5 [[A Minor]]', '2.5 [[A Minor]]', '9 [[Nowhere]]', 'oops'],
            time_spent: 0
        })
        expect(sessionItemMinutes(fm, fields, resolve)).toEqual(new Map([[A, 7.5]]))
    })

    it('reads a single value, and gives nothing for notes that are not sessions', () => {
        expect(
            sessionItemMinutes(
                session({ practiced: '[[A Minor]]', time_spent: 12 }),
                fields,
                resolve
            )
        ).toEqual(new Map([[A, 12]]))
        expect(
            sessionItemMinutes(
                { tags: ['type/music/guitar/chord'], practiced: '[[A Minor]]', time_spent: 12 },
                fields,
                resolve
            ).size
        ).toBe(0)
        // Minutes that aren't a positive number share nothing.
        expect(
            sessionItemMinutes(
                session({ practiced: ['[[A Minor]]'], time_spent: '1h' }),
                fields,
                resolve
            )
        ).toEqual(new Map([[A, 0]]))
    })

    it('reads the first wikilink of a value', () => {
        expect(firstLinkPath('20 [[A Minor#Shape|Am]] and [[E]]')).toBe('A Minor')
        expect(firstLinkPath('A Minor')).toBeNull()
        expect(firstLinkPath(null)).toBeNull()
    })

    it('writes "<minutes> [[<note>]]" per item', () => {
        expect(practicedMinutesValues(['A Minor', 'E Minor'], [7, 6])).toEqual([
            '7 [[A Minor]]',
            '6 [[E Minor]]'
        ])
    })
})

describe('item time: the recompute', () => {
    it('writes the sum of the sessions, rounded; never adds to the stored value', () => {
        expect(planItemTime(10, [20, 12.6]).write).toBe(33)
        expect(planItemTime(undefined, [20]).write).toBe(20)
        expect(planItemTime('', [20]).write).toBe(20)
        expect(planItemTime('15', [20]).write).toBe(20)
    })

    it('writes nothing when nothing counts or nothing changes', () => {
        expect(planItemTime(40, []).write).toBeNull()
        expect(planItemTime(40, []).decision).toBeNull()
        expect(planItemTime(40, [25, 15]).write).toBeNull()
        expect(planItemTime(40.2, [40]).write).toBeNull()
    })

    it('never lowers on its own: a higher stored value is reported', () => {
        const plan = planItemTime(90, [20, 30])
        expect(plan.write).toBeNull()
        expect(plan.decision).toEqual({ stored: 90, computed: 50, difference: 40 })
        expect(plan.sessions).toBe(2)
        // The user's call: drop it.
        expect(planItemTime(90, [20, 30], 'drop').write).toBe(50)
    })

    it('leaves a value that is not a number alone', () => {
        const plan = planItemTime('1h', [20])
        expect([plan.write, plan.notANumber, plan.decision]).toEqual([null, true, null])
    })
})
