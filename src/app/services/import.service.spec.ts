import { describe, expect, it } from 'bun:test'
import {
    chordChartOf,
    decodeText,
    fenced,
    isChordPro,
    linkableName,
    tabBlockInsertion,
    TAB_STARTER
} from './import.service'

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

    it('reads UTF-16 without a BOM', () => {
        const le = new Uint8Array([...'[G]Hello'].flatMap((c) => [c.charCodeAt(0), 0]))
        expect(decodeText(le)).toBe('[G]Hello')
        const be = new Uint8Array([...'[G]Hello'].flatMap((c) => [0, c.charCodeAt(0)]))
        expect(decodeText(be)).toBe('[G]Hello')
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
