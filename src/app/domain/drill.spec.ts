import { describe, expect, it } from 'bun:test'
import { afterDrill, countOf, pairKey, pairsOf, pairTitle } from './drill'

describe('chord change drills', () => {
    it('lists every pair once, the slowest first', () => {
        const pairs = pairsOf(
            ['A.md', 'D.md', 'E.md', 'A.md'],
            [
                { path: 'AD.md', chords: ['D.md', 'A.md'], best: 40, last: 38 },
                { path: 'AE.md', chords: ['A.md', 'E.md'], best: 25, last: 25 }
            ]
        )
        expect(pairs.map((p) => `${p.a}-${p.b}:${p.best ?? '-'}`)).toEqual([
            'D.md-E.md:-',
            'A.md-E.md:25',
            'A.md-D.md:40'
        ])
        expect(pairs[2]!.note).toBe('AD.md')
    })

    it('knows a pair whichever chord comes first', () => {
        expect(pairKey('A.md', 'D.md')).toBe(pairKey('D.md', 'A.md'))
        expect(pairTitle('A Major - Open', 'D Major - Open')).toBe(
            'A Major - Open ↔ D Major - Open'
        )
    })

    it('keeps the best and the last count', () => {
        expect(afterDrill(null, 30)).toEqual({ best: 30, last: 30, improved: true })
        expect(afterDrill(40, 30)).toEqual({ best: 40, last: 30, improved: false })
        expect(afterDrill(40, 45)).toEqual({ best: 45, last: 45, improved: true })
    })

    it('reads counts as typed', () => {
        expect(countOf('34')).toBe(34)
        expect(countOf('')).toBeNull()
        expect(countOf('-1')).toBeNull()
        expect(countOf('3.5')).toBeNull()
    })
})
