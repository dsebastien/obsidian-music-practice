/**
 * A progression in time (#69): the chords a note plays one a bar, as a backing loop, from its
 * ```progression blocks, its ```chords charts or the chord notes it links. Pure: no Obsidian
 * imports (a drawn progression block is read through the attributes the library puts on it).
 */
import {
    chartChords,
    MAX_PROGRESSION_BARS,
    parseChordPro,
    parseTime,
    readChord,
    type ProgressionChordInput
} from '@dsebastien/music-notation'
import { chordCharts } from './progression'

/** The library plays progressions from 20 to 240 counted beats a minute. */
export const MIN_BACKING_BPM = 20
export const MAX_BACKING_BPM = 240
export const DEFAULT_BACKING_BPM = 80

/** One progression a note can play: its chords, one a bar, and what it says about time. */
export interface BackingSource {
    /** "Progression 1", "Chord chart", "Linked chord notes". */
    label: string
    /** Chord symbols, or the notes a drawn block sounds with the name to show. */
    chords: ProgressionChordInput[]
    /** Its time signature as written ("6/8"), null when it has none. */
    time: string | null
    /** Its own tempo, null when it has none. */
    tempo: number | null
    /** A progression block's `strum:` (beats, bar, arpeggio or a pattern), null without one. */
    strum: string | null
    /** The instrument a drawn block's chords sound on (piano blocks), null for the note's own. */
    sound: 'guitar' | 'piano' | null
}

