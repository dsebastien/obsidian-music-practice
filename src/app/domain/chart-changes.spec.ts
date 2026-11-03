import { describe, expect, it } from 'bun:test'
import { changeEffort, chordChanges, easiestFrets, rankChanges, sortChanges } from './chart-changes'

describe('chordChanges (#74)', () => {
    it('counts each change once whichever chord comes first, in the order first played', () => {
        expect(chordChanges(['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'G'])).toEqual([
            { a: 'G', b: 'D', count: 2 },
            { a: 'D', b: 'Em', count: 1 },
            { a: 'Em', b: 'C', count: 1 },
            { a: 'C', b: 'G', count: 2 },
            { a: 'D', b: 'C', count: 1 }
        ])
    })

    it('ignores a chord repeated right after itself, and needs two chords', () => {
        expect(chordChanges(['A', 'A', 'D'])).toEqual([{ a: 'A', b: 'D', count: 1 }])
        expect(chordChanges(['A'])).toEqual([])
        expect(chordChanges([])).toEqual([])
    })
})

describe('changeEffort and rankChanges (#74)', () => {
    it("measures a change from the player's own frets when given, else the easiest voicing", () => {
        const own = changeEffort('C', 'G', (s) => (s === 'C' ? [null, 3, 2, 0, 1, 0] : null))
        // G has no frets of its own here and no fallback: the way back is unknown.
        expect(own).toBeNull()
        expect(changeEffort('C', 'G')).toBeGreaterThan(0)
        expect(changeEffort('Hmaj', 'C')).toBeNull()
    })

    it('averages both ways', () => {
        const effort = changeEffort('Am', 'Em', easiestFrets)!
        expect(Math.round(effort * 10) / 10).toBe(effort)
    })

    it('sorts the hardest change first, then the most played, unknown effort last', () => {
        const sorted = sortChanges([
            { a: 'A', b: 'B', count: 1, effort: 2 },
            { a: 'G', b: 'H', count: 9, effort: null },
            { a: 'E', b: 'F', count: 3, effort: 2 },
            { a: 'C', b: 'D', count: 1, effort: 5 }
        ]).map((c) => `${c.a}${c.b}`)
        expect(sorted).toEqual(['CD', 'EF', 'AB', 'GH'])
    })

    it('puts a hard change before an easy one played more often', () => {
        const ranked = rankChanges([
            { a: 'C', b: 'G', count: 4 },
            { a: 'F', b: 'Bm', count: 1 }
        ])
        const efforts = ranked.map((c) => c.effort!)
        expect(efforts[0]).toBeGreaterThanOrEqual(efforts[1]!)
        expect(ranked.every((c) => c.effort !== null)).toBe(true)
    })
})
