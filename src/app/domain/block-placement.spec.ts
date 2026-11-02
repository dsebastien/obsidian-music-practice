import { describe, expect, it } from 'bun:test'
import {
    blockLanguage,
    blockTarget,
    emptyBlockAt,
    commentAfter,
    emptyBlocks,
    fillableLanguages,
    placeInNote,
    regionEnd,
    sectionRegionEnd,
    sectionsMatch,
    type NoteSection
} from './block-placement'

/** A section map for `lines`: [type, first line, last line] each, offsets as Obsidian gives them. */
function mapOf(lines: string[], parts: [string, number, number][]): NoteSection[] {
    const starts: number[] = []
    let offset = 0
    for (const line of lines) {
        starts.push(offset)
        offset += line.length + 1
    }
    return parts.map(([type, first, last]) => ({
        type,
        position: {
            start: { line: first, col: 0, offset: starts[first]! },
            end: {
                line: last,
                col: lines[last]!.length,
                offset: starts[last]! + lines[last]!.length
            }
        }
    }))
}

describe('regionEnd', () => {
    const note = [
        '---',
        'tags: []',
        '---',
        '# Title',
        '```chords',
        '[G]Hi',
        '```',
        'text',
        '~~~',
        'x'
    ]

    it('moves a cursor out of the properties and code blocks', () => {
        expect(regionEnd(note, 0)).toBe(2)
        expect(regionEnd(note, 1)).toBe(2)
        expect(regionEnd(note, 5)).toBe(6)
        expect(regionEnd(note, 6)).toBe(6)
    })

    it('leaves a cursor in the text where it is', () => {
        expect(regionEnd(note, 3)).toBeNull()
        expect(regionEnd(note, 7)).toBeNull()
    })

    it('puts a block before a fence that is never closed', () => {
        expect(regionEnd(note, 9)).toBe(7)
        expect(regionEnd(['```', 'code'], 1)).toBe(-1)
    })

    it('reads inline code as text, and fences in lists and callouts as fences', () => {
        expect(regionEnd(['```npm i``` to install', '', 'text', 'more'], 2)).toBeNull()
        expect(regionEnd(['- a', '  - b', '    ```js', '    code', '    ```', 'after'], 3)).toBe(4)
        expect(regionEnd(['> [!note]', '> ```js', '> code', '> ```', 'after'], 2)).toBe(3)
    })

    it('closes a fence only with the same character, at least as long', () => {
        const lines = ['````md', '```tab', '```', '````', 'after']
        expect(regionEnd(lines, 2)).toBe(3)
        expect(regionEnd(lines, 4)).toBeNull()
    })
})

describe('sectionsMatch', () => {
    const lines = ['---', 'tags: []', '---', '# Title', '', '```tab', ':4 0.6', '```', '', 'text']
    const map = mapOf(lines, [
        ['yaml', 0, 2],
        ['heading', 3, 3],
        ['code', 5, 7],
        ['paragraph', 9, 9]
    ])

    it('accepts a map that describes the text', () => {
        expect(sectionsMatch(lines.join('\n'), map)).toBe(true)
        expect(sectionsMatch(`${lines.join('\n')}\n\n`, map)).toBe(true)
        expect(sectionsMatch('', [])).toBe(true)
    })

    it('refuses a map behind the editor', () => {
        // A line added above the code block moves it.
        const moved = [...lines.slice(0, 4), 'new line', ...lines.slice(4)]
        expect(sectionsMatch(moved.join('\n'), map)).toBe(false)
        // Text typed in a line changes the offsets after it.
        expect(sectionsMatch(lines.join('\n').replace('# Title', '# A title'), map)).toBe(false)
        // Text added after the last section.
        expect(sectionsMatch(`${lines.join('\n')}\n\n\`\`\`tab`, map)).toBe(false)
        expect(sectionsMatch('text', [])).toBe(false)
    })
})

