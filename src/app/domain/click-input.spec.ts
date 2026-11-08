import { describe, expect, it } from 'bun:test'
import {
    afterPick,
    chosen,
    nearTargets,
    readValue,
    textOfValue,
    valueOfText,
    type ClickValue,
    formatKeys,
    nearMarks,
    nearMatches,
    parseKeys,
    pitchesOfFrets,
    toggleFret,
    toggleKey
} from './click-input'

const MUTED = [null, null, null, null, null, null]

describe('click input: frets and keys', () => {
    it('sets a string to the fret clicked (string 1 is the highest), and mutes it on a second click', () => {
        const c = toggleFret(MUTED, 5, 3)
        expect(c).toEqual([null, 3, null, null, null, null])
        expect(toggleFret(c, 5, 3)).toEqual(MUTED)
        expect(toggleFret(c, 5, 0)).toEqual([null, 0, null, null, null, null])
        expect(toggleFret([0, 2, 2, 1, 0, 0], 1, 3)).toEqual([0, 2, 2, 1, 0, 3])
        // Any length given is read as six strings; the input is never changed.
        expect(toggleFret([], 6, 1)).toEqual([1, null, null, null, null, null])
        expect(c).toEqual([null, 3, null, null, null, null])
    })

    it('toggles keys, low to high, each once', () => {
        expect(toggleKey([64, 60], 67)).toEqual([60, 64, 67])
        expect(toggleKey([60, 64, 67], 64)).toEqual([60, 67])
    })

    it('gives the sounding pitches of frets, low to high', () => {
        expect(pitchesOfFrets([null, 3, 2, 0, 1, 0])).toEqual([48, 52, 55, 60, 64])
        expect(pitchesOfFrets(MUTED)).toEqual([])
    })

    it('reads and writes key lists', () => {
        expect(parseKeys('C4 E4 G4')).toEqual([60, 64, 67])
        expect(parseKeys('G4, C4  Eb4')).toEqual([60, 63, 67])
        expect(parseKeys('C E G')).toBeNull()
        expect(parseKeys('')).toBeNull()
        expect(parseKeys('C4 X4')).toBeNull()
        expect(formatKeys([60, 63, 67])).toBe('C4 D#4 G4')
        expect(formatKeys([])).toBe('')
    })
})

describe('click input: near matches', () => {
    it('lists the chords that hold every note, fewest missing first, at most 6', () => {
        // C and E: C (G missing) and Am (A missing) and others.
        const matches = nearMatches([60, 64])
        expect(matches.length).toBe(6)
        expect(matches[0]).toEqual({ symbol: 'C', missing: ['G'], missingClasses: [7] })
        for (let i = 1; i < matches.length; i++)
            expect(matches[i]!.missing.length).toBeGreaterThanOrEqual(
                matches[i - 1]!.missing.length
            )
        for (const m of matches) expect(m.missing.length).toBeGreaterThan(0)
    })

    it('puts chords on the lowest note first among equals, and spells missing notes as the chord does', () => {
        // F A: F (C missing) before Dm (D missing).
        const matches = nearMatches([53, 57])
        expect(matches[0]!.symbol).toBe('F')
        const bb = nearMatches([62, 65]).find((m) => m.symbol === 'Bb')
        expect(bb?.missing).toEqual(['Bb'])
    })

    it('needs two different notes', () => {
        expect(nearMatches([60])).toEqual([])
        expect(nearMatches([60, 72])).toEqual([])
        expect(nearMatches([])).toEqual([])
    })

    it('marks missing notes on the muted strings, around the fretted notes', () => {
        // D open, A on the G string (fret 2): F# missing. Fretted around fret 2: frets 0-4 on the
        // muted strings (6, 5, 2, 1): F# at fret 2 on both E strings.
        expect(nearMarks([null, null, 0, 2, null, null], [6])).toEqual([
            { string: 1, fret: 2 },
            { string: 6, fret: 2 }
        ])
        // Fretted higher up: 2 frets around them. A at fret 7 on the D string (x x 7 x x x), C#
        // missing, frets 5-9: string 1 fret 9, string 3 fret 6, string 6 fret 9 (string 5's
        // fret 4 and string 2's fret 2 are out of the window).
        expect(nearMarks([null, null, 7, null, null, null], [1])).toEqual([
            { string: 1, fret: 9 },
            { string: 3, fret: 6 },
            { string: 6, fret: 9 }
        ])
        // Nothing to mark without a muted string.
        expect(nearMarks([0, 2, 2, 1, 0, 0], [6])).toEqual([])
    })
})

