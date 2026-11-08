/**
 * Click to enter notes (#76): frets and keys from clicks on a fretboard or keyboard, and the
 * chords that hold the notes when they make no chord the library detects (near matches).
 */
import {
    chordNoteSet,
    detectChordFromFrets,
    detectChordFromPitches,
    midiOf,
    parseFrets
} from '@dsebastien/music-notation'
import type { DetectedChord } from '@dsebastien/music-notation'
import { formatFrets } from './notation-note'

/** Standard tuning, lowest string first (MIDI). */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** Chord roots, spelled as chord names usually are. */
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
/** The common chord families, most common first: near matches are taken from them. */
const SUFFIXES = [
    '',
    'm',
    '7',
    'm7',
    'maj7',
    'sus4',
    'sus2',
    '6',
    'm6',
    'add9',
    '9',
    'dim',
    'm7b5',
    'dim7',
    'aug',
    '7sus4',
    '5'
]

const chroma = (pitch: number) => ((pitch % 12) + 12) % 12

/** Six strings' frets (lowest first, null = muted) after a click on `string` (1 = highest) at `fret`: set, or muted when it was already that fret. */
export function toggleFret(
    frets: readonly (number | null)[],
    string: number,
    fret: number
): (number | null)[] {
    const next = Array.from({ length: 6 }, (_, i) => frets[i] ?? null)
    const index = 6 - string
    if (index < 0 || index > 5) return next
    next[index] = next[index] === fret ? null : fret
    return next
}

/** Keys after a click on `pitch`: added, or taken away when it was there; low to high. */
export function toggleKey(keys: readonly number[], pitch: number): number[] {
    const set = new Set(keys)
    if (set.has(pitch)) set.delete(pitch)
    else set.add(pitch)
    return [...set].sort((a, b) => a - b)
}

/** The pitches frets sound, low to high. */
export function pitchesOfFrets(
    frets: readonly (number | null)[],
    tuning: readonly number[] = STANDARD_TUNING
): number[] {
    return frets
        .flatMap((f, i) => (f === null || tuning[i] === undefined ? [] : [tuning[i] + f]))
        .sort((a, b) => a - b)
}

/** Keys typed with their octaves ("C4 E4 G4", commas allowed), low to high; null unless every one reads. */
export function parseKeys(text: string): number[] | null {
    const tokens = text.split(/[\s,]+/).filter(Boolean)
    if (!tokens.length) return null
    const pitches: number[] = []
    for (const token of tokens) {
        // Only names with an octave: "C" alone is a pitch class, not a key.
        if (!/\d$/.test(token)) return null
        const pitch = midiOf(token)
        if (pitch === null) return null
        pitches.push(pitch)
    }
    return [...new Set(pitches)].sort((a, b) => a - b)
}

/** Keys as text ("C4 D#4 G4"). */
export const formatKeys = (keys: readonly number[]): string =>
    keys.map((p) => `${SHARPS[chroma(p)]}${Math.floor(p / 12) - 1}`).join(' ')

export interface NearMatch {
    symbol: string
    /** The chord's notes not played, spelled as the chord spells them. */
    missing: string[]
    missingClasses: number[]
}

/**
 * The chords that hold every note played (2 pitch classes at least), fewest missing notes first,
 * then those on the lowest note, then the most common families; at most `limit`. A chord with
 * nothing missing is the chord itself (detection names it): left out.
 */
export function nearMatches(pitches: readonly number[], limit = 6): NearMatch[] {
    const classes = [...new Set(pitches.map(chroma))]
    if (classes.length < 2) return []
    const bass = chroma(Math.min(...pitches))
    const found: (NearMatch & { order: number; onBass: boolean })[] = []
    SUFFIXES.forEach((suffix, order) => {
        for (const root of ROOTS) {
            const symbol = `${root}${suffix}`
            const members = chordNoteSet(symbol)?.members ?? []
            const chord = new Set(members.map((m) => m.chroma))
            if (!classes.every((c) => chord.has(c))) continue
            const missing = members.filter((m) => !classes.includes(m.chroma))
            if (!missing.length) continue
            found.push({
                symbol,
                missing: missing.map((m) => m.name),
                missingClasses: missing.map((m) => m.chroma),
                order,
                onBass: members[0]?.chroma === bass
            })
        }
    })
    return found
        .sort(
            (a, b) =>
                a.missing.length - b.missing.length ||
                Number(b.onBass) - Number(a.onBass) ||
                a.order - b.order
        )
        .slice(0, limit)
        .map(({ symbol, missing, missingClasses }) => ({ symbol, missing, missingClasses }))
}

