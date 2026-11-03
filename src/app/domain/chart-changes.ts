/**
 * Chord change drills from a chart (#74): the chord changes a piece's charts play, how often, and
 * how hard each one is for the hand, hardest first. Pure: no Obsidian imports.
 */
import { generateVoicings, transition } from '@dsebastien/music-notation'

/** One change between two chords, whichever comes first, and how often the charts play it. */
export interface ChordChange {
    a: string
    b: string
    count: number
}

/** A change with how hard it is: the hand's movement, both ways averaged; null when unknown. */
export interface RankedChange extends ChordChange {
    effort: number | null
}

/**
 * The changes of a chord sequence (a chord repeated right after itself is no change): each pair
 * once, in the order first played, with how many times it's played either way.
 */
export function chordChanges(sequence: readonly string[]): ChordChange[] {
    const byKey = new Map<string, ChordChange>()
    for (let i = 1; i < sequence.length; i++) {
        const a = sequence[i - 1]!
        const b = sequence[i]!
        if (a === b) continue
        const key = [a, b].sort().join('\u0000')
        const change = byKey.get(key)
        if (change) change.count++
        else byKey.set(key, { a, b, count: 1 })
    }
    return [...byKey.values()]
}

/** The frets a chord is held with: the player's own (a chord note's), else its easiest voicing. */
export type FretsOf = (symbol: string) => readonly (number | null)[] | null

/** The easiest voicing's frets of a chord; null when the library has none. */
export const easiestFrets: FretsOf = (symbol) => generateVoicings(symbol)[0]?.frets ?? null

/**
 * How hard a change is: the library's movement from the held voicing to the next chord's easiest
 * reachable one, averaged over both ways and rounded to a tenth. Null when either way is unknown.
 */
export function changeEffort(a: string, b: string, fretsOf: FretsOf = easiestFrets): number | null {
    const way = (from: string, to: string): number | null => {
        const frets = fretsOf(from)
        return frets ? (transition(frets, to)[0]?.movement ?? null) : null
    }
    const there = way(a, b)
    const back = way(b, a)
    return there === null || back === null ? null : Math.round(((there + back) / 2) * 10) / 10
}

/** Hardest first (unknown effort last), then the most played. */
export function sortChanges(changes: readonly RankedChange[]): RankedChange[] {
    return [...changes].sort(
        (x, y) =>
            (y.effort ?? Number.NEGATIVE_INFINITY) - (x.effort ?? Number.NEGATIVE_INFINITY) ||
            y.count - x.count
    )
}

/** The changes with their effort, hardest first, then the most played. */
export function rankChanges(
    changes: readonly ChordChange[],
    fretsOf: FretsOf = easiestFrets
): RankedChange[] {
    return sortChanges(
        changes.map((change) => ({ ...change, effort: changeEffort(change.a, change.b, fretsOf) }))
    )
}
