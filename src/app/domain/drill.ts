/**
 * Chord change drills (#40): switch between two chords for a minute and count the changes. Each
 * pair is an exercise note linking both chords; its best and last counts are on that note.
 */

/** A pair of chords, by note path, with its exercise note when there is one. */
export interface DrillPair {
    a: string
    b: string
    /** The exercise note of the pair; null until the first drill creates it. */
    note: string | null
    best: number | null
    last: number | null
}

/** The same pair whichever chord comes first. */
export const pairKey = (a: string, b: string): string => [a, b].sort().join('\u0000')

/**
 * Every pair among these chords, with what the existing pair notes say; the slowest first (never
 * drilled, then the lowest best), so practice goes where it's needed.
 */
export function pairsOf(
    chords: readonly string[],
    notes: readonly { path: string; chords: string[]; best: number | null; last: number | null }[]
): DrillPair[] {
    const byKey = new Map(
        notes
            .filter((n) => n.chords.length === 2)
            .map((n) => [pairKey(n.chords[0]!, n.chords[1]!), n])
    )
    const unique = [...new Set(chords)]
    const pairs: DrillPair[] = []
    for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
            const note = byKey.get(pairKey(unique[i]!, unique[j]!))
            pairs.push({
                a: unique[i]!,
                b: unique[j]!,
                note: note?.path ?? null,
                best: note?.best ?? null,
                last: note?.last ?? null
            })
        }
    }
    return pairs.sort((x, y) => (x.best ?? -1) - (y.best ?? -1))
}

/** A pair note's title from its chords' titles: "A Major - Open ↔ D Major - Open". */
export const pairTitle = (a: string, b: string): string => `${a} ↔ ${b}`

/** The counts after a drill: the last one, and the best so far. */
export const afterDrill = (
    best: number | null,
    count: number
): { best: number; last: number; improved: boolean } => ({
    best: Math.max(best ?? 0, count),
    last: count,
    improved: best === null || count > best
})

/** A count as typed: a whole number from 0, else null. */
export const countOf = (text: string): number | null => {
    const n = Number(text)
    return text.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 999 ? n : null
}
