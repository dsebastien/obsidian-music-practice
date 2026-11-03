/**
 * Blocks Music Practice draws from a learning note's properties when the notation library doesn't
 * (#56, #58, #71): an empty ```fretboard (or ```keyboard) block in an arpeggio note draws its
 * chord's arpeggio, an empty ```strum block in a strumming pattern note draws its pattern, and an
 * empty ```picking block in a fingerpicking pattern note draws its pattern. Pure: no Obsidian
 * imports.
 */
import { PICKING_PATTERNS, namedPicking, readChord } from '@dsebastien/music-notation'
import type { FieldNames } from './fields'

type Properties = Record<string, unknown>

/** The fields these blocks read. */
export type PracticeBlockFields = Pick<
    FieldNames,
    | 'chordSymbol'
    | 'shape'
    | 'bpmCurrent'
    | 'strumPattern'
    | 'timeSignature'
    | 'strumFeel'
    | 'pickingPattern'
>

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

/** `swing:` for a feel: "swing" or "shuffle" swings, "60%" sets the ratio, others are straight. */
export function swingOf(feel: unknown): string | null {
    const text = textOf(feel).toLowerCase()
    if (/^(swing|swung|shuffle)/.test(text)) return 'yes'
    const percent = /^(\d{2})\s*%$/.exec(text)
    return percent ? `${percent[1]}%` : null
}

/** A pattern property as lines: a list is one bar a line, a text keeps its own lines. */
function linesOf(raw: unknown): string[] {
    return (Array.isArray(raw) ? raw : [raw])
        .map((line) => textOf(line))
        .flatMap((line) => line.split(/\r?\n/))
        .map((line) => line.trim())
        .filter(Boolean)
}

/** The tempo line for a current BPM: a whole number from 20 to 240, else none. */
function tempoLine(properties: Properties, fields: PracticeBlockFields): string[] {
    const bpm = Number(textOf(properties[fields.bpmCurrent]))
    return Number.isInteger(bpm) && bpm >= 20 && bpm <= 240 ? [`tempo: ${bpm}`] : []
}

/** A time signature the strum block reads: "6/8", "3/4", "C", "cut". */
const TIME = /^(\d{1,2}\/\d{1,2}|c|cut)$/i

/**
 * A strumming pattern note's ```strum block: its pattern (one bar per line when it's a list),
 * then its time signature, feel (swing), chord and current BPM as the block's tempo (20 to 240).
 * Null without a pattern.
 */
export function strumSource(properties: Properties, fields: PracticeBlockFields): string | null {
    const lines = linesOf(properties[fields.strumPattern])
    if (!lines.length) return null
    const time = textOf(properties[fields.timeSignature])
    const swing = swingOf(properties[fields.strumFeel])
    const chord = chordOf(properties, fields)
    return [
        ...lines,
        ...(TIME.test(time) ? [`time: ${time}`] : []),
        ...(swing ? [`swing: ${swing}`] : []),
        ...(chord ? [`chord: ${chord}`] : []),
        ...tempoLine(properties, fields)
    ].join('\n')
}

/**
 * A fingerpicking pattern note's ```picking block (#71), as the library draws it on Publish: a
 * named pattern (`pattern: travis`) or the pattern's lines (PIMA letters or string numbers, one
 * bar a line), then its time signature, chord and current BPM as the block's tempo (20 to 240).
 * Null without a pattern.
 */
export function pickingSource(properties: Properties, fields: PracticeBlockFields): string | null {
    const lines = linesOf(properties[fields.pickingPattern])
    if (!lines.length) return null
    const time = textOf(properties[fields.timeSignature])
    const chord = chordOf(properties, fields)
    const named = lines.length === 1 && namedPicking(lines[0]!) !== null
    return [
        ...(named ? [`pattern: ${lines[0]!}`] : lines),
        ...(TIME.test(time) ? [`time: ${time}`] : []),
        ...(chord ? [`chord: ${chord}`] : []),
        ...tempoLine(properties, fields)
    ].join('\n')
}

/** The library's named picking patterns, for a pattern field's suggestions (#71). */
export const PICKING_NAMES: readonly string[] = Object.values(PICKING_PATTERNS).map((p) => p.name)

/**
 * A fingerpicking pattern note's properties from what was typed in Add a learning note (#71): the
 * pattern, time signature and chord (as the library spells it, "A Minor" → "Am"), for the fields
 * the type defines; empty values and chords the library doesn't read are left out.
 */
export function typedPickingProperties(
    typed: { pattern: string; time: string; chord: string },
    fields: Pick<FieldNames, 'pickingPattern' | 'timeSignature' | 'chordSymbol'>,
    has: (name: string) => boolean
): Record<string, string> {
    const chord = typed.chord.trim() ? (readChord(typed.chord.trim())?.symbol ?? '') : ''
    const values: [string, string][] = [
        [fields.pickingPattern, typed.pattern.trim()],
        [fields.timeSignature, typed.time.trim()],
        [fields.chordSymbol, chord]
    ]
    return Object.fromEntries(values.filter(([name, value]) => value && has(name)))
}

/**
 * What an empty block of a learning note draws when Music Practice makes its source: a strum
 * or picking pattern, or an arpeggio. Null leaves the block to the library (chords and scales).
 */
export function practiceBlockSource(
    language: string,
    properties: Properties,
    fields: PracticeBlockFields,
    kind: string,
    instrument: 'guitar' | 'piano' | null
): string | null {
    if (language === 'strum') return strumSource(properties, fields)
    if (language === 'picking') return pickingSource(properties, fields)
    return arpeggioSource(language, properties, fields, kind, instrument)
}
