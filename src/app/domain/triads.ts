/**
 * Triads on string sets as learning items (#55): one note per triad shape (a chord, a string set,
 * an inversion), titled so the three inversions of a string set sit side by side.
 */
import { inversionName } from '@dsebastien/music-notation'

/** The string sets triads are learned on, as guitarists count strings (1 = the highest). */
export const STRING_SETS = ['1-3', '2-4', '3-5', '4-6'] as const
export type StringSet = (typeof STRING_SETS)[number]

/** "2-4" → [2, 3, 4]. */
export const stringsOf = (set: StringSet): number[] => {
    const from = Number(set[0])
    return [from, from + 1, from + 2]
}

/** "(strings 1-3, 1st inversion)": what tells a triad note from the chord's other shapes. */
export const triadDetail = (set: StringSet, inversion: number): string =>
    `(strings ${set}, ${inversionName(inversion)})`

/** The note title: "G Major - Triad (strings 1-3, 1st inversion)". */
export const triadTitle = (
    chordName: string,
    shape: string,
    set: StringSet,
    inversion: number
): string => `${chordName} - ${shape} ${triadDetail(set, inversion)}`