/** The text of every ```progression (or ~~~progression) block of a note, in order. */
export function progressionFences(text: string): string[] {
    const blocks: string[] = []
    const fence = /^(`{3,}|~{3,})\s*progression\b[^\n]*\n([\s\S]*?)^\1\s*$/gm
    let m: RegExpExecArray | null
    while ((m = fence.exec(text))) blocks.push(m[2]!)
    return blocks
}

const tempoOf = (text: string | null | undefined): number | null => {
    const n = Number(text)
    return text && Number.isFinite(n) && n > 0 ? n : null
}

/** Beats in a bar and the note that is a beat, as the library counts them, and how it reads. */
export interface BackingMeter {
    beatsPerBar: number
    beatUnit: number
    label: string
}

const readTime = (text: string | null | undefined): BackingMeter | null => {
    const clean = typeof text === 'string' ? text.trim() : ''
    if (!clean) return null
    try {
        return { ...parseTime(clean), label: clean }
    } catch {
        return null
    }
}

/** A chord mark of a drawn chart (`[data-mn-bar]`): its sounding notes in `data-mn-voicing`. */
export interface DrawnChartMark {
    getAttribute(name: string): string | null
}

const voicingOf = (mark: DrawnChartMark): number[] =>
    (mark.getAttribute('data-mn-voicing') ?? '')
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite)

/**
 * A note's chord charts as one progression (#69, #89): each chart's chords as the library plays
 * it in time (`chartChords`: a chord a bar, or as its bar lines, beat dots and slashes say; a `%`
 * or empty bar holds the chord before; a bar of N.C. is a bar of silence), each chart's
 * `{transpose}` applied; the first `{time}` and `{tempo}`. A chart without `{time}` counts its
 * beats in the note's time signature (`noteTime`), the meter the loop then plays in. `drawn`
 * gives the chart's drawn chord marks: when they line up with its chords, each chord plays their
 * notes (a `{define}` shape, the sound under a `{capo}`); else names only, and a name the library
 * can't read as a chord (a `{define}` name) is left out. Null when no chord plays.
 */
export function chartBacking(
    text: string,
    options: {
        noteTime?: unknown
        drawn?: (chart: string) => readonly DrawnChartMark[] | null
    } = {}
): BackingSource | null {
    const chords: ProgressionChordInput[] = []
    let time: string | null = null
    let tempo: number | null = null
    const noteTime =
        typeof options.noteTime === 'number'
            ? String(options.noteTime)
            : typeof options.noteTime === 'string'
              ? options.noteTime.trim()
              : ''
    for (const chart of chordCharts(text)) {
        const song = parseChordPro(chart)
        const own = song.time?.trim() || null
        time ??= own
        tempo ??= tempoOf(song.tempo)
        if (!own && readTime(noteTime)) song.time = noteTime
        const read = chartChords(song)
        const marks = options.drawn?.(chart) ?? null
        const lined = marks !== null && marks.length === read.chords.length
        read.chords.forEach((c, i) => {
            const beats = c.beats === undefined ? {} : { beats: c.beats }
            if (c.chord === null) {
                chords.push({ chord: null, pitches: [], ...beats })
                return
            }
            const pitches = lined ? voicingOf(marks[i]!) : []
            if (pitches.length) chords.push({ chord: c.chord, pitches, ...beats })
            else if (readChord(c.chord))
                chords.push(c.beats === undefined ? c.chord : { chord: c.chord, ...beats })
        })
    }
    if (!chords.some((c) => typeof c === 'string' || c.chord !== null)) return null
    return {
        label: 'Chord chart',
        chords: chords.slice(0, MAX_PROGRESSION_BARS),
        time,
        tempo,
        strum: null,
        sound: null
    }
}

/** How many bars a progression lasts: a bar a chord, or its `beats` (part of a bar counts). */
export function backingBars(chords: readonly ProgressionChordInput[], beatsPerBar: number): number {
    const beats = chords.reduce(
        (sum, c) => sum + (typeof c !== 'string' && c.beats !== undefined ? c.beats : beatsPerBar),
        0
    )
    return Math.max(1, Math.ceil(beats / beatsPerBar))
}

/** The chord notes a piece links, one a bar in the order linked; null when none reads. */
export function chordsBacking(symbols: readonly string[]): BackingSource | null {
    const chords = symbols.map((s) => readChord(s.trim())?.symbol).filter((s): s is string => !!s)
    return chords.length
        ? {
              label: 'Linked chord notes',
              chords: chords.slice(0, MAX_PROGRESSION_BARS),
              time: null,
              tempo: null,
              strum: null,
              sound: null
          }
        : null
}

/** What the reader needs from a drawn ```progression block (its `.mn-progression` element). */
export interface ProgressionElement {
    getAttribute(name: string): string | null
    querySelectorAll(selector: string): ArrayLike<{ getAttribute(name: string): string | null }>
}

/**
 * A drawn ```progression block's chords, each with the notes its own play bar sounds
 * (`data-mn-voicing`: the diagram's notes, else the strum's voicing), and its `time:`, `tempo:`
 * and `strum:`. The library reads the numerals, keys and voicings; null when it drew no chord.
 */
export function progressionBacking(el: ProgressionElement, label: string): BackingSource | null {
    const chords: ProgressionChordInput[] = []
    let sound: BackingSource['sound'] = null
    for (const cell of Array.from(el.querySelectorAll('.mn-progression-chord[data-mn-chord]'))) {
        const chord = cell.getAttribute('data-mn-chord')
        if (!chord) continue
        const instrument = cell.getAttribute('data-mn-sound')
        if (!sound && (instrument === 'piano' || instrument === 'guitar')) sound = instrument
        const pitches = (cell.getAttribute('data-mn-voicing') ?? '')
            .split(' ')
            .filter(Boolean)
            .map(Number)
            .filter(Number.isFinite)
        chords.push(pitches.length ? { chord, pitches } : chord)
    }
    if (!chords.length) return null
    return {
        label,
        chords: chords.slice(0, MAX_PROGRESSION_BARS),
        time: el.getAttribute('data-mn-time'),
        tempo: tempoOf(el.getAttribute('data-mn-tempo')),
        strum: el.getAttribute('data-mn-strum'),
        sound
    }
}

/**
 * The meter of a backing loop: the progression's own time (a block's `time:`, a chart's
 * `{time}`), else the note's time signature (as the metronome takes it, #77), else 4/4.
 * Compound times (6/8) are counted in dotted beats by the library.
 */
export function backingMeter(sourceTime: string | null, noteTime: unknown): BackingMeter {
    return (
        readTime(sourceTime) ??
        readTime(typeof noteTime === 'number' ? String(noteTime) : (noteTime as string | null)) ?? {
            beatsPerBar: 4,
            beatUnit: 4,
            label: '4/4'
        }
    )
}

export const clampBackingBpm = (bpm: number): number =>
    Math.round(Math.min(MAX_BACKING_BPM, Math.max(MIN_BACKING_BPM, bpm)))

/**
 * Where the loop starts: the note's current BPM (the speed it is practised at), else the
 * progression's own tempo, else 80; within the library's 20–240.
 */
export function backingBpm(itemBpm: number | null, sourceTempo: number | null): number {
    const bpm = [itemBpm, sourceTempo].find(
        (n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
    )
    return clampBackingBpm(bpm ?? DEFAULT_BACKING_BPM)
}
