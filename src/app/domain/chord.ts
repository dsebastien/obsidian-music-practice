/**
 * Chord symbols ("F#m7", "C/G") → the parts learning notes store. Note names spell the symbol out
 * in ASCII ("F Sharp Minor 7"): `#` breaks wikilinks and `/` is illegal in file names, so the
 * symbol itself goes to an alias.
 */

// Parsing lives in the music notation library, shared with the notation blocks.
export { parseChord } from '@dsebastien/music-notation'
export type { ParsedChord } from '@dsebastien/music-notation'
import type { ParsedChord } from '@dsebastien/music-notation'

/** Note title for a chord voicing: `<name> - <shape>` ("A Major - Open"). */
export const chordTitle = (chord: ParsedChord, shape?: string): string =>
    shape ? `${chord.name} - ${shape}` : chord.name

/** Text safe for a file name: no wikilink or path characters. */
export const safeTitle = (text: string): string =>
    text
        .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

/** "C#" → "C Sharp", "Bb" → "B Flat", "C#/Db" → "C Sharp": a root as note titles spell it. */
export function spellRoot(root: string): string {
    const first = root.split('/')[0]!.trim()
    const m = /^([A-Ga-g])\s*([#♯]|[b♭])?$/.exec(first)
    if (!m) return first
    const accidental = m[2] ? (m[2] === '#' || m[2] === '♯' ? ' Sharp' : ' Flat') : ''
    return `${m[1]!.toUpperCase()}${accidental}`
}

/** Note title for a scale: `<root> <type>[ - <shape>]` ("C Sharp Major - Box 1"). */
export const scaleTitle = (root: string, type: string, shape?: string): string =>
    `${spellRoot(root)} ${type}${shape ? ` - ${shape}` : ''}`
