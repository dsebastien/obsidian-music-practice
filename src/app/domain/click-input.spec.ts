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
    toggleKey,
    typedKeysOf,
    spellKeys,
    namedNoteChanges,
    clickHint
} from './click-input'
import { createDefaultFieldNames } from './fields'

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

describe('click input: review findings', () => {
    it('reads one token as a chord first: G7 or C7 is a chord, not a key (1)', () => {
        expect(typedKeysOf('C7')).toBeNull()
        expect(typedKeysOf('G7')).toBeNull()
        expect(typedKeysOf('Bb7')).toBeNull()
        expect(valueOfText('C7', 'piano')).toEqual({ kind: 'keys', keys: [] })
        expect(valueOfText('E9', 'piano')).toEqual({ kind: 'keys', keys: [] })
        // Two tokens or more are keys; one that no chord reads is a key.
        expect(typedKeysOf('C4 E4')).toEqual([60, 64])
        expect(typedKeysOf('G#3')).toEqual([56])
        expect(typedKeysOf('Am7')).toBeNull()
    })

    it('lists each set of notes once, the chord on the bass first, then the family order (2)', () => {
        const sets = (pitches: number[]) =>
            nearMatches(pitches).map((m) =>
                [...new Set([...m.missingClasses, ...pitches.map((p) => p % 12)])]
                    .sort((a, b) => a - b)
                    .join(' ')
            )
        for (const pitches of [
            [60, 68],
            [62, 65],
            [60, 65],
            [60, 64]
        ]) {
            const all = sets(pitches)
            expect(new Set(all).size).toBe(all.length)
        }
        // C and G#: one augmented chord, the one on C.
        const aug = nearMatches([60, 68]).filter((m) => m.symbol.endsWith('aug'))
        expect(aug.map((m) => m.symbol)).toEqual(['Caug'])
        // D and F: Dm7 (on the bass), not also F6.
        const dm = nearMatches([62, 65]).map((m) => m.symbol)
        expect(dm).toContain('Dm7')
        expect(dm).not.toContain('F6')
    })

    it('spells keys as their chord does, and keeps flats (5)', () => {
        expect(spellKeys([58, 62, 65])).toBe('Bb3 D4 F4')
        expect(textOfValue({ kind: 'keys', keys: [58, 62, 65] })).toBe('Bb3 D4 F4')
        expect(textOfValue({ kind: 'keys', keys: [61, 65, 68] })).toBe('Db4 F4 Ab4')
        // No chord: sharps.
        expect(spellKeys([61, 63])).toBe('C#4 D#4')
    })

    it('names a chord note: the chord, and the notes clicked with what goes with them (3, 5, 6)', () => {
        const fields = createDefaultFieldNames()
        const all = new Set([
            fields.chordSymbol,
            fields.chordRoot,
            fields.chordQuality,
            fields.frets,
            fields.fingers,
            fields.position,
            fields.pitches,
            fields.fingering
        ])
        const has = (name: string) => all.has(name)
        // New frets: fingers worked out, the position follows when the note has one.
        const guitar = namedNoteChanges({
            fields,
            has,
            fm: { frets: 'x02220', fingers: 'x01230', position: 1 },
            symbol: 'Em',
            notes: { kind: 'frets', frets: [null, 7, 9, 9, 8, 7] },
            frets: 'x02220',
            pitches: ''
        })
        expect(guitar.set).toEqual({
            chord_symbol: 'Em',
            chord_root: 'E',
            chord_quality: 'Minor',
            frets: 'x79987',
            fingers: 'x13421',
            position: 7
        })
        expect(guitar.remove).toEqual([])
        // Unchanged frets: only the chord.
        const same = namedNoteChanges({
            fields,
            has,
            fm: { frets: 'x32010' },
            symbol: 'C',
            notes: { kind: 'frets', frets: [null, 3, 2, 0, 1, 0] },
            frets: 'x32010',
            pitches: ''
        })
        expect(Object.keys(same.set).sort()).toEqual([
            'chord_quality',
            'chord_root',
            'chord_symbol'
        ])
        // No position property on the note: none added.
        expect(
            'position' in
                namedNoteChanges({
                    fields,
                    has,
                    fm: {},
                    symbol: 'Bm',
                    notes: { kind: 'frets', frets: [null, 2, 4, 4, 3, 2] },
                    frets: '',
                    pitches: ''
                }).set
        ).toBe(false)
        // New keys: spelled by the chord, the list shape kept, the old fingering cleared.
        const piano = namedNoteChanges({
            fields,
            has,
            fm: { pitches: ['C4', 'E4'], fingering: '1 3' },
            symbol: 'Bb',
            notes: { kind: 'keys', keys: [58, 62, 65] },
            frets: '',
            pitches: 'C4 E4'
        })
        expect(piano.set['pitches']).toEqual(['Bb3', 'D4', 'F4'])
        expect(piano.remove).toEqual(['fingering'])
        const text = namedNoteChanges({
            fields,
            has,
            fm: {},
            symbol: 'Bb',
            notes: { kind: 'keys', keys: [58, 62, 65] },
            frets: '',
            pitches: ''
        })
        expect(text.set['pitches']).toBe('Bb3 D4 F4')
        // Only properties the type defines.
        const bare = namedNoteChanges({
            fields,
            has: (name) => name === fields.chordSymbol,
            fm: {},
            symbol: 'Bm',
            notes: { kind: 'frets', frets: [null, 2, 4, 4, 3, 2] },
            frets: '',
            pitches: ''
        })
        expect(bare.set).toEqual({ chord_symbol: 'Bm' })
    })

    it('says why nothing shows: too few notes, or no chord holds them (9)', () => {
        expect(clickHint([], [])).toBe('Click two notes or more: the chord they make shows here.')
        expect(clickHint([60], [])).toBe('Click two notes or more: the chord they make shows here.')
        expect(clickHint([60, 61, 62, 63], [])).toBe(
            'No common chord holds all these notes: take one away.'
        )
        expect(clickHint([60, 64], nearMatches([60, 64]))).toBe('')
    })
})
