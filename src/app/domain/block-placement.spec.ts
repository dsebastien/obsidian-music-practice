import { describe, expect, it } from 'bun:test'
import {
    blockTarget,
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
