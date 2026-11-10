import { describe, expect, it } from 'bun:test'
import {
    blockImageName,
    imageFileName,
    numberedPath,
    parseImageFolder,
    safeName,
    withEmbedAfter
} from './diagram-images'

describe('safeName', () => {
    it('spells sharps and flats after a note letter, as drill note names do', () => {
        expect(safeName('F#m7')).toBe('F Sharp m7')
        expect(safeName('C♯ major')).toBe('C Sharp major')
        expect(safeName('B♭7')).toBe('B Flat 7')
        expect(safeName('Bb7')).toBe('Bb7')
    })

    it('turns characters file names refuse into spaces, and collapses spaces', () => {
        expect(safeName('A/C#: [x] | y?')).toBe('A C Sharp x y')
        expect(safeName('a\\b*c"d<e>f^g#h')).toBe('a b c d e f g h')
        expect(safeName('  Am7   chord  ')).toBe('Am7 chord')
    })

    it('is never empty and never longer than 120 characters', () => {
        expect(safeName('///')).toBe('Diagram')
        expect(safeName('')).toBe('Diagram')
        expect(safeName('x'.repeat(300)).length).toBe(120)
    })
})

describe('imageFileName', () => {
    it('is the note name, then what it shows, with the extension', () => {
        expect(imageFileName('Wonderwall', 'Em7', 'png')).toBe('Wonderwall - Em7.png')
        expect(imageFileName('Song (Guitar Arrangement)', 'F#m7', 'svg')).toBe(
            'Song (Guitar Arrangement) - F Sharp m7.svg'
        )
    })

    it('leaves the note name out when there is none', () => {
        expect(imageFileName('', 'C', 'png')).toBe('C.png')
    })
})

describe('blockImageName', () => {
    it('joins the titles of its diagrams, three at most', () => {
        expect(blockImageName(['C', 'G', 'D'], 'chord')).toBe('C, G, D')
        expect(blockImageName(['C', 'G', 'D', 'Em'], 'chord')).toBe('C, G, D…')
    })

    it('names the language when no diagram has a title', () => {
        expect(blockImageName([], 'chords')).toBe('chords block')
        expect(blockImageName(['', '  '], 'strum')).toBe('strum block')
    })
})

describe('parseImageFolder', () => {
    it('reads empty as the attachment location', () => {
        expect(parseImageFolder('')).toEqual({ ok: true, value: '' })
        expect(parseImageFolder('  / ')).toEqual({ ok: true, value: '' })
    })

    it('keeps a vault folder in normal form', () => {
        expect(parseImageFolder('Music/Images')).toEqual({ ok: true, value: 'Music/Images' })
        expect(parseImageFolder(' /Music//Images/ ')).toEqual({ ok: true, value: 'Music/Images' })
        expect(parseImageFolder('Music\\Images')).toEqual({ ok: true, value: 'Music/Images' })
    })

    it('refuses paths that leave the vault or that file systems refuse', () => {
        for (const bad of ['../Images', 'Music/../x', './Images', 'C:/Images', 'Img?', 'A|B']) {
            const parsed = parseImageFolder(bad)
            expect(parsed.ok).toBe(false)
        }
    })
})

describe('numberedPath', () => {
    it('is the name itself when free', () => {
        expect(numberedPath('Images', 'Song - C', 'png', () => false)).toBe('Images/Song - C.png')
    })

    it('numbers the name as Obsidian does when it is taken', () => {
        const taken = new Set(['Images/Song - C.png', 'Images/Song - C 1.png'])
        expect(numberedPath('Images', 'Song - C', 'png', (p) => taken.has(p))).toBe(
            'Images/Song - C 2.png'
        )
    })

    it('works at the vault root', () => {
        expect(numberedPath('', 'C', 'svg', () => false)).toBe('C.svg')
    })
})

describe('withEmbedAfter', () => {
    const note = ['# Song', '', '```chord', 'G', '```', 'After'].join('\n')
    const section = { text: note, lineStart: 2, lineEnd: 4 }

    it('puts the link on its own line right after the closing fence', () => {
        expect(withEmbedAfter(note, section, '![[Song - G.png]]')).toBe(
            ['# Song', '', '```chord', 'G', '```', '![[Song - G.png]]', 'After'].join('\n')
        )
    })

    it('works for a block at the end of the note', () => {
        const end = ['```chord', 'G', '```'].join('\n')
        expect(withEmbedAfter(end, { text: end, lineStart: 0, lineEnd: 2 }, '![[x.png]]')).toBe(
            ['```chord', 'G', '```', '![[x.png]]'].join('\n')
        )
    })

    it('refuses when the block moved or changed since it was drawn', () => {
        const moved = ['# Song', 'new line', '', '```chord', 'G', '```'].join('\n')
        expect(withEmbedAfter(moved, section, '![[x.png]]')).toBeNull()
        const edited = note.replace('\nG\n', '\nD\n')
        expect(withEmbedAfter(edited, section, '![[x.png]]')).toBeNull()
    })

    it('refuses when the section does not end with a fence', () => {
        const odd = ['```chord', 'G'].join('\n')
        expect(
            withEmbedAfter(odd, { text: odd, lineStart: 0, lineEnd: 1 }, '![[x.png]]')
        ).toBeNull()
    })

    it('keeps Windows line ends', () => {
        const crlf = ['```chord', 'G', '```', 'After'].join('\r\n')
        expect(withEmbedAfter(crlf, { text: crlf, lineStart: 0, lineEnd: 2 }, '![[x.png]]')).toBe(
            ['```chord', 'G', '```', '![[x.png]]', 'After'].join('\r\n')
        )
    })
})
