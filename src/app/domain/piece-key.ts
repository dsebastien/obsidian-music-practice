/**
 * Scales for this progression (#67): the key of a piece and the scales that fit its chords, read
 * from its chord charts and the chord notes it links. Pure: no Obsidian imports.
 */
import { findKey, findScales, inKey, readChord } from '@dsebastien/music-notation'
import type { FoundKey, MusicalKey, ScaleMatch } from '@dsebastien/music-notation'
import { progressionOf } from './progression'

/** At most this many chords go to the scale block (one line, readable). */
export const MAX_FIT_CHORDS = 32

/**
 * A piece's chords: its charts' chords in the order they're played (a chord repeated right after
 * itself once, each chart's `{transpose}` applied), then the linked chord notes' chords that the
 * charts don't play. Symbols the library doesn't read are left out.
 */
export function pieceChords(text: string, linked: readonly string[] = []): string[] {
    const played = progressionOf(text, Number.POSITIVE_INFINITY)
    const seen = new Set(played)
    const extra: string[] = []
    for (const symbol of linked) {
        const read = readChord(symbol.trim())?.symbol
        if (read && !seen.has(read)) {
            seen.add(read)
            extra.push(read)
        }
    }
    return [...played, ...extra]
}

/** A key as the property stores it: "G major", "E minor", "D dorian". */
export const keyText = (key: MusicalKey): string => `${key.tonic} ${key.mode}`

/** What a piece's chords say about its key and scales. */
export interface PieceKey {
    chords: string[]
    /** The likeliest key, or its mode when the chords play one (Dm C G: D dorian). */
    key: string | null
    /** The other keys that score about as well, when the key isn't clear. */
    alternatives: string[]
    /** A dominant-seventh blues on the key's tonic. */
    blues: boolean
    /** The chords outside the key. */
    outside: string[]
    /** The scales that fit, best first. */
    scales: ScaleMatch[]
}

/** The key and the scales of a piece's chords; null when there are none or one doesn't read. */
export function pieceKey(chords: readonly string[], scaleLimit = 5): PieceKey | null {
    if (!chords.length) return null
    const found: FoundKey | null = findKey(chords)
    if (!found) return null
    const key = found.modal ?? found
    const alternatives = found.clear
        ? []
        : found.candidates
              .slice(1, 3)
              .map(keyText)
              .filter((k) => k !== keyText(key))
    return {
        chords: [...chords],
        key: keyText(key),
        alternatives,
        blues: found.blues === true,
        // Against the key shown: G is outside D minor, not D dorian.
        outside: found.modal ? [...new Set(chords.filter((c) => !inKey(c, key)))] : found.outside,
        scales: findScales(chords, { as: 'chords', limit: scaleLimit })
    }
}

/** The ```fretboard or ```keyboard block that draws the scale fitting the chords. */
export function fitBlock(chords: readonly string[]): string {
    return `scales-for: ${chords.slice(0, MAX_FIT_CHORDS).join(' ')}`
}

/** Whether a key property already says this key ("g major" is "G major"). */
export const sameKey = (stored: unknown, key: string): boolean =>
    typeof stored === 'string' && stored.trim().toLowerCase() === key.toLowerCase()
