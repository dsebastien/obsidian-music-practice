import { describe, expect, it } from 'bun:test'
import type { EditorPosition } from 'obsidian'
import {
    chordChartOf,
    decodeText,
    fenced,
    insertBlock,
    isChordPro,
    linkableName,
    tabBlockInsertion,
    TAB_STARTER
} from './import.service'
import type { BlockEditor } from './import.service'

describe('fenced', () => {
    it('wraps a block in a fence', () => {
        expect(fenced('tab', ':8 3.3\n')).toBe('```tab\n:8 3.3\n```')
    })

    it('uses a longer fence when the content holds one', () => {
        expect(fenced('chords', '{title: x}\n```\nnot a fence\n```')).toBe(
            '````chords\n{title: x}\n```\nnot a fence\n```\n````'
        )
    })
})

describe('tabBlockInsertion', () => {
    const block = fenced('tab', TAB_STARTER)

    it('puts the block on its own lines on an empty line', () => {
        expect(tabBlockInsertion('', '')).toBe(`${block}\n`)
    })

    it('moves text before and after the cursor to their own lines', () => {
        expect(tabBlockInsertion('Intro: ', '')).toBe(`\n${block}\n`)
        expect(tabBlockInsertion('', ' then the verse')).toBe(`${block}\n\n`)
        expect(tabBlockInsertion('a', 'b')).toBe(`\n${block}\n\n`)
    })

    it('starts the fence at the margin after indentation', () => {
        expect(tabBlockInsertion('    ', '')).toBe(`\n${block}\n`)
    })
})

describe('decodeText', () => {
    it('reads UTF-8, with or without a BOM', () => {
        const text = 'Café [Am]déjà'
        const utf8 = new TextEncoder().encode(text)
        expect(decodeText(utf8)).toBe(text)
        expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe(text)
    })

    it('reads UTF-16 with a BOM', () => {
        const bytes = new Uint8Array([0xff, 0xfe, 0x43, 0x00, 0xe9, 0x00])
        expect(decodeText(bytes)).toBe('Cé')
    })

    /** UTF-16 without a BOM, little- or big-endian. */
    const utf16 = (text: string, order: 'le' | 'be') =>
        new Uint8Array(
            [...Array(text.length).keys()].flatMap((i) => {
                const unit = text.charCodeAt(i)
                return order === 'le' ? [unit & 0xff, unit >> 8] : [unit >> 8, unit & 0xff]
            })
        )

    it('reads Latin UTF-16 without a BOM', () => {
        for (const order of ['le', 'be'] as const) {
            expect(decodeText(utf16('[G]Hello', order))).toBe('[G]Hello')
            expect(decodeText(utf16('{title: Café}\n[Am]déjà vu\n', order))).toBe(
                '{title: Café}\n[Am]déjà vu\n'
            )
        }
    })

    it('reads UTF-16 without a BOM in other scripts', () => {
        const songs = {
            cyrillic:
                '{title: Катюша}\n[Am]Расцветали яблони и груши,\n[E]Поплыли туманы над рекой.\n',
            // Lyrics with few chords: far from half NUL bytes.
            cyrillicLyrics:
                'Расцветали яблони и груши,\nПоплыли туманы над рекой.\nВыходила на берег Катюша\n',
            greek: "{title: Σαν απόψε}\n[Dm]Σαν απόψε θα 'ρθεις [A]πάλι,\nκαι θα μείνεις ως το πρωί\n",
            cjk: '{title: 月亮代表我的心}\n[C]你问我爱你有[E7]多深\n[F]我爱你有几[G]分\n',
            cjkLyrics: '你问我爱你有多深\n我爱你有几分\n我的情也真\n我的爱也真\n',
            japanese: '[C]さくら　さくら\n[Am]やよいの空は\n'
        }
        for (const [name, song] of Object.entries(songs))
            for (const order of ['le', 'be'] as const)
                expect([name, order, decodeText(utf16(song, order))]).toEqual([name, order, song])
    })

    it("says when a file's text can't be read", () => {
        const binary = new Uint8Array(1024).map((_, i) => i % 256)
        expect(() => decodeText(binary)).toThrow("can't be read")
        const png = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x08, 0x06, 0x00, 0x00
        ])
        expect(() => decodeText(png)).toThrow("can't be read")
    })

    it('falls back to Windows-1252 for older files', () => {
        expect(decodeText(new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80]))).toBe('Café €')
    })
})

