/**
 * Chord symbols ("F#m7", "C/G") → the parts learning notes store. Note names spell the symbol out
 * in ASCII ("F Sharp Minor 7"): `#` breaks wikilinks and `/` is illegal in file names, so the
 * symbol itself goes to an alias.
 */

/** Suffix → quality name. Order matters: the first match wins. */
const QUALITY_SUFFIXES: [RegExp, string][] = [
    [/^(m7b5|m7-5|ø7?)$/, 'Minor 7 flat 5'],
    [/^(dim7|°7)$/, 'Diminished 7'],
    [/^(maj9|M9|Δ9)$/, 'Major 9'],
    [/^(maj7|M7|Δ7?)$/, 'Major 7'],
    [/^(7sus4)$/, '7sus4'],
    [/^(m9|min9|-9)$/, 'Minor 9'],
    [/^(m7|min7|-7)$/, 'Minor 7'],
    [/^(m6|min6|-6)$/, 'Minor 6'],
    [/^(m|min|-)$/, 'Minor'],
    [/^(dim|°)$/, 'Diminished'],
    [/^(aug|\+)$/, 'Augmented'],
    [/^(sus2)$/, 'Sus2'],
    [/^(sus4|sus)$/, 'Sus4'],
    [/^(add9|add2)$/, 'Add9'],
    [/^5$/, '5 (Power)'],
    [/^(13|11|9|7|6)$/, '$1'],
    [/^(maj|M)?$/, 'Major']
]

export interface ParsedChord {
    symbol: string
    root: string
    quality: string
    bass: string | null
    /** "F Sharp Minor 7", "C Major over G". */
    name: string
}

const spell = (note: string) =>
    note[0]! + (note[1] === '#' ? ' Sharp' : note[1] === 'b' ? ' Flat' : '')

/** "5 (Power)" → "5" for names. */
const plain = (quality: string) => quality.replace(/\s*\([^)]*\)/g, '').trim()

/** Parse a chord symbol; null when it isn't one. */
export function parseChord(symbol: string): ParsedChord | null {
    const trimmed = symbol.trim()
    const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(trimmed)
    if (!m) return null
    const [, root, suffix, bass] = m
    let quality: string | null = null
    for (const [re, label] of QUALITY_SUFFIXES) {
        const hit = re.exec(suffix!)
        if (hit) {
            quality = label.replace('$1', hit[1] ?? '')
            break
        }
    }
    if (!quality) return null
    return {
        symbol: trimmed,
        root: root!,
        quality,
        bass: bass ?? null,
        name: `${spell(root!)} ${plain(quality)}${bass ? ` over ${spell(bass)}` : ''}`
    }
}

/** Note title for a chord voicing: `<name> - <shape>` ("A Major - Open"). */
export const chordTitle = (chord: ParsedChord, shape?: string): string =>
    shape ? `${chord.name} - ${shape}` : chord.name

/** Text safe for a file name: no wikilink or path characters. */
export const safeTitle = (text: string): string =>
    text
        .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
