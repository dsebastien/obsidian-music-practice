import { describe, expect, it } from 'bun:test'
import { readChordName, titleOfName } from './chord-name'
import { chordTitle, parseChord, safeTitle } from './chord'

/** The shape values of the Obsidian Starter Kit's guitar chords type. */
const SHAPES = [
    'Open',
    'E-shape barre',
    'A-shape barre',
    'Other barre',
    'Power chord',
    'Triad',
    'Shell',
    'CAGED C',
    'CAGED A',
    'CAGED G',
    'CAGED E',
    'CAGED D'
]

const read = (title: string, shapes: readonly string[] | null = SHAPES) => {
    const reading = readChordName(title, shapes)
    return reading ? [reading.chord.symbol, reading.shape] : null
}

describe('titleOfName', () => {
    it("takes the type's prefix and suffix off a note's name", () => {
        const affixes = { prefix: '', suffix: ' (Guitar Chord)' }
        expect(titleOfName('A Minor 7 - Open (Guitar Chord)', affixes)).toBe('A Minor 7 - Open')
        expect(titleOfName('Chord - Am7', { prefix: 'Chord - ', suffix: '' })).toBe('Am7')
        // A name without them, and a type without any: the name as it is.
        expect(titleOfName('A Minor 7', affixes)).toBe('A Minor 7')
        expect(titleOfName(' A Minor 7 ', null)).toBe('A Minor 7')
    })
})

describe('readChordName', () => {
    it('reads the names the plugin gives its own chord notes', () => {
        for (const [symbol, shape] of [
            ['A', 'Open'],
            ['F#m7', 'E-shape barre'],
            ['Bb', 'A-shape barre'],
            ['C/G', 'Open'],
            ['E5', 'Power chord'],
            ['Bm7b5', 'Shell'],
            ['Ebmaj7', null]
        ] as const) {
            const chord = parseChord(symbol)!
            const title = safeTitle(chordTitle(chord, shape ?? undefined))
            expect(read(title)).toEqual([symbol, shape])
        }
        // A triad's detail and a title made unique stay behind their shape.
        expect(read('G Major - Triad (strings 1-3, 1st inversion)')).toEqual(['G', 'Triad'])
        expect(read('A Major - Open at fret 5')).toEqual(['A', 'Open'])
    })

    it('reads a chord written as a symbol or in words, in any case', () => {
        expect(read('Am7')).toEqual(['Am7', null])
        expect(read('a minor 7 - open')).toEqual(['Am7', 'Open'])
        expect(read('F Sharp Minor 7')).toEqual(['F#m7', null])
        expect(read('C over G – Open')).toEqual(['C/G', 'Open'])
        expect(read('Dsus4 — Open')).toEqual(['Dsus4', 'Open'])
    })

    it('reads a root stuck to its quality, as a template that joins them names the note', () => {
        expect(read('AMinor 7 - Open')).toEqual(['Am7', 'Open'])
        expect(read('C#Minor - A-shape barre')).toEqual(['C#m', 'A-shape barre'])
        expect(read('BbMajor 7 - Shell')).toEqual(['Bbmaj7', 'Shell'])
        expect(read('E5 (Power) - Power chord')).toEqual(['E5', 'Power chord'])
        expect(read('E 5 (Power)')).toEqual(['E5', null])
    })

    it("gives the type's own value for a shape", () => {
        // The library's names reach the type's older ones.
        expect(read('F Major - E shape')).toEqual(['F', 'E-shape barre'])
        expect(read('F Major - caged e')).toEqual(['F', 'CAGED E'])
        // In brackets at the end, only when the type lists it.
        expect(read('A Minor 7 (Open)')).toEqual(['Am7', 'Open'])
        expect(read('A Minor 7 (my favorite)')).toEqual(['Am7', null])
        // A shape the type doesn't list: the chord alone. "Opening" is not "Open".
        expect(read('A Minor 7 - Drop 2')).toEqual(['Am7', null])
        expect(read('A Minor 7 - Opening')).toEqual(['Am7', null])
        // A type that takes any text keeps the shape as written, but not from brackets.
        expect(read('A Minor 7 - Drop 2', [])).toEqual(['Am7', 'Drop 2'])
        expect(read('A Minor 7 (Drop 2)', [])).toEqual(['Am7', null])
        // A type without a shape property.
        expect(read('A Minor 7 - Open', null)).toEqual(['Am7', null])
    })

    it('reads no chord in a name that is not one', () => {
        for (const title of [
            '',
            'Untitled',
            'My favorite chord',
            'Barre chord',
            'E-shape barre',
            'Blues shuffle - Open',
            'Chord 1',
            'Capo 2',
            'Do majeur',
            'Fmaj7 barre'
        ])
            expect(read(title)).toBeNull()
    })
})