describe('chord files', () => {
    it('tells ChordPro from a chord sheet', () => {
        expect(isChordPro('{title: Song}\nHello')).toBe(true)
        expect(isChordPro('[G]Hello [D]world')).toBe(true)
        expect(isChordPro('G       D\nHello world')).toBe(false)
    })

    it('reads a letter label alone on its line as a section, not a chord', () => {
        expect(isChordPro('[A]\nC   G\nhello there\n')).toBe(false)
        expect(isChordPro('[G]Hello [D]world')).toBe(true)
    })

    it('reads section labels in brackets as a chord sheet', () => {
        const sheet = '[Verse 1]\nG       D\nHello world\n[Chorus]\nC\nYeah'
        expect(isChordPro(sheet)).toBe(false)
        expect(chordChartOf(sheet)).toContain('{comment: Verse 1}\n[G]Hello wo[D]rld')
    })

    it('makes file names safe for wikilinks', () => {
        expect(linkableName('Riff #1 | live [take 2].gp')).toBe('Riff 1 live take 2.gp')
        expect(linkableName('#.gp')).toBe('Score.gp')
        expect(linkableName('[live].gp')).toBe('live.gp')
    })

    it('keeps ChordPro as it is and converts chords over lyrics', () => {
        expect(chordChartOf('{title: Song}\r\n[G]Hello')).toBe(
            '```chords\n{title: Song}\n[G]Hello\n```'
        )
        expect(chordChartOf('G     D\nHello world')).toBe('```chords\n[G]Hello [D]world\n```')
    })
})

/** A plain-text editor with a cursor (or a selection from `from` to `to`). */
function fakeEditor(text: string, from: EditorPosition, to = from): BlockEditor & { text: string } {
    let selection = { from, to }
    const offset = (lines: string[], pos: EditorPosition) =>
        lines.slice(0, pos.line).reduce((n, l) => n + l.length + 1, 0) + pos.ch
    const editor = {
        text,
        getValue: () => editor.text,
        getLine: (line: number) => editor.text.split('\n')[line] ?? '',
        getCursor: (which?: string) => (which === 'to' ? selection.to : selection.from),
        setCursor: (pos: EditorPosition | number, ch?: number) => {
            const at = typeof pos === 'number' ? { line: pos, ch: ch ?? 0 } : pos
            selection = { from: at, to: at }
        },
        replaceRange: (replacement: string, start: EditorPosition, end?: EditorPosition) => {
            const lines = editor.text.split('\n')
            const a = offset(lines, start)
            const b = end ? offset(lines, end) : a
            editor.text = editor.text.slice(0, a) + replacement + editor.text.slice(b)
        },
        replaceSelection: (replacement: string) =>
            editor.replaceRange(replacement, selection.from, selection.to)
    }
    return editor
}

describe('insertBlock', () => {
    const note = '# Song\n## Tab\n```tab\n```\n## Chart\n```chords\n```\n'
    const tab = '```tab\nfile: [[Song.gp]]\n```'

    it('fills the empty block of the same kind the cursor is in, for imports', () => {
        const editor = fakeEditor(note, { line: 3, ch: 0 })
        insertBlock(editor, tab, { fill: true })
        expect(editor.text).toBe(
            '# Song\n## Tab\n```tab\nfile: [[Song.gp]]\n```\n## Chart\n```chords\n```\n'
        )
    })

    it('puts the block after a block of another kind, or without fill', () => {
        const chart = fakeEditor(note, { line: 6, ch: 0 })
        insertBlock(chart, tab, { fill: true })
        expect(chart.text).toBe(
            `# Song\n## Tab\n\`\`\`tab\n\`\`\`\n## Chart\n\`\`\`chords\n\`\`\`\n${tab}\n\n`
        )
        const plain = fakeEditor(note, { line: 2, ch: 2 })
        insertBlock(plain, tab)
        expect(plain.text).toBe(
            `# Song\n## Tab\n\`\`\`tab\n\`\`\`\n${tab}\n\n## Chart\n\`\`\`chords\n\`\`\`\n`
        )
    })

    it('puts the block at the cursor elsewhere', () => {
        const editor = fakeEditor(note, { line: 0, ch: 6 })
        insertBlock(editor, tab, { fill: true })
        expect(editor.text.startsWith(`# Song\n${tab}\n\n## Tab`)).toBe(true)
    })
})