describe('sectionRegionEnd', () => {
    it('moves a cursor out of the properties, code, math and HTML', () => {
        const lines = [
            '---',
            'a: 1',
            '---',
            '$$',
            'x^2',
            '$$',
            '<div>',
            '```',
            '</div>',
            '',
            'text',
            '    indented code'
        ]
        const map = mapOf(lines, [
            ['yaml', 0, 2],
            ['math', 3, 5],
            ['html', 6, 8],
            ['paragraph', 10, 10],
            ['code', 11, 11]
        ])
        expect(sectionRegionEnd(lines, map, 1)).toBe(2)
        expect(sectionRegionEnd(lines, map, 4)).toBe(5)
        expect(sectionRegionEnd(lines, map, 7)).toBe(8)
        expect(sectionRegionEnd(lines, map, 11)).toBe(11)
        expect(sectionRegionEnd(lines, map, 10)).toBeNull()
        expect(sectionRegionEnd(lines, map, 9)).toBeNull()
    })

    it('moves a cursor out of a %% comment', () => {
        const lines = ['text', '%%', 'hidden', '%%']
        const map = mapOf(lines, [
            ['paragraph', 0, 0],
            ['comment', 1, 3]
        ])
        expect(sectionRegionEnd(lines, map, 2)).toBe(3)
    })

    it('puts a block before a code fence that is never closed', () => {
        const lines = ['text', '```tab', ':4 0.6']
        expect(
            sectionRegionEnd(
                lines,
                mapOf(lines, [
                    ['paragraph', 0, 0],
                    ['code', 1, 2]
                ]),
                2
            )
        ).toBe(0)
        expect(sectionRegionEnd(['```'], mapOf(['```'], [['code', 0, 0]]), 0)).toBe(-1)
    })

    it('reads the fenced code inside lists, quotes and callouts', () => {
        const lines = [
            '- item',
            '  > ```js',
            '  > code',
            '  > ```',
            '- > ```js',
            '  > more',
            'after'
        ]
        const map = mapOf(lines, [
            ['list', 0, 5],
            ['paragraph', 6, 6]
        ])
        expect(sectionRegionEnd(lines, map, 2)).toBe(3)
        expect(sectionRegionEnd(lines, map, 0)).toBeNull()
        // Never closed: it ends with its list, the block goes before it.
        expect(sectionRegionEnd(lines, map, 5)).toBe(3)
    })
})

describe('blockTarget', () => {
    const lines = ['# Title', '<div>', '```', '</div>', '', 'text']
    const map = mapOf(lines, [
        ['heading', 0, 0],
        ['html', 1, 3],
        ['paragraph', 5, 5]
    ])

    it('reads the section map when it describes the text', () => {
        // The line scan takes the HTML's backticks for a fence never closed.
        expect(regionEnd(lines, 5)).toBe(1)
        expect(blockTarget(lines.join('\n'), 5, 5, map)).toBeNull()
        expect(blockTarget(lines.join('\n'), 2, 2, map)).toBe(3)
        expect(blockTarget(lines.join('\n'), 0, 2, map)).toBe(3)
    })

    it('falls back to the line scan when the map is missing or behind', () => {
        expect(blockTarget(lines.join('\n'), 5, 5, null)).toBe(1)
        const edited = ['# Title', '```tab', ':4 0.6', '```', 'text']
        expect(blockTarget(edited.join('\n'), 2, 2, map)).toBe(3)
    })
})

