import { describe, expect, it } from 'bun:test'
import {
    chordBlock,
    formatFingers,
    formatFrets,
    insertUnderTitle,
    chordFromNotes,
    ensureBlock,
    withAlias,
    voicingRow
} from './notation-note'

describe('frets and fingers as text', () => {
    it('writes compact text, with dashes above fret 9', () => {
        expect(formatFrets([null, 0, 2, 2, 2, 0])).toBe('x02220')
        expect(formatFrets([null, 10, 12, 12, 11, 10])).toBe('x-10-12-12-11-10')
        expect(
            formatFingers({
                frets: [null, 0, 2, 2, 2, 0],
                fingers: [null, null, '1', '2', '3', null]
            })
        ).toBe('x01230')
    })
})

describe('chordBlock', () => {
    it('writes a guitar voicing, with its position only when needed', () => {
        expect(
            chordBlock('A', 'guitar', {
                frets: [null, 0, 2, 2, 2, 0],
                fingers: [null, null, '1', '2', '3', null],
                baseFret: 1
            })
        ).toBe('```chord\nsymbol: A\nfrets: x02220\nfingers: x01230\n```')
        expect(
            chordBlock('C', 'guitar', {
                frets: [null, null, 5, 5, 5, 8],
                fingers: [null, null, '1', '1', '1', '4'],
                baseFret: 4
            })
        ).toContain('position: 4')
    })

    it('writes a piano chord from its symbol, and nothing for a guitar chord without voicing', () => {
        expect(chordBlock('C/G', 'piano', null)).toBe(
            '```chord\nsymbol: C/G\ninstrument: piano\n```'
        )
        expect(chordBlock('A', 'guitar', null)).toBeNull()
    })
})

describe('insertUnderTitle', () => {
    it('puts the block under the H1', () => {
        expect(insertUnderTitle('---\na: 1\n---\n# A Major\n## Tips\n', 'B')).toBe(
            '---\na: 1\n---\n# A Major\nB\n## Tips\n'
        )
    })

    it('falls back to after the frontmatter', () => {
        expect(insertUnderTitle('---\na: 1\n---\ntext', 'B')).toBe('---\na: 1\n---\nB\ntext')
        expect(insertUnderTitle('text', 'B')).toBe('B\ntext')
    })
})

describe('ensureBlock', () => {
    it("keeps the template's block, with or without content", () => {
        expect(ensureBlock('# A\n```chord\n```\n## Tips\n', 'chord')).toBe(
            '# A\n```chord\n```\n## Tips\n'
        )
        expect(ensureBlock('# A\r\n```fretboard\r\n```\r\n', 'fretboard')).toBe(
            '# A\r\n```fretboard\r\n```\r\n'
        )
        expect(ensureBlock('# A\n```chord\nAm\n```\n', 'chord')).toBe('# A\n```chord\nAm\n```\n')
    })

    it('adds an empty block under the title when there is none', () => {
        expect(ensureBlock('---\na: 1\n---\n# A\n## Tips\n', 'keyboard')).toBe(
            '---\na: 1\n---\n# A\n```keyboard\n```\n## Tips\n'
        )
        expect(ensureBlock('# A\n```chords\n```\n', 'chord')).toBe(
            '# A\n```chord\n```\n```chords\n```\n'
        )
    })
})

describe('voicingRow', () => {
    it('shows the first four, and the selected one when it is further', () => {
        expect(voicingRow(10, 0)).toEqual([0, 1, 2, 3])
        expect(voicingRow(10, 6)).toEqual([0, 1, 2, 3, 6])
        expect(voicingRow(2, 1)).toEqual([0, 1])
        expect(voicingRow(10, -1)).toEqual([0, 1, 2, 3])
        expect(voicingRow(0, 0)).toEqual([])
    })
})

describe('CRLF notes', () => {
    it('keeps CRLF and finds the frontmatter when inserting', () => {
        expect(insertUnderTitle('---\r\na: 1\r\n---\r\n# A\r\ntext', 'X\nY')).toBe(
            '---\r\na: 1\r\n---\r\n# A\r\nX\r\nY\r\ntext'
        )
    })
})

describe('chordFromNotes', () => {
    it('reads guitar frets and piano pitches', () => {
        expect(chordFromNotes('x02220', '', 'guitar')?.symbol).toBe('A')
        expect(chordFromNotes('x02210', '', null)?.symbol).toBe('Am')
        expect(chordFromNotes('', 'E4 G4 C5', 'piano')?.symbol).toBe('C/E')
        expect(chordFromNotes('', 'C E G', 'piano')?.symbol).toBe('C')
    })

    it('needs six frets or readable pitches', () => {
        expect(chordFromNotes('x0222', '', 'guitar')).toBeNull()
        expect(chordFromNotes('', '', 'guitar')).toBeNull()
        expect(chordFromNotes('', 'nope', 'piano')).toBeNull()
    })
})

describe('withAlias', () => {
    it('keeps aliases as a list, a single one included', () => {
        expect(withAlias(undefined, 'C')).toEqual(['C'])
        expect(withAlias('Open E', 'E')).toEqual(['Open E', 'E'])
        expect(withAlias(['C', null], 'C')).toEqual(['C'])
    })
})

describe('ensureBlock fences', () => {
    it('sees tilde fences, callouts and info after the language', () => {
        expect(ensureBlock('# A\n~~~chord\n~~~\n', 'chord')).toBe('# A\n~~~chord\n~~~\n')
        expect(ensureBlock('# A\n> ```fretboard\n> ```\n', 'fretboard')).toBe(
            '# A\n> ```fretboard\n> ```\n'
        )
        expect(ensureBlock('# A\n```chord title\n```\n', 'chord')).toBe(
            '# A\n```chord title\n```\n'
        )
    })
})
