import { describe, expect, it } from 'bun:test'
import {
    NAMING_LABELS,
    choiceShown,
    chordShown,
    expectedShown,
    noteShown,
    promptShown,
    scaleShown,
    spotShown
} from './note-names'
import type { Question } from './note-drill'

describe('noteShown', () => {
    it('shows a note in the naming, with or without its octave', () => {
        expect(noteShown('C', 'solfege')).toBe('Do')
        expect(noteShown('A#', 'solfege')).toBe('La♯')
        expect(noteShown('A#3', 'solfege')).toBe('La♯3')
        expect(noteShown('Bb', 'solfege')).toBe('Si♭')
        expect(noteShown('B', 'german')).toBe('H')
        expect(noteShown('Bb3', 'german')).toBe('B3')
        expect(noteShown('F#4', 'german')).toBe('F#4')
    })

    it('leaves letters, and what is not a note, as written', () => {
        expect(noteShown('C#', 'letters')).toBe('C#')
        expect(noteShown('A#3', 'letters')).toBe('A#3')
        expect(noteShown('s5f3', 'solfege')).toBe('s5f3')
        expect(noteShown('', 'solfege')).toBe('')
    })
})

describe('chordShown and scaleShown', () => {
    it('shows a chord symbol in the naming', () => {
        expect(chordShown('Dm7', 'solfege')).toBe('Ré m7')
        expect(chordShown('G/B', 'solfege')).toBe('Sol/Si')
        expect(chordShown('B7', 'german')).toBe('H7')
        expect(chordShown('Cmaj7', 'letters')).toBe('Cmaj7')
    })

    it('shows a scale by its root, the type in words as written', () => {
        expect(scaleShown('A minor pentatonic', 'solfege')).toBe('La minor pentatonic')
        expect(scaleShown('F# harmonic minor', 'solfege')).toBe('Fa♯ harmonic minor')
        expect(scaleShown('B dorian', 'german')).toBe('H dorian')
        expect(scaleShown('Bb major', 'german')).toBe('B major')
        expect(scaleShown('C major', 'letters')).toBe('C major')
        expect(scaleShown('pentatonic', 'solfege')).toBe('pentatonic')
    })
})

const fret = (note: string): Question => ({
    type: 'find-fret',
    spot: 's5f0',
    prompt: `Find ${note} on string 5`,
    string: 5,
    pitch: 45,
    note
})

describe('promptShown', () => {
    it('builds find questions from their parts, never by rewriting the English prompt', () => {
        // "A" before "on" would stay an English article in a rewritten text.
        expect(promptShown(fret('A'), 'solfege')).toBe('Find La on string 5')
        expect(promptShown(fret('B'), 'german')).toBe('Find H on string 5')
        expect(
            promptShown(
                { type: 'find-key', spot: 'A#3', prompt: 'Find A#3', pitch: 58, note: 'A#' },
                'solfege'
            )
        ).toBe('Find La♯3')
        expect(
            promptShown(
                {
                    type: 'find-scale',
                    spot: 'A minor pentatonic',
                    prompt: 'Find the notes of A minor pentatonic',
                    classes: [9, 0, 2, 4, 7]
                },
                'solfege'
            )
        ).toBe('Find the notes of La minor pentatonic')
    })

    it('keeps the prompt in letters, and prompts with no name', () => {
        expect(promptShown(fret('A'), 'letters')).toBe('Find A on string 5')
        expect(
            promptShown(
                { type: 'name-chord', spot: 'C', prompt: 'Name this chord', choices: ['C'] },
                'solfege'
            )
        ).toBe('Name this chord')
    })
})

describe('expectedShown, choiceShown and spotShown', () => {
    it('says the right answer in the naming', () => {
        expect(expectedShown(fret('B'), 'german')).toBe('H')
        expect(
            expectedShown(
                { type: 'name-key', spot: 'C4', prompt: '', pitch: 60, note: 'C' },
                'solfege'
            )
        ).toBe('Do')
        expect(
            expectedShown({ type: 'name-chord', spot: 'Bb', prompt: '', choices: [] }, 'german')
        ).toBe('B')
        expect(
            expectedShown(
                { type: 'name-scale', spot: 'C major', prompt: '', choices: [] },
                'solfege'
            )
        ).toBe('Do major')
    })

    it('shows the choices of chord and scale questions', () => {
        const chord: Question = { type: 'name-chord', spot: 'Dm7', prompt: '', choices: [] }
        const scale: Question = { type: 'name-scale', spot: 'D dorian', prompt: '', choices: [] }
        expect(choiceShown(chord, 'Dm7', 'solfege')).toBe('Ré m7')
        expect(choiceShown(scale, 'D dorian', 'solfege')).toBe('Ré dorian')
        expect(choiceShown(chord, 'Dm7', 'letters')).toBe('Dm7')
    })

    it('shows the spots of the weak-spot map by the drill kind', () => {
        expect(spotShown('keyboard', 'F#4', 'solfege')).toBe('Fa♯4')
        expect(spotShown('chords', 'B7', 'german')).toBe('H7')
        expect(spotShown('scales', 'B minor', 'german')).toBe('H minor')
        expect(spotShown('fretboard', 'C', 'solfege')).toBe('Do')
    })
})

describe('NAMING_LABELS', () => {
    it('names the three namings for the settings', () => {
        expect(Object.keys(NAMING_LABELS)).toEqual(['letters', 'solfege', 'german'])
    })
})
