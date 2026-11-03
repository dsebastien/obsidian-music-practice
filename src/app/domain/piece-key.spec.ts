import { describe, expect, it } from 'bun:test'
import { MAX_FIT_CHORDS, fitBlock, pieceChords, pieceKey, sameKey } from './piece-key'

const chart = (body: string) => '```chords\n' + body + '\n```'

describe('pieceChords (#67)', () => {
    it("reads the charts' chords in the order they're played, then the linked chords", () => {
        const text = chart('[G]Hello [D]there [Em]my [C]friend\n[G]Again [D]and [C]again')
        expect(pieceChords(text, ['Am', 'G', 'A Minor 7'])).toEqual([
            'G',
            'D',
            'Em',
            'C',
            'G',
            'D',
            'C',
            'Am',
            'Am7'
        ])
    })

    it('applies a transposed chart and leaves out what does not read', () => {
        const text = chart('{key: G}\n{transpose: 2}\n[G]One [C]two [D]three')
        expect(pieceChords(text, ['Hmaj', ''])).toEqual(['A', 'D', 'E'])
    })

    it('reads linked chords alone when the note has no chart', () => {
        expect(pieceChords('No chart here.', ['Dm', 'C', 'G'])).toEqual(['Dm', 'C', 'G'])
        expect(pieceChords('No chart here.')).toEqual([])
    })
})

describe('pieceKey (#67)', () => {
    it('finds the key and the scales that fit', () => {
        const result = pieceKey(['G', 'D', 'Em', 'C'])!
        expect(result.key).toBe('G major')
        expect(result.alternatives).toEqual([])
        expect(result.outside).toEqual([])
        expect(result.scales[0]!.name).toBe('G major')
    })

    it('names the mode the chords play, with what is outside it', () => {
        const result = pieceKey(['Dm', 'C', 'G'])!
        expect(result.key).toBe('D dorian')
        expect(result.outside).toEqual([])
        expect(result.alternatives.length).toBeGreaterThan(0)
    })

    it('says when the key is not clear', () => {
        const result = pieceKey(['C', 'F', 'G', 'Am'])!
        expect(result.key).toBe('C major')
        expect(result.alternatives).toContain('A minor')
    })

    it('reads a dominant-seventh blues', () => {
        const result = pieceKey(['A7', 'D7', 'E7', 'A7'])!
        expect(result.key).toBe('A major')
        expect(result.blues).toBe(true)
    })

    it('lists the chords outside a key', () => {
        expect(pieceKey(['C', 'F', 'Ab', 'G', 'C'])!.outside).toEqual(['Ab'])
    })

    it('finds nothing without chords', () => {
        expect(pieceKey([])).toBeNull()
    })
})

describe('fitBlock and sameKey', () => {
    it('draws the scale that fits, from at most 32 chords', () => {
        expect(fitBlock(['G', 'D', 'Em', 'C'])).toBe('scales-for: G D Em C')
        const many = Array.from({ length: 40 }, (_, i) => (i % 2 ? 'C' : 'G'))
        expect(fitBlock(many).split(' ')).toHaveLength(MAX_FIT_CHORDS + 1)
    })

    it('compares keys without regard to case or spaces', () => {
        expect(sameKey(' g major ', 'G major')).toBe(true)
        expect(sameKey('E minor', 'G major')).toBe(false)
        expect(sameKey(null, 'G major')).toBe(false)
    })
})
