import { describe, expect, it } from 'bun:test'
import {
    chordBlock,
    formatFingers,
    formatFrets,
    insertUnderTitle,
    placeChordBlock
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

describe('placeChordBlock', () => {
    it("fills the template's empty chord block", () => {
        expect(placeChordBlock('# A\n```chord\n```\n## Tips\n', '```chord\nsymbol: A\n```')).toBe(
            '# A\n```chord\nsymbol: A\n```\n## Tips\n'
        )
    })

    it('leaves a filled chord block alone and adds under the title', () => {
        expect(placeChordBlock('# A\n```chord\nAm\n```\n', 'B')).toBe('# A\nB\n```chord\nAm\n```\n')
    })
})

describe('CRLF notes and blank lines', () => {
    it('fills an empty block with blank lines or CRLF', () => {
        expect(placeChordBlock('# A\r\n```chord\r\n\r\n```\r\n', 'B')).toBe('# A\r\nB\r\n')
        expect(placeChordBlock('# A\n```chord\n\n  \n```\n', 'B')).toBe('# A\nB\n')
    })

    it('keeps CRLF and finds the frontmatter when inserting', () => {
        expect(insertUnderTitle('---\r\na: 1\r\n---\r\n# A\r\ntext', 'X\nY')).toBe(
            '---\r\na: 1\r\n---\r\n# A\r\nX\r\nY\r\ntext'
        )
    })
})
