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
})
