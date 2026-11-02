import { describe, expect, it } from 'bun:test'
import { chordCharts, progressionOf } from './progression'

const note = [
    '# Song',
    '```chords',
    '{title: Song}',
    '[G]Hello [G]there [D]little [Em]world',
    '[C]And [G]so on',
    '```',
    'Text',
    '~~~chords',
    '[Am]More [F]lines [Xyz]bad',
    '~~~'
].join('\n')

describe('progressionOf', () => {
    it("reads the chords a note's charts play, in order, without repeats", () => {
        expect(chordCharts(note)).toHaveLength(2)
        expect(progressionOf(note)).toEqual(['G', 'D', 'Em', 'C', 'G', 'Am', 'F'])
    })

    it('stops at the limit, and finds nothing without charts', () => {
        expect(progressionOf(note, 3)).toEqual(['G', 'D', 'Em'])
        expect(progressionOf('# No chart')).toEqual([])
    })

    it("applies a chart's {transpose}, spelled for the transposed key", () => {
        const note = '```chords\n{key: C}\n{transpose: 3}\n[C]Hello [G]world [Am]and [F]more\n```'
        expect(progressionOf(note)).toEqual(['Eb', 'Bb', 'Cm', 'Ab'])
        const sharp = '```chords\n{transpose: 2}\n[A]one [E]two\n```'
        expect(progressionOf(sharp)).toEqual(['B', 'F#'])
    })
})
