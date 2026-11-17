/**
 * A chord note's name → its chord and its shape (#119): "A Minor 7 - Open" is Am7 in the Open
 * shape. For notes made from a template, where the name was typed and the properties are empty.
 */

import { readChord } from '@dsebastien/music-notation'
import type { ParsedChord, VoicingShape } from '@dsebastien/music-notation'
import { shapeValue } from './voicings'

/** What a chord note's name says. */
export interface NameReading {
    chord: ParsedChord
    /** The note type's shape value the name gives; null when it gives none the type takes. */
    shape: string | null
}

/** A note's name without its type's prefix and suffix: "A Minor (Guitar Chord)" → "A Minor". */
export function titleOfName(
    name: string,
    affixes: { prefix: string; suffix: string } | null
): string {
    let title = name
    if (affixes?.prefix && title.startsWith(affixes.prefix))
        title = title.slice(affixes.prefix.length)
    if (affixes?.suffix && title.endsWith(affixes.suffix))
        title = title.slice(0, title.length - affixes.suffix.length)
    return title.trim()
}

/** "A Minor 7 - Open": the chord, a dash between spaces, the shape. */
const DASH = /\s+[-–—]\s+/
/** "A Minor 7 (Open)": the shape in brackets at the end. */
const BRACKETS = /^(.*?)\s*\(([^()]*)\)$/
/** A root stuck to its quality, as a template joins them: "AMinor", "BbMajor 7". */
const STUCK = /^([A-G][#b♯♭]?)(?=[A-Z])/

/** The chord some text names: as written, then with its root set apart, then without brackets. */
function chordOf(text: string): ParsedChord | null {
    const apart = text.replace(STUCK, '$1 ')
    const bare = text.replace(/\s*\([^()]*\)/g, '').trim()
    for (const candidate of [apart, text, bare]) {
        const chord = candidate ? readChord(candidate) : null
        if (chord) return chord
    }
    return null
}

/**
 * The type's shape value for what a name says: the value itself or a name the library uses for it
 * (any case), else the longest value the text starts with ("Triad (strings 1-3)" is Triad, "Open
 * at fret 5" is Open). `free`: the text as written when the type takes any text.
 */
function shapeOf(text: string, shapes: readonly string[] | null, free: boolean): string | null {
    const said = text.trim()
    if (!said || !shapes) return null
    if (!shapes.length) return free ? said : null
    const exact = shapeValue(said as VoicingShape, shapes)
    if (exact) return exact
    const lower = said.toLowerCase()
    const starts = shapes
        .filter((value) => {
            const v = value.trim().toLowerCase()
            return v && lower.startsWith(v) && !/[a-z0-9]/.test(lower.charAt(v.length))
        })
        .sort((a, b) => b.length - a.length)
    return starts[0] ?? null
}

/**
 * The chord and shape a chord note's title names; null when it names no chord. `shapes`: the
 * values the type's shape property takes (none when it takes all text), null when the type has
 * no shape.
 */
export function readChordName(title: string, shapes: readonly string[] | null): NameReading | null {
    const text = title.trim()
    if (!text) return null
    const dash = DASH.exec(text)
    if (dash) {
        const chord = chordOf(text.slice(0, dash.index))
        if (chord)
            return { chord, shape: shapeOf(text.slice(dash.index + dash[0].length), shapes, true) }
    }
    // Brackets hold a shape only when the type lists it: "E 5 (Power)" is a quality's own words.
    const brackets = BRACKETS.exec(text)
    if (brackets) {
        const chord = chordOf(brackets[1] ?? '')
        const shape = shapeOf(brackets[2] ?? '', shapes, false)
        if (chord && shape) return { chord, shape }
    }
    const chord = chordOf(text)
    return chord ? { chord, shape: null } : null
}
