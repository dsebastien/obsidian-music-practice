import { describe, expect, it } from 'bun:test'
import { generateVoicings } from '@dsebastien/music-notation'
import {
    DEFAULT_VOICING_FILTER,
    hasBarre,
    fretsOfProperty,
    sameFrets,
    shapeText,
    voicingConflict,
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
        expect(shapeValue('E shape', ['Open', 'E shape'])).toBe('E shape')
        expect(shapeValue('Open', ['open', 'barre'])).toBe('open')
        expect(shapeValue('C shape', ['Open'])).toBeNull()
    })

    it('matches the older names a note type may list (before music-notation 0.9)', () => {
        const types = ['Open', 'E-shape barre', 'A-shape barre', 'CAGED C', 'CAGED G', 'CAGED D']
        expect(shapeValue('E shape', types)).toBe('E-shape barre')
        expect(shapeValue('A shape', types)).toBe('A-shape barre')
        expect(shapeValue('C shape', types)).toBe('CAGED C')
        expect(shapeValue('D shape', ['caged d'])).toBe('caged d')
        // A partial E shape (no barre) is CAGED E; a full one, the barre chord.
        expect(shapeValue('E shape', types, false)).toBe('E-shape barre') // no CAGED E listed
        expect(shapeValue('E shape', [...types, 'CAGED E'], false)).toBe('CAGED E')
        expect(shapeValue('E shape', [...types, 'CAGED E'], true)).toBe('E-shape barre')
        expect(hasBarre([1, 3, 4, 2, 1, 1])).toBe(true)
        expect(hasBarre([null, 3, 4, 2, null, null])).toBe(false)
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
        // Since music-notation 0.11 every voicing of a known chord has a name (#72).
        for (const v of generateVoicings('C')) expect(voicingLabel(v, 2)).toBe(`2. ${v.shape}`)
        const unnamed = { ...generateVoicings('C')[0]!, shape: null, baseFret: 5 }
        expect(voicingLabel(unnamed, 3)).toBe('3. 5fr')
    })
})

describe('voicingConflict', () => {
    const a = generateVoicings('A')
    const open = a.find((v) => v.shape === 'Open')!
    const eShape = a.find((v) => v.shape === 'E shape')!
    const otherOpen = { ...open, frets: [null, 0, 2, 2, 2, null] }
    const base = { fretsShape: null, shape: '', voicingShape: null }

    it("takes the note's own voicing and other fingerings of its shape", () => {
        expect(
            voicingConflict({ ...base, frets: open.frets, fretsShape: 'Open', voicing: open })
        ).toBeNull()
        const sameShape = { ...eShape, frets: [...eShape.frets] }
        expect(
            voicingConflict({
                ...base,
                frets: [5, 7, 7, 6, 5, null],
                fretsShape: 'E shape',
                voicing: sameShape
            })
        ).toBeNull()
        expect(
            voicingConflict({
                ...base,
                frets: null,
                shape: 'Open',
                voicingShape: 'Open',
                voicing: otherOpen
            })
        ).toBeNull()
    })

    it('compares the shapes of the frets, not the note type values', () => {
        // A type whose only barre value is "Barre": the note's own E-shape stays allowed.
        expect(
            voicingConflict({
                frets: eShape.frets,
                fretsShape: 'E shape',
                shape: 'Barre',
                voicing: eShape,
                voicingShape: null
            })
        ).toBeNull()
    })

    it('sends another shape to its own note, even when the note has no shape property', () => {
        expect(
            voicingConflict({ ...base, frets: open.frets, fretsShape: 'Open', voicing: eShape })
        ).toBe('This note is the Open shape: add the E shape as its own note.')
        expect(
            voicingConflict({
                ...base,
                frets: null,
                shape: 'Open',
                voicingShape: 'E shape',
                voicing: eShape
            })
        ).toBe('This note is the Open shape: add the E shape as its own note.')
    })

    it('lets a note with neither frets nor shape take any voicing', () => {
        expect(voicingConflict({ ...base, frets: null, voicing: eShape })).toBeNull()
    })
})

describe('shapeText', () => {
    it('reads text or the first of a list', () => {
        expect(shapeText(' Open ')).toBe('Open')
        expect(shapeText(['Open', 'Barre'])).toBe('Open')
        expect(shapeText(null)).toBe('')
        expect(shapeText(3)).toBe('')
    })
})