/**
 * Where to mark a near match's missing notes on a fretboard: on the muted strings, from 2 frets
 * below the lowest fretted note to 2 above the highest (frets 0-4 when none is fretted), string 1
 * (the highest) first.
 */
export function nearMarks(
    frets: readonly (number | null)[],
    missingClasses: readonly number[],
    tuning: readonly number[] = STANDARD_TUNING
): { string: number; fret: number }[] {
    const fretted = frets.filter((f): f is number => f !== null && f > 0)
    const low = fretted.length ? Math.max(0, Math.min(...fretted) - 2) : 0
    const high = fretted.length ? Math.max(...fretted) + 2 : 4
    const marks: { string: number; fret: number }[] = []
    for (let string = 1; string <= 6; string++) {
        const index = 6 - string
        if ((frets[index] ?? null) !== null) continue
        const open = tuning[index]
        if (open === undefined) continue
        for (let fret = low; fret <= high; fret++)
            if (missingClasses.includes(chroma(open + fret))) marks.push({ string, fret })
    }
    return marks
}

/** What the drawing holds: six frets (guitar) or keys (piano). */
export type ClickValue =
    | { kind: 'frets'; frets: (number | null)[] }
    | { kind: 'keys'; keys: number[] }

/** A target of the drawing, as the library's pick layer names it. */
export type ClickAt = { string: number; fret: number } | { pitch: number }

const MUTED: (number | null)[] = [null, null, null, null, null, null]

/** The value after a pick: a fretboard pick sets or mutes its string, a key pick toggles the key. */
export function afterPick(
    value: ClickValue,
    pick: { string: number | null; fret: number | null; pitch: number }
): ClickValue {
    if (value.kind === 'keys') return { kind: 'keys', keys: toggleKey(value.keys, pick.pitch) }
    if (pick.string === null || pick.fret === null) return value
    return { kind: 'frets', frets: toggleFret(value.frets, pick.string, pick.fret) }
}

/** The targets the value has chosen: a string's fret (string 1 is the highest), or a key. */
export function chosen(value: ClickValue): ClickAt[] {
    if (value.kind === 'keys') return value.keys.map((pitch) => ({ pitch }))
    return value.frets.flatMap((fret, i) => (fret === null ? [] : [{ string: 6 - i, fret }]))
}

const pitchesOf = (value: ClickValue): number[] =>
    value.kind === 'keys' ? [...value.keys] : pitchesOfFrets(value.frets)

/** The chord the notes make, else (no chord) the chords that hold them. */
export function readValue(value: ClickValue): {
    detected: DetectedChord | null
    near: NearMatch[]
} {
    const pitches = pitchesOf(value)
    if (!pitches.length) return { detected: null, near: [] }
    const detected =
        value.kind === 'frets' ? detectChordFromFrets(value.frets) : detectChordFromPitches(pitches)
    return { detected, near: detected ? [] : nearMatches(pitches) }
}

/**
 * Where a near match's missing notes are marked: every key of them in the keyboard's range, or
 * the fretboard's `nearMarks` within its frets.
 */
export function nearTargets(
    value: ClickValue,
    missingClasses: readonly number[],
    range: [number, number]
): ClickAt[] {
    if (value.kind === 'frets')
        return nearMarks(value.frets, missingClasses).filter(
            (m) => m.fret >= range[0] && m.fret <= range[1]
        )
    const out: ClickAt[] = []
    for (let pitch = range[0]; pitch <= range[1]; pitch++)
        if (missingClasses.includes(chroma(pitch))) out.push({ pitch })
    return out
}

/** The value a text field holds: six frets (`x32010`) or keys (`C4 E4 G4`); none chosen otherwise. */
export function valueOfText(text: string, instrument: 'guitar' | 'piano'): ClickValue {
    if (instrument === 'piano') return { kind: 'keys', keys: parseKeys(text.trim()) ?? [] }
    const frets = parseFrets(text.trim())
    return { kind: 'frets', frets: frets?.length === 6 ? frets : [...MUTED] }
}

/** The value as the text field writes it; empty when nothing is chosen. */
export function textOfValue(value: ClickValue): string {
    if (value.kind === 'keys') return formatKeys(value.keys)
    return value.frets.every((f) => f === null) ? '' : formatFrets(value.frets)
}