describe('click input: the value and the drawing', () => {
    it('applies a pick to frets or keys', () => {
        const frets: ClickValue = { kind: 'frets', frets: MUTED }
        expect(afterPick(frets, { string: 5, fret: 3, pitch: 48 })).toEqual({
            kind: 'frets',
            frets: [null, 3, null, null, null, null]
        })
        // A pick without a string (a key) leaves frets alone.
        expect(afterPick(frets, { string: null, fret: null, pitch: 48 })).toEqual(frets)
        const keys: ClickValue = { kind: 'keys', keys: [60] }
        expect(afterPick(keys, { string: null, fret: null, pitch: 64 })).toEqual({
            kind: 'keys',
            keys: [60, 64]
        })
    })

    it('says which targets are chosen', () => {
        expect(chosen({ kind: 'frets', frets: [null, 3, 2, 0, 1, 0] })).toEqual([
            { string: 5, fret: 3 },
            { string: 4, fret: 2 },
            { string: 3, fret: 0 },
            { string: 2, fret: 1 },
            { string: 1, fret: 0 }
        ])
        expect(chosen({ kind: 'keys', keys: [60, 64] })).toEqual([{ pitch: 60 }, { pitch: 64 }])
    })

    it('reads the chord, else the near matches', () => {
        expect(readValue({ kind: 'frets', frets: [null, 3, 2, 0, 1, 0] }).detected?.symbol).toBe(
            'C'
        )
        const open = readValue({ kind: 'frets', frets: [null, 3, 2, null, null, null] })
        expect(open.detected).toBeNull()
        expect(open.near[0]?.symbol).toBe('C')
        expect(readValue({ kind: 'keys', keys: [60, 64, 67] }).detected?.symbol).toBe('C')
        expect(readValue({ kind: 'keys', keys: [] })).toEqual({ detected: null, near: [] })
    })

    it('marks a near match on the keys of its missing notes, in the range', () => {
        expect(nearTargets({ kind: 'keys', keys: [60, 64] }, [7], [48, 71])).toEqual([
            { pitch: 55 },
            { pitch: 67 }
        ])
        expect(
            nearTargets({ kind: 'frets', frets: [null, null, 0, 2, null, null] }, [6], [0, 12])
        ).toEqual([
            { string: 1, fret: 2 },
            { string: 6, fret: 2 }
        ])
    })

    it('reads the value from the text field and writes it back', () => {
        expect(valueOfText('x32010', 'guitar')).toEqual({
            kind: 'frets',
            frets: [null, 3, 2, 0, 1, 0]
        })
        expect(valueOfText('Am7', 'guitar')).toEqual({ kind: 'frets', frets: MUTED })
        expect(valueOfText('C4 E4', 'piano')).toEqual({ kind: 'keys', keys: [60, 64] })
        expect(valueOfText('Cmaj7', 'piano')).toEqual({ kind: 'keys', keys: [] })
        expect(textOfValue({ kind: 'frets', frets: [null, 3, 2, 0, 1, 0] })).toBe('x32010')
        expect(textOfValue({ kind: 'frets', frets: MUTED })).toBe('')
        expect(textOfValue({ kind: 'keys', keys: [60, 64] })).toBe('C4 E4')
    })
})
