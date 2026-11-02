import { describe, expect, it } from 'bun:test'
import type { App, Editor, EditorChange, EditorTransaction, TFile } from 'obsidian'
import {
    TextTabConverter,
    applyChange,
    blockAt,
    codeBlocks,
    convertedTab,
    convertible,
    editorText,
    fileText,
    findBlock,
    replaceBody,
    undoConversion
} from './text-tab.service'
import type { NoteText } from './text-tab.service'
import { parseTabSource } from '@dsebastien/music-notation/tab'
import { isTextTab } from './notation.service'

/** A test double typed as what it stands in for (it only has what the code under test reads). */
const fake = <T>(value: unknown): T => value as T

const TAB = 'e|-----0---|\nB|---1-----|\nG|-2-------|\nD|---------|\nA|---------|\nE|---------|'

/** A note's text in memory. */
const memory = (text: string) => {
    let lines = text.split('\n')
    const note: NoteText = {
        edit: (change) => {
            const made = change(lines)
            if (made) lines = applyChange(lines, made)
            return Promise.resolve(made !== null)
        }
    }
    return { note, text: () => lines.join('\n') }
}

describe('codeBlocks', () => {
    it('finds fenced blocks after the properties, by language', () => {
        const lines = [
            '---',
            'a: 1',
            '---',
            '```tab',
            TAB,
            '```',
            'text',
            '~~~ score x',
            ':4 C4',
            '~~~'
        ]
        const blocks = codeBlocks(lines.join('\n').split('\n'))
        expect(blocks.map((b) => [b.language, b.open, b.close])).toEqual([
            ['tab', 3, 10],
            ['score', 12, 14]
        ])
        expect(blocks[0]!.body.join('\n')).toBe(TAB)
    })

    it('reads blocks in callouts and lists without their prefix', () => {
        const lines = [
            '> [!note]',
            '> ```tab',
            '> e|---0---|',
            '> ```',
            '- item',
            '  ```tab',
            '  B|--1--|',
            '  ```'
        ]
        const [callout, list] = codeBlocks(lines)
        expect(callout).toMatchObject({ prefix: '> ', body: ['e|---0---|'] })
        expect(list).toMatchObject({ prefix: '  ', body: ['B|--1--|'] })
    })

    it("keeps a legend line's list marker: only the block's own prefix is removed", () => {
        const legend = [...TAB.split('\n'), '* PM = palm mute', '- let ring', '> 1. x']
        for (const [open, prefix] of [
            ['```tab', ''],
            ['> ```tab', '> '],
            ['- ```tab', '  ']
        ] as const) {
            const lines = [open, ...legend.map((l) => prefix + l), `${prefix}\`\`\``]
            const block = codeBlocks(lines)[0]!
            expect([open, block.body]).toEqual([open, legend])
            expect(findBlock(lines, 'tab', legend.join('\n'), null)?.open).toBe(0)
            const converted = convertedTab(block.body.join('\n'))!
            expect(converted).toContain('* PM = palm mute\n- let ring\n> 1. x')
        }
    })

    it('writes lines back inside the list item or callout the fence is in', () => {
        for (const [open, prefix] of [
            ['- ```tab', '  '],
            ['1. ```tab', '   '],
            ['> - ```tab', '>   '],
            ['\t- ```tab', '\t  ']
        ] as const) {
            const lines = [
                open,
                ...TAB.split('\n').map((l) => prefix + l),
                `${prefix}\`\`\``,
                'after'
            ]
            const block = codeBlocks(lines)[0]!
            expect([open, block.prefix, block.body.join('\n')]).toEqual([open, prefix, TAB])
            const out = applyChange(lines, replaceBody(block, convertedTab(TAB)!))
            expect(out.slice(1, -2).every((l) => l.startsWith(prefix))).toBe(true)
            expect(out.slice(-2)).toEqual([`${prefix}\`\`\``, 'after'])
            // The converted block is still one block, closed where it was.
            expect(codeBlocks(out).map((b) => [b.open, b.close])).toEqual([[0, out.length - 2]])
        }
    })

    it('reads a tab-indented list item with space-indented lines', () => {
        const lines = ['\t- ```tab', '      e|---0---|', '      ```']
        expect(codeBlocks(lines)[0]).toMatchObject({ prefix: '\t  ', body: ['e|---0---|'] })
    })

    it('reads the note in one pass, however many blocks it has', () => {
        const lines = Array.from({ length: 300 }, (_, n) => ['```tab', `e|--${n}--|`, '```']).flat()
        let reads = 0
        const counted = new Proxy(lines, {
            get: (target, key, receiver): unknown => {
                if (typeof key === 'string' && /^\d+$/.test(key)) reads++
                return Reflect.get(target, key, receiver) as unknown
            }
        })
        expect(codeBlocks(counted)).toHaveLength(300)
        expect(reads).toBeLessThanOrEqual(2 * lines.length)
    })

    it('skips a fence never closed, and tells which block holds a line', () => {
        expect(codeBlocks(['```tab', 'e|---|'])).toEqual([])
        const lines = ['x', '```tab', TAB, '```', 'y'].join('\n').split('\n')
        expect(blockAt(lines, 0)).toBeNull()
        expect(blockAt(lines, 1)?.language).toBe('tab')
        expect(blockAt(lines, 8)?.language).toBe('tab')
        expect(blockAt(lines, 9)).toBeNull()
    })
})