describe('empty blocks', () => {
    const template = [
        '---',
        'tags: []',
        '---',
        '# Song',
        '## Tab',
        '```tab',
        '```',
        '## Chart',
        '~~~chords',
        '',
        '~~~',
        '## Notes',
        '```tab',
        ':4 0.6',
        '```',
        '> ```chords',
        '> ```',
        '````md',
        '```score',
        '```',
        '````',
        '```',
        '```'
    ]

    it('reads a fenced block language and the kinds it fills', () => {
        expect(blockLanguage('```tab\nfile: [[a.gp]]\n```')).toBe('tab')
        expect(blockLanguage('````Chords\n[G]Hi\n````')).toBe('chords')
        expect(blockLanguage('text')).toBeNull()
        expect(fillableLanguages('score')).toEqual(['tab', 'score'])
        expect(fillableLanguages('tab')).toEqual(['tab', 'score'])
        expect(fillableLanguages('chords')).toEqual(['chords'])
    })

    it('finds the empty blocks at the margin, not in callouts or other blocks', () => {
        expect(emptyBlocks(template)).toEqual([
            { start: 5, end: 6, language: 'tab' },
            { start: 8, end: 10, language: 'chords' }
        ])
    })

    it('skips empty blocks in comments, which would hide the import', () => {
        const lines = [
            '%%',
            '```tab',
            '```',
            '%%',
            '<!-- template:',
            '```tab',
            '```',
            '-->',
            '%% a %% <!-- b --> text',
            '```chords',
            '```',
            '```tab',
            '%% in code %%',
            '```',
            '```tab',
            '```'
        ]
        expect(emptyBlocks(lines)).toEqual([
            { start: 9, end: 10, language: 'chords' },
            { start: 14, end: 15, language: 'tab' }
        ])
        expect(placeInNote(lines.join('\n'), '```tab\n:4 0.6\n```').split('\n')[15]).toBe(':4 0.6')
        expect(commentAfter('a %% b', null)).toBe('%%')
        expect(commentAfter('end -->', '<!--')).toBeNull()
        expect(commentAfter('<!-- %% -->', null)).toBeNull()
    })

    it('finds the empty block a cursor is in, checked against the section map', () => {
        const lines = ['# Song', '```tab', '```', '', '<div>', '```chords', '```', '</div>']
        const text = lines.join('\n')
        expect(emptyBlockAt(text, 2, ['tab', 'score'])).toEqual({
            start: 1,
            end: 2,
            language: 'tab'
        })
        expect(emptyBlockAt(text, 2, ['chords'])).toBeNull()
        expect(emptyBlockAt(text, 0, ['tab', 'score'])).toBeNull()
        const map = mapOf(lines, [
            ['heading', 0, 0],
            ['code', 1, 2],
            ['html', 4, 7]
        ])
        expect(emptyBlockAt(text, 1, ['tab'], map)).toEqual({ start: 1, end: 2, language: 'tab' })
        // Backticks in HTML aren't a block.
        expect(emptyBlockAt(text, 5, ['chords'])).not.toBeNull()
        expect(emptyBlockAt(text, 5, ['chords'], map)).toBeNull()
    })

    it("fills a new note's first empty block of the same kind", () => {
        const note = template.join('\n')
        const tab = '```tab\nstaves: both\nfile: [[Song.gp]]\n```'
        const filled = placeInNote(note, tab).split('\n')
        expect(filled.slice(4, 10)).toEqual([
            '## Tab',
            '```tab',
            'staves: both',
            'file: [[Song.gp]]',
            '```',
            '## Chart'
        ])
        // A score file fills the Tab block too.
        expect(placeInNote(note, '```score\n\\title "x"\n```').split('\n')[6]).toBe('\\title "x"')
        const chart = placeInNote(note, '```chords\n[G]Hello\n```').split('\n')
        expect(chart.slice(7, 12)).toEqual(['## Chart', '```chords', '[G]Hello', '```', '## Notes'])
    })

    it('adds the block at the end when there is no empty block of its kind', () => {
        expect(placeInNote('---\n---\n# Song\n', '```tab\n:4 0.6\n```')).toBe(
            '---\n---\n# Song\n\n```tab\n:4 0.6\n```\n'
        )
        expect(placeInNote('# Song\r\n```tab\r\n```\r\n', '```chords\n[G]Hi\n```')).toBe(
            '# Song\r\n```tab\r\n```\r\n\r\n```chords\r\n[G]Hi\r\n```\r\n'
        )
        expect(placeInNote('', '```tab\nx\n```')).toBe('```tab\nx\n```\n')
    })
})
