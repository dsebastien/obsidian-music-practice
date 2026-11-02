/**
 * Smoothing a piece's progression (#57): the chords of its ```chords blocks, in the order they
 * are played (a chord repeated right after itself counts once).
 */
import {
    keyPrefersFlats,
    parseChordPro,
    readChord,
    transposeChord,
    transposeKey
} from '@dsebastien/music-notation'

/** Chord charts (```chords or ~~~chords fences) in a note's text. */
export function chordCharts(text: string): string[] {
    const charts: string[] = []
    const fence = /^(`{3,}|~{3,})\s*chords\b[^\n]*\n([\s\S]*?)^\1\s*$/gm
    let m: RegExpExecArray | null
    while ((m = fence.exec(text))) charts.push(m[2]!)
    return charts
}

/**
 * The chords a note's charts play, in order, without immediate repeats; at most `limit`. Each
 * chart's `{transpose}` applies, spelled as the chart shows it (the transposed key's sharps or
 * flats).
 */
export function progressionOf(text: string, limit = 16): string[] {
    const chords: string[] = []
    for (const chart of chordCharts(text)) {
        const song = parseChordPro(chart)
        const semitones = song.transpose
        const key = song.key && semitones ? transposeKey(song.key, semitones) : null
        const flats = key ? keyPrefersFlats(key) : undefined
        for (const section of song.sections)
            for (const line of section.lines) {
                if (line.kind !== 'lyrics') continue
                for (const segment of line.segments) {
                    const read = segment.chord ? readChord(segment.chord)?.symbol : null
                    const symbol = read && semitones ? transposeChord(read, semitones, flats) : read
                    if (symbol && chords[chords.length - 1] !== symbol) chords.push(symbol)
                }
            }
    }
    return chords.slice(0, limit)
}