describe('findBlock', () => {
    const lines = ['```tab', TAB, '```', '', '```tab', TAB, '```'].join('\n').split('\n')

    it('picks the block of the section Obsidian drew it from', () => {
        expect(findBlock(lines, 'tab', TAB, { lineStart: 9, lineEnd: 16 })?.open).toBe(9)
        expect(findBlock(lines, 'tab', TAB, { lineStart: 0, lineEnd: 7 })?.open).toBe(0)
    })

    it('without a section, takes the only matching block', () => {
        expect(findBlock(lines, 'tab', TAB, null)).toBeNull()
        expect(findBlock(lines.slice(0, 8), 'tab', TAB, null)?.open).toBe(0)
        expect(findBlock(lines, 'score', TAB, null)).toBeNull()
        expect(findBlock(lines, 'tab', 'e|---|', { lineStart: 0, lineEnd: 7 })).toBeNull()
    })
})

describe('convertedTab', () => {
    it('gives the alphaTex, then the text tab in a comment, and is no text tab anymore', () => {
        const converted = convertedTab(TAB)!
        expect(converted.startsWith(':8 ')).toBe(true)
        expect(converted).toContain(`/* Converted from this text tab:\n${TAB}\n*/`)
        expect(isTextTab(converted)).toBe(false)
    })

    it('uses line comments when the tab holds a block comment', () => {
        const converted = convertedTab(`/* intro */\n${TAB}`)!
        expect(converted).toContain('// /* intro */\n// e|-----0---|')
        expect(isTextTab(converted)).toBe(false)
    })

    it("keeps the block's settings lines above the alphaTex", () => {
        const source = `staves: both\n// from the book\ntracks: 1\n\n${TAB}`
        const converted = convertedTab(source)!
        expect(converted.startsWith('staves: both\n// from the book\ntracks: 1\n:8 ')).toBe(true)
        expect(converted).toContain(`/* Converted from this text tab:\n${TAB}\n*/`)
        const read = parseTabSource('tab', converted)
        expect([read.staves, read.tracks, read.tex.startsWith(':8 ')]).toEqual(['both', [1], true])
        expect(convertedTab(`file: [[Song.gp]]\n${TAB}`)!.split('\n')[0]).toBe('file: [[Song.gp]]')
    })

    it("refuses what the library can't read", () => {
        expect(convertedTab('e|--------|\nB|--------|\nG|--------|')).toBeNull()
        expect(convertible(codeBlocks(['```js', TAB, '```'])[0]!)).toBe(false)
        expect(convertible(codeBlocks(['```score', TAB, '```'])[0]!)).toBe(true)
    })

    it('keeps a callout prefix on every new line', () => {
        const lines = ['> ```tab', ...TAB.split('\n').map((l) => `> ${l}`), '> ```']
        const block = codeBlocks(lines)[0]!
        const out = applyChange(lines, replaceBody(block, convertedTab(TAB)!))
        expect(out.every((l) => l.startsWith('>'))).toBe(true)
        expect(out.at(-1)).toBe('> ```')
    })
})

