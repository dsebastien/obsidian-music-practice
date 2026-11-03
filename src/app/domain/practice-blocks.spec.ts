import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import { arpeggioSource, cagedShape, practiceBlockSource } from './practice-blocks'

const fields = createDefaultFieldNames()

describe('cagedShape', () => {
    it('reads the CAGED letter of a shape value', () => {
        expect(cagedShape('E')).toBe('E')
        expect(cagedShape('CAGED A')).toBe('A')
        expect(cagedShape('g shape')).toBe('G')
        expect(cagedShape('E-shape barre')).toBe('E')
        expect(cagedShape(['D'])).toBe('D')
    })

    it('reads nothing from other shapes', () => {
        expect(cagedShape('Open')).toBeNull()
        expect(cagedShape('Triad')).toBeNull()
        expect(cagedShape('3NPS')).toBeNull()
        expect(cagedShape('')).toBeNull()
        expect(cagedShape(undefined)).toBeNull()
    })
})

describe('arpeggioSource (#56)', () => {
    it("draws an arpeggio note's chord in its CAGED shape on a fretboard", () => {
        const props = { chord_symbol: 'A Minor 7', shape: 'CAGED E' }
        expect(arpeggioSource('fretboard', props, fields, 'arpeggio', 'guitar')).toBe(
            'arpeggio: Am7\nshape: E'
        )
    })

    it('draws the whole neck without a CAGED shape', () => {
        const props = { chord_symbol: 'G7', shape: 'Open' }
        expect(arpeggioSource('fretboard', props, fields, 'arpeggio', 'guitar')).toBe(
            'arpeggio: G7'
        )
    })

    it('draws piano arpeggios on a keyboard, without a shape', () => {
        const props = { chord_symbol: 'Cmaj7', shape: 'E' }
        expect(arpeggioSource('keyboard', props, fields, 'arpeggio', 'piano')).toBe(
            'arpeggio: Cmaj7'
        )
        expect(arpeggioSource('fretboard', props, fields, 'arpeggio', 'piano')).toBeNull()
    })

    it("draws a guitar chord note's arpeggio in its empty fretboard, not in other blocks", () => {
        const props = { chord_symbol: 'C', shape: 'A', frets: 'x35553' }
        expect(arpeggioSource('fretboard', props, fields, 'chord', 'guitar')).toBe(
            'arpeggio: C\nshape: A'
        )
        expect(arpeggioSource('chord', props, fields, 'chord', 'guitar')).toBeNull()
        expect(arpeggioSource('keyboard', props, fields, 'chord', 'piano')).toBeNull()
    })

    it('leaves scales, unknown chords and other kinds to the library', () => {
        expect(
            arpeggioSource('fretboard', { scale_root: 'A' }, fields, 'scale', 'guitar')
        ).toBeNull()
        expect(
            arpeggioSource('fretboard', { chord_symbol: 'Hmaj' }, fields, 'arpeggio', 'guitar')
        ).toBeNull()
        expect(arpeggioSource('fretboard', {}, fields, 'arpeggio', 'guitar')).toBeNull()
        expect(
            practiceBlockSource('fretboard', { chord_symbol: 'C' }, fields, 'exercise', 'guitar')
        ).toBeNull()
    })

    it('uses the configured property names', () => {
        const custom = { ...fields, chordSymbol: 'mp_chord', shape: 'mp_shape' }
        expect(
            arpeggioSource(
                'fretboard',
                { mp_chord: 'D', mp_shape: 'C' },
                custom,
                'arpeggio',
                'guitar'
            )
        ).toBe('arpeggio: D\nshape: C')
    })
})
