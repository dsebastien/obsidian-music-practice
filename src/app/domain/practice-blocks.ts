/**
 * Blocks Music Practice draws from a learning note's properties when the notation library doesn't
 * (#56): an empty ```fretboard (or ```keyboard) block in an arpeggio note draws its chord's
 * arpeggio. Pure: no
 * Obsidian imports.
 */
import { readChord } from '@dsebastien/music-notation'
import type { FieldNames } from './fields'

type Properties = Record<string, unknown>

/** The fields these blocks read. */
export type PracticeBlockFields = Pick<FieldNames, 'chordSymbol' | 'shape'>

/** A property as one line of text: a string, a number, or a list's first value. */
function textOf(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (Array.isArray(value)) return textOf(value[0])
    return ''
}

/**
 * The CAGED letter of a shape value: "E", "CAGED E", "E shape", "E-shape barre" → "E". Null for
 * shapes that aren't one (Open, Triad, 3NPS).
 */
export function cagedShape(value: unknown): string | null {
    const m = /^(?:caged\s+)?([cagedCAGED])(?:\s*-?\s*shape\b.*)?$/i.exec(textOf(value))
    return m ? m[1]!.toUpperCase() : null
}

/** The chord of a note, as the library reads it ("A Minor 7" → "Am7"); null when it doesn't. */
const chordOf = (properties: Properties, fields: PracticeBlockFields): string | null => {
    const text = textOf(properties[fields.chordSymbol])
    return text ? (readChord(text)?.symbol ?? null) : null
}

/**
 * An arpeggio note's block: `arpeggio: <chord>`, with `shape: <CAGED letter>` on guitar when the
 * note's shape is one. Arpeggio notes draw on a ```fretboard (guitar) or ```keyboard (piano); a
 * guitar chord note's empty ```fretboard draws its chord's arpeggio too. Null for other blocks,
 * or when the note has no chord the library reads.
 */
export function arpeggioSource(
    language: string,
    properties: Properties,
    fields: PracticeBlockFields,
    kind: string,
    instrument: 'guitar' | 'piano' | null
): string | null {
    const guitar = instrument !== 'piano'
    const fits =
        (kind === 'arpeggio' && language === (guitar ? 'fretboard' : 'keyboard')) ||
        (kind === 'chord' && guitar && language === 'fretboard')
    if (!fits) return null
    const chord = chordOf(properties, fields)
    if (!chord) return null
    const shape = guitar ? cagedShape(properties[fields.shape]) : null
    return [`arpeggio: ${chord}`, ...(shape ? [`shape: ${shape}`] : [])].join('\n')
}

/**
 * What an empty block of a learning note draws when Music Practice makes its source: an
 * arpeggio. Null leaves the block to the library (chords and scales).
 */
export function practiceBlockSource(
    language: string,
    properties: Properties,
    fields: PracticeBlockFields,
    kind: string,
    instrument: 'guitar' | 'piano' | null
): string | null {
    return arpeggioSource(language, properties, fields, kind, instrument)
}