describe('Undo a conversion', () => {
    it('puts the text tab back while the converted block is unchanged', async () => {
        const converted = convertedTab(TAB)!
        const { note, text } = memory(['# Song', '```tab', converted, '```'].join('\n'))
        expect(await undoConversion(note, 'tab', converted, TAB)).toBe(true)
        expect(text()).toBe(['# Song', '```tab', TAB, '```'].join('\n'))
        expect(await undoConversion(note, 'tab', converted, TAB)).toBe(false)
    })
})

describe('A note changed through its file', () => {
    /** A vault holding one note's text. */
    const vaultOf = (text: string) => {
        const state = { text }
        const app = fake<App>({
            vault: {
                process: (_file: TFile, fn: (data: string) => string) => {
                    state.text = fn(state.text)
                    return Promise.resolve(state.text)
                }
            }
        })
        return { note: fileText(app, fake<TFile>({})), state }
    }

    it('converts and undoes a text tab in a CRLF note, keeping its line endings', async () => {
        const original = ['# Song', '```tab', TAB, '```', 'end'].join('\n').replaceAll('\n', '\r\n')
        const { note, state } = vaultOf(original)
        const converted = convertedTab(TAB)!
        const made = await note.edit((lines) => {
            const block = findBlock(lines, 'tab', TAB, null)
            return block ? replaceBody(block, converted) : null
        })
        expect(made).toBe(true)
        expect(state.text.replaceAll('\r\n', '')).not.toContain('\n')
        expect(state.text).toContain(converted.replaceAll('\n', '\r\n'))
        expect(await undoConversion(note, 'tab', converted, TAB)).toBe(true)
        expect(state.text).toBe(original)
    })
})

describe('Convert this text tab into a playable tab', () => {
    /** An editor recording its transactions. */
    function fakeEditor(text: string, line: number) {
        const changes: EditorChange[] = []
        const editor = fake<Editor>({
            getValue: () => text,
            getLine: (n: number) => text.split('\n')[n] ?? '',
            getCursor: () => ({ line, ch: 0 }),
            transaction: (tx: EditorTransaction) => changes.push(...(tx.changes ?? []))
        })
        return { editor, changes }
    }

    it('replaces the block body at the cursor in one transaction (Ctrl+Z undoes it)', async () => {
        const { editor, changes } = fakeEditor(
            ['# Song', '```tab', TAB, '```', 'end'].join('\n'),
            3
        )
        const notices: string[] = []
        const converter = new TextTabConverter(fake({}), (message) => notices.push(message))
        await converter.convertAt(editor, 'Song.md')
        expect(notices).toEqual([
            'Converted the tab. The text tab stays in a comment at the end of the block.'
        ])
        expect(changes).toEqual([
            {
                from: { line: 2, ch: 0 },
                to: { line: 7, ch: 'E|---------|'.length },
                text: convertedTab(TAB)!
            }
        ])
    })

    it('leaves a block that is no text tab alone', async () => {
        const { editor, changes } = fakeEditor(['```tab', ':4 0.6', '```'].join('\n'), 1)
        const notices: string[] = []
        const converter = new TextTabConverter(fake({}), (message) => notices.push(message))
        await converter.convertAt(editor, 'Song.md')
        expect(changes).toEqual([])
        expect(notices).toEqual([])
    })

    it('edits the note in an editor through one change', async () => {
        const { editor, changes } = fakeEditor(['a', 'b', 'c'].join('\n'), 0)
        await editorText(editor).edit(() => ({ from: 1, to: 2, lines: ['x', 'y'] }))
        await editorText(editor).edit(() => ({ from: 1, to: 1, lines: ['z'] }))
        expect(changes).toEqual([
            { from: { line: 1, ch: 0 }, to: { line: 1, ch: 1 }, text: 'x\ny' },
            { from: { line: 1, ch: 0 }, text: 'z\n' }
        ])
    })
})
