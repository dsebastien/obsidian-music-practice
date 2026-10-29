/**
 * All the ways to play a chord (#54): the library's generated voicings, filtered as the modal
 * offers, and what a note gets from the one picked.
 */
import { baseFretOf, parseFrets } from '@dsebastien/music-notation'
import type { GeneratedVoicing, VoicingOptions, VoicingShape } from '@dsebastien/music-notation'

/** Where on the neck: anywhere, the first position, or a fret range. */
export type VoicingArea = 'all' | 'open' | '1-5' | '5-9' | '9-12' | '12-15'

export const VOICING_AREAS: { value: VoicingArea; label: string }[] = [
    { value: 'all', label: 'Whole neck' },
    { value: 'open', label: 'First position' },
    { value: '1-5', label: 'Frets 1–5' },
    { value: '5-9', label: 'Frets 5–9' },
    { value: '9-12', label: 'Frets 9–12' },
    { value: '12-15', label: 'Frets 12–15' }
]

export interface VoicingFilter {
    area: VoicingArea
    /** The string the root is on (6, 5, 4); 0 for any. */
    rootString: number
    /** Inversions too (any chord tone in the bass), not only the root. */
    inversions: boolean
    /** Five frets instead of four. */
    stretch: boolean
}

export const DEFAULT_VOICING_FILTER: VoicingFilter = {
    area: 'all',
    rootString: 0,
    inversions: false,
    stretch: false
}

/** The library's options for a filter. */
export function voicingOptions(filter: VoicingFilter): VoicingOptions {
    const options: VoicingOptions = {}
    if (filter.area === 'open') options.area = 'open'
    else if (filter.area !== 'all') {
        const [from, to] = filter.area.split('-').map(Number) as [number, number]
        options.area = [from, to]
    }
    if (filter.rootString) options.bassString = filter.rootString
    if (filter.inversions) options.inversion = 'any'
    if (filter.stretch) options.maxSpan = 5
    return options
}

/**
 * The note type's value for a shape the library names ("Open", "E-shape barre"), matched without
 * regard to case; the library's name when the type takes any text; null when the type has no such
 * value.
 */
export function shapeValue(shape: VoicingShape | null, allowed: readonly string[]): string | null {
    if (!shape) return null
    if (!allowed.length) return shape
    return allowed.find((v) => v.trim().toLowerCase() === shape.toLowerCase()) ?? null
}

/** Same frets, string by string. */
export const sameFrets = (a: readonly (number | null)[], b: readonly (number | null)[]): boolean =>
    a.length === b.length && a.every((f, i) => f === b[i])

/**
 * A free title for a new voicing note: the usual one ("A Major - E-shape barre"), else with its
 * fret ("A Major - E-shape barre at fret 5"); null when both are taken.
 */
export function voicingNoteTitle(
    base: string,
    voicing: Pick<GeneratedVoicing, 'frets' | 'baseFret'>,
    taken: (title: string) => boolean
): string | null {
    if (!taken(base)) return base
    const fret = voicing.baseFret || baseFretOf(voicing.frets)
    const atFret = `${base} at fret ${fret}`
    return taken(atFret) ? null : atFret
}

/** "1. E-shape barre", "2. 5fr", for the voicing buttons. */
export const voicingLabel = (voicing: GeneratedVoicing, rank: number): string =>
    `${rank}. ${voicing.shape ?? `${voicing.baseFret}fr`}`

/**
 * A note's frets property as frets: text ("x02220", "x-10-12-12-11-10") or a number YAML read
 * from digits only ("22100" for 022100, six strings); null when there are none.
 */
export function fretsOfProperty(value: unknown): (number | null)[] | null {
    const text =
        typeof value === 'number'
            ? String(value).padStart(6, '0')
            : typeof value === 'string'
              ? value.trim()
              : ''
    return text ? parseFrets(text) : null
}

/** A shape property's value: text, or the first of a list. */
export function shapeText(value: unknown): string {
    const first = Array.isArray(value) ? (value as unknown[])[0] : value
    return typeof first === 'string' ? first.trim() : ''
}

/**
 * Why a voicing can't become a note's: each shape is its own thing to learn (its own note and
 * mastery), so a note only takes another fingering or position of its own shape. With frets, the
 * note's shape is the library's name for them (compared with the voicing's, so a note type's
 * coarser values don't matter); without, its shape property, matched to the voicing's mapped
 * value. Null when the voicing can be the note's (its own, the same shape, or a note with neither
 * frets nor shape).
 */
export function voicingConflict(note: {
    frets: (number | null)[] | null
    /** The library's shape for the note's frets. */
    fretsShape: VoicingShape | null
    /** The note's shape property. */
    shape: string
    voicing: GeneratedVoicing
    /** The voicing's shape as the note type writes it. */
    voicingShape: string | null
}): string | null {
    const { frets, voicing } = note
    const own = note.shape || note.fretsShape
    if (frets) {
        if (sameFrets(frets, voicing.frets) || note.fretsShape === voicing.shape) return null
    } else if (!note.shape || note.voicingShape?.toLowerCase() === note.shape.toLowerCase()) {
        return null
    }
    const other = note.voicingShape ?? voicing.shape
    return `This note is ${own ? `the ${own} shape` : 'another shape'}: add ${other ? `the ${other}` : 'this voicing'} as its own note.`
}
