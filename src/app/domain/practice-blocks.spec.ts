import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import {
    arpeggioSource,
    cagedShape,
    practiceBlockSource,
    strumSource,
    swingOf
} from './practice-blocks'

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

describe('swingOf', () => {
    it('reads a feel as the strum block swing', () => {
        expect(swingOf('swing')).toBe('yes')
        expect(swingOf('Shuffle')).toBe('yes')
        expect(swingOf('swung 8ths')).toBe('yes')
        expect(swingOf('60%')).toBe('60%')
        expect(swingOf('straight')).toBeNull()
        expect(swingOf('')).toBeNull()
    })
})

describe('strumSource (#58)', () => {
    it("draws a strumming pattern note's pattern with its time signature, feel and tempo", () => {
        const props = {
            strum_pattern: 'D DU UDU',
            time_signature: '4/4',
            strum_feel: 'swing',
            bpm_current: 80
        }
        expect(strumSource(props, fields)).toBe('D DU UDU\ntime: 4/4\nswing: yes\ntempo: 80')
    })

    it('draws one bar per line from a list, and the chord when the note has one', () => {
        const props = {
            strum_pattern: ['D - - D - -', 'D - U D - U'],
            time_signature: '6/8',
            chord_symbol: 'A Minor'
        }
        expect(strumSource(props, fields)).toBe('D - - D - -\nD - U D - U\ntime: 6/8\nchord: Am')
    })

    it('leaves out values the block would not read', () => {
        const props = {
            strum_pattern: 'D D D D',
            time_signature: 'four four',
            strum_feel: 'laid back',
            bpm_current: 400
        }
        expect(strumSource(props, fields)).toBe('D D D D')
    })

    it('draws nothing without a pattern', () => {
        expect(strumSource({ time_signature: '4/4' }, fields)).toBeNull()
        expect(strumSource({ strum_pattern: '  ' }, fields)).toBeNull()
    })

    it('is the source of an empty strum block, whatever the kind', () => {
        const props = { strum_pattern: 'DDUUDU' }
        expect(practiceBlockSource('strum', props, fields, 'exercise', 'guitar')).toBe('DDUUDU')
        expect(practiceBlockSource('strum', {}, fields, 'exercise', 'guitar')).toBeNull()
    })
})
