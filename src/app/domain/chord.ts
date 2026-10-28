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
