import { describe, expect, it } from 'bun:test'
import { chordTitle, parseChord, safeTitle } from './chord'

describe('parseChord', () => {
    it('spells chord symbols out in ASCII', () => {
        expect(parseChord('F#m7')).toMatchObject({
            root: 'F#',
            quality: 'Minor 7',
            name: 'F Sharp Minor 7'
        })
        expect(parseChord('A')?.name).toBe('A Major')
        expect(parseChord('Bb7')?.name).toBe('B Flat 7')
        expect(parseChord('C/G')).toMatchObject({ bass: 'G', name: 'C Major over G' })
        expect(parseChord('E5')?.name).toBe('E 5')
        expect(parseChord('Bm7b5')?.quality).toBe('Minor 7 flat 5')
    })

    it('rejects what is not a chord symbol', () => {
        expect(parseChord('Hello')).toBeNull()
        expect(parseChord('Cxyz')).toBeNull()
    })

    it('builds voicing titles and safe names', () => {
        expect(chordTitle(parseChord('A')!, 'Open')).toBe('A Major - Open')
        expect(safeTitle('Knockin/on #1')).toBe('Knockin on 1')
    })
})
