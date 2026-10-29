import { describe, expect, it } from 'bun:test'
import { generateVoicings } from '@dsebastien/music-notation'
import {
    DEFAULT_VOICING_FILTER,
    fretsOfProperty,
    sameFrets,
    shapeConflict,
    shapeValue,
    voicingLabel,
    voicingNoteTitle,
    voicingOptions
} from './voicings'

describe('voicingOptions', () => {
    it('passes nothing for the default filter', () => {
        expect(voicingOptions(DEFAULT_VOICING_FILTER)).toEqual({})
    })

    it('maps every filter to the library options', () => {
        expect(
            voicingOptions({ area: '5-9', rootString: 6, inversions: true, stretch: true })
        ).toEqual({ area: [5, 9], bassString: 6, inversion: 'any', maxSpan: 5 })
        expect(voicingOptions({ ...DEFAULT_VOICING_FILTER, area: 'open' })).toEqual({
            area: 'open'
        })
    })

    it('filters what the library returns', () => {
        const list = generateVoicings(
            'A',
            voicingOptions({ ...DEFAULT_VOICING_FILTER, rootString: 6 })
        )
        expect(list.length).toBeGreaterThan(0)
        expect(list.every((v) => v.bassString === 6)).toBe(true)
    })
})

describe('shapeValue', () => {
    it("matches the note type's own values, whatever the case", () => {
        expect(shapeValue('E-shape barre', ['Open', 'E-shape barre'])).toBe('E-shape barre')
        expect(shapeValue('Open', ['open', 'barre'])).toBe('open')
        expect(shapeValue('CAGED C', ['Open'])).toBeNull()
        expect(shapeValue(null, ['Open'])).toBeNull()
    })

    it("takes the library's name when the type takes any text", () => {
        expect(shapeValue('Triad', [])).toBe('Triad')
    })
})

describe('voicingNoteTitle', () => {
    const voicing = { frets: [5, 7, 7, 6, 5, 5], baseFret: 5 }
    it('keeps the usual title when it is free', () => {
        expect(voicingNoteTitle('A Major - E-shape barre', voicing, () => false)).toBe(
            'A Major - E-shape barre'
        )
    })

    it('adds the fret when the usual title is taken, and gives up after', () => {
        const taken = new Set(['A Major'])
        expect(voicingNoteTitle('A Major', voicing, (t) => taken.has(t))).toBe('A Major at fret 5')
        taken.add('A Major at fret 5')
        expect(voicingNoteTitle('A Major', voicing, (t) => taken.has(t))).toBeNull()
    })
})

describe('helpers', () => {
    it('compares frets string by string', () => {
        expect(sameFrets([null, 0, 2], [null, 0, 2])).toBe(true)
        expect(sameFrets([null, 0, 2], [0, 0, 2])).toBe(false)
        expect(sameFrets([0, 2], [0, 2, 2])).toBe(false)
    })

    it('reads frets stored as text or as a YAML number', () => {
        expect(fretsOfProperty('x02220')).toEqual([null, 0, 2, 2, 2, 0])
        expect(fretsOfProperty(22100)).toEqual([0, 2, 2, 1, 0, 0])
        expect(fretsOfProperty('x-10-12-12-11-10')).toEqual([null, 10, 12, 12, 11, 10])
        expect(fretsOfProperty('')).toBeNull()
        expect(fretsOfProperty(null)).toBeNull()
    })

    it('labels voicings by shape, else by fret', () => {
        const [open] = generateVoicings('C')
        expect(voicingLabel(open!, 1)).toBe('1. Open')
        const unnamed = generateVoicings('C').filter((v) => v.shape === null)
        expect(unnamed.length).toBeGreaterThan(0)
        for (const v of unnamed) expect(voicingLabel(v, 3)).toBe(`3. ${v.baseFret}fr`)
    })
})

describe('shapeConflict', () => {
    it('lets a note take any voicing of its own shape, or any when it has none', () => {
        expect(shapeConflict('Open', 'Open')).toBeNull()
        expect(shapeConflict('open', 'Open')).toBeNull()
        expect(shapeConflict('', 'E-shape barre')).toBeNull()
        expect(shapeConflict('  ', null)).toBeNull()
    })

    it('sends another shape to its own note', () => {
        expect(shapeConflict('Open', 'E-shape barre')).toBe(
            'This note is the Open shape: add the E-shape barre as its own note.'
        )
        expect(shapeConflict('Open', null)).toBe(
            'This note is the Open shape: add this voicing as its own note.'
        )
    })
})
