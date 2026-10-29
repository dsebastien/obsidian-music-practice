/**
 * Smoothing a piece's progression (#57): the chords of its ```chords blocks, in the order they
 * are played (a chord repeated right after itself counts once).
 */
import { parseChordPro, readChord } from '@dsebastien/music-notation'

/** Chord charts (```chords or ~~~chords fences) in a note's text. */
export function chordCharts(text: string): string[] {
    const charts: string[] = []
    const fence = /^(`{3,}|~{3,})\s*chords\b[^\n]*\n([\s\S]*?)^\1\s*$/gm
    let m: RegExpExecArray | null
    while ((m = fence.exec(text))) charts.push(m[2]!)
    return charts
}

/** The chords a note's charts play, in order, without immediate repeats; at most `limit`. */
export function progressionOf(text: string, limit = 16): string[] {
    const chords: string[] = []
    for (const chart of chordCharts(text)) {
        const song = parseChordPro(chart)
        for (const section of song.sections)
            for (const line of section.lines) {
                if (line.kind !== 'lyrics') continue
                for (const segment of line.segments) {
                    const symbol = segment.chord ? readChord(segment.chord)?.symbol : null
                    if (symbol && chords[chords.length - 1] !== symbol) chords.push(symbol)
                }
            }
    }
    return chords.slice(0, limit)
}
