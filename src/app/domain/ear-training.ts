/**
 * Ear training (#72): hear an interval, a chord, a scale or a scale degree and name it. The four
 * kinds' settings and their words, their items and spots, the guided set and what each question
 * plays. Pure: the drills (`note-drill.ts`) ask, the modal plays and draws.
 */
import type { NoteEvent } from '@dsebastien/music-notation'
import type { SpotStat } from './note-drill'

export type EarInstrument = 'guitar' | 'piano'
/** How an interval sounds: the second note above, below, or both at once (harmonic). */
export type IntervalWay = 'up' | 'down' | 'together'
export type ChordStyle = 'block' | 'arpeggio'

export type EarTrainingSetting =
    | { kind: 'intervals-ear'; instrument: EarInstrument; intervals: number[]; ways: IntervalWay[] }
    | { kind: 'chords-ear'; instrument: EarInstrument; qualities: string[]; styles: ChordStyle[] }
    | { kind: 'scales-ear'; instrument: EarInstrument; scales: string[] }
    | { kind: 'degrees-ear'; instrument: EarInstrument; chromatic: boolean; key: string | null }

export type EarTrainingKind = EarTrainingSetting['kind']

export const EAR_TRAINING_KINDS: readonly EarTrainingKind[] = [
    'intervals-ear',
    'chords-ear',
    'scales-ear',
    'degrees-ear'
]

export const isEarTrainingKind = (kind: string): kind is EarTrainingKind =>
    (EAR_TRAINING_KINDS as readonly string[]).includes(kind)

const WAYS: readonly IntervalWay[] = ['up', 'down', 'together']
const STYLES: readonly ChordStyle[] = ['block', 'arpeggio']
const SOUNDS: readonly EarInstrument[] = ['guitar', 'piano']

/** Interval names by semitones, 1 (m2) to 24 (P15). */
const INTERVAL_NAMES = [
    'm2',
    'M2',
    'm3',
    'M3',
    'P4',
    'TT',
    'P5',
    'm6',
    'M6',
    'm7',
    'M7',
    'P8',
    'm9',
    'M9',
    'm10',
    'M10',
    'P11',
    'A11',
    'P12',
    'm13',
    'M13',
    'm14',
    'M14',
    'P15'
]

/** The interval's name ("P5"); semitones from 1 to 24. */
export const intervalName = (semitones: number): string => INTERVAL_NAMES[semitones - 1] ?? ''
const semitonesOf = (name: string): number | null => {
    const i = INTERVAL_NAMES.indexOf(name)
    return i < 0 ? null : i + 1
}

/** Every interval, in semitones (the setup's buttons). */
export const INTERVALS: readonly number[] = INTERVAL_NAMES.map((_, i) => i + 1)

/** The interval's name in words, for screen readers ("perfect 5th"). */
export function intervalWords(semitones: number): string {
    const words = [
        'minor 2nd',
        'major 2nd',
        'minor 3rd',
        'major 3rd',
        'perfect 4th',
        'tritone',
        'perfect 5th',
        'minor 6th',
        'major 6th',
        'minor 7th',
        'major 7th',
        'octave',
        'minor 9th',
        'major 9th',
        'minor 10th',
        'major 10th',
        'perfect 11th',
        'augmented 11th',
        'perfect 12th',
        'minor 13th',
        'major 13th',
        'minor 14th',
        'major 14th',
        'two octaves'
    ]
    return words[semitones - 1] ?? ''
}

/** The guided order of the intervals within an octave: the most distinct first. */
const INTERVAL_GUIDED = [12, 4, 7, 3, 5, 2, 9, 10, 1, 8, 11, 6]

/** Chord qualities, in the setup's order, with their notes above the root. */
export const CHORD_QUALITIES: readonly { name: string; notes: number[] }[] = [
    { name: 'major', notes: [0, 4, 7] },
    { name: 'minor', notes: [0, 3, 7] },
    { name: 'diminished', notes: [0, 3, 6] },
    { name: 'augmented', notes: [0, 4, 8] },
    { name: 'sus2', notes: [0, 2, 7] },
    { name: 'sus4', notes: [0, 5, 7] },
    { name: 'dominant 7th', notes: [0, 4, 7, 10] },
    { name: 'major 7th', notes: [0, 4, 7, 11] },
    { name: 'minor 7th', notes: [0, 3, 7, 10] },
    { name: 'half-diminished', notes: [0, 3, 6, 10] },
    { name: 'diminished 7th', notes: [0, 3, 6, 9] }
]
const CHORD_GUIDED = [
    'major',
    'minor',
    'diminished',
    'augmented',
    'dominant 7th',
    'major 7th',
    'minor 7th',
    'sus4',
    'sus2',
    'half-diminished',
    'diminished 7th'
]

/** Scales and modes, in the setup's order, with their notes above the root (the octave left out). */
export const EAR_SCALES: readonly { name: string; notes: number[] }[] = [
    { name: 'major', notes: [0, 2, 4, 5, 7, 9, 11] },
    { name: 'natural minor', notes: [0, 2, 3, 5, 7, 8, 10] },
    { name: 'harmonic minor', notes: [0, 2, 3, 5, 7, 8, 11] },
    { name: 'melodic minor', notes: [0, 2, 3, 5, 7, 9, 11] },
    { name: 'major pentatonic', notes: [0, 2, 4, 7, 9] },
    { name: 'minor pentatonic', notes: [0, 3, 5, 7, 10] },
    { name: 'blues', notes: [0, 3, 5, 6, 7, 10] },
    { name: 'dorian', notes: [0, 2, 3, 5, 7, 9, 10] },
    { name: 'phrygian', notes: [0, 1, 3, 5, 7, 8, 10] },
    { name: 'lydian', notes: [0, 2, 4, 6, 7, 9, 11] },
    { name: 'mixolydian', notes: [0, 2, 4, 5, 7, 9, 10] },
    { name: 'locrian', notes: [0, 1, 3, 5, 6, 8, 10] }
]
const SCALE_GUIDED = [
    'major',
    'natural minor',
    'major pentatonic',
    'minor pentatonic',
    'harmonic minor',
    'blues',
    'dorian',
    'mixolydian',
    'lydian',
    'phrygian',
    'melodic minor',
    'locrian'
]

/** Scale degrees, low to high, with their semitones above the tonic; `chromatic` ones are asked only in chromatic drills. */
const DEGREES: readonly { name: string; semitones: number; chromatic: boolean }[] = [
    { name: '1', semitones: 0, chromatic: false },
    { name: 'b2', semitones: 1, chromatic: true },
    { name: '2', semitones: 2, chromatic: false },
    { name: 'b3', semitones: 3, chromatic: true },
    { name: '3', semitones: 4, chromatic: false },
    { name: '4', semitones: 5, chromatic: false },
    { name: '#4', semitones: 6, chromatic: true },
    { name: '5', semitones: 7, chromatic: false },
    { name: 'b6', semitones: 8, chromatic: true },
    { name: '6', semitones: 9, chromatic: false },
    { name: 'b7', semitones: 10, chromatic: true },
    { name: '7', semitones: 11, chromatic: false }
]
const DEGREE_GUIDED = ['1', '5', '3', '4', '2', '6', '7', 'b3', 'b7', 'b6', '#4', 'b2']

/** The keys a degrees drill can keep to, as the setup lists them. */
export const EAR_KEYS: readonly string[] = [
    'C',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'G',
    'Ab',
    'A',
    'Bb',
    'B'
]
const CLASS: Record<string, number> = {
    'C': 0,
    'C#': 1,
    'Db': 1,
    'D': 2,
    'D#': 3,
    'Eb': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'Gb': 6,
    'G': 7,
    'G#': 8,
    'Ab': 8,
    'A': 9,
    'A#': 10,
    'Bb': 10,
    'B': 11
}

/** A new drill of an ear training kind: piano, the usual first items. */
export function earDefaults<K extends EarTrainingKind>(
    kind: K
): Extract<EarTrainingSetting, { kind: K }>
export function earDefaults(kind: EarTrainingKind): EarTrainingSetting
export function earDefaults(kind: EarTrainingKind): EarTrainingSetting {
    switch (kind) {
        case 'intervals-ear':
            return { kind, instrument: 'piano', intervals: INTERVALS.slice(0, 12), ways: ['up'] }
        case 'chords-ear':
            return {
                kind,
                instrument: 'piano',
                qualities: ['major', 'minor', 'diminished', 'augmented'],
                styles: ['block']
            }
        case 'scales-ear':
            return {
                kind,
                instrument: 'piano',
                scales: [
                    'major',
                    'natural minor',
                    'harmonic minor',
                    'major pentatonic',
                    'minor pentatonic'
                ]
            }
        case 'degrees-ear':
            return { kind, instrument: 'piano', chromatic: false, key: null }
    }
}

const inOrder = <T>(items: readonly T[], order: readonly T[]): T[] =>
    order.filter((o) => items.includes(o))

/** Interval names in words: runs of 3 or more adjacent intervals as "m2-P8". */
function intervalListWords(intervals: readonly number[]): string {
    const sorted = [...new Set(intervals)].sort((a, b) => a - b)
    const parts: string[] = []
    for (let i = 0; i < sorted.length;) {
        let j = i
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++
        if (j - i >= 2) parts.push(`${intervalName(sorted[i]!)}-${intervalName(sorted[j]!)}`)
        else for (let k = i; k <= j; k++) parts.push(intervalName(sorted[k]!))
        i = j + 1
    }
    return parts.join(', ')
}

/** The setting in words, the sound last: the `drill_setting` value ("m2-P8, up, piano"). */
export function earWords(setting: EarTrainingSetting): string {
    const parts: string[] = []
    switch (setting.kind) {
        case 'intervals-ear':
            parts.push(intervalListWords(setting.intervals), ...inOrder(setting.ways, WAYS))
            break
        case 'chords-ear':
            parts.push(
                ...inOrder(
                    setting.qualities,
                    CHORD_QUALITIES.map((q) => q.name)
                ),
                ...inOrder(setting.styles, STYLES)
            )
            break
        case 'scales-ear':
            parts.push(
                ...inOrder(
                    setting.scales,
                    EAR_SCALES.map((s) => s.name)
                )
            )
            break
        case 'degrees-ear':
            parts.push(
                setting.chromatic ? 'chromatic' : 'diatonic',
                setting.key ? `key ${setting.key}` : 'any key'
            )
    }
    parts.push(setting.instrument)
    return parts.join(', ')
}

/** A key's name as the setup writes it ("bb" → "Bb", "f#" → "F#"); null when it isn't one. */
function keyOf(text: string): string | null {
    const m = /^([a-g])([#b]?)$/i.exec(text.trim())
    if (!m) return null
    const name = `${m[1]!.toUpperCase()}${m[2]!.toLowerCase()}`
    return name in CLASS ? name : null
}

/**
 * A setting from its words (a drill note's `drill_setting`), its parts in any order, any case
 * (interval names keep theirs: m2 is not M2); null when a part doesn't read, the sound is missing,
 * or fewer than two items are left to ask.
 */
export function parseEarSetting(kind: EarTrainingKind, words: string): EarTrainingSetting | null {
    const parts = words
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    const sounds = parts.filter((p) => (SOUNDS as readonly string[]).includes(p.toLowerCase()))
    if (sounds.length !== 1) return null
    const instrument = sounds[0]!.toLowerCase() as EarInstrument
    const rest = parts.filter((p) => p !== sounds[0])
    const lower = (p: string) => p.toLowerCase()
    switch (kind) {
        case 'intervals-ear': {
            const intervals = new Set<number>()
            const ways = new Set<IntervalWay>()
            for (const part of rest) {
                const way = WAYS.find((w) => w === lower(part))
                if (way) {
                    ways.add(way)
                    continue
                }
                const range = /^(\S+)-(\S+)$/.exec(part)
                if (range) {
                    const from = semitonesOf(range[1]!)
                    const to = semitonesOf(range[2]!)
                    if (from === null || to === null || from >= to) return null
                    for (let s = from; s <= to; s++) intervals.add(s)
                    continue
                }
                const one = semitonesOf(part)
                if (one === null) return null
                intervals.add(one)
            }
            if (intervals.size < 2 || !ways.size) return null
            return {
                kind,
                instrument,
                intervals: [...intervals].sort((a, b) => a - b),
                ways: inOrder([...ways], WAYS)
            }
        }
        case 'chords-ear': {
            const names = CHORD_QUALITIES.map((q) => q.name)
            const qualities: string[] = []
            const styles: ChordStyle[] = []
            for (const part of rest) {
                const style = STYLES.find((s) => s === lower(part))
                const quality = names.find((n) => n === lower(part))
                if (style) styles.push(style)
                else if (quality) qualities.push(quality)
                else return null
            }
            const q = inOrder(qualities, names)
            if (q.length < 2 || !styles.length) return null
            return { kind, instrument, qualities: q, styles: inOrder(styles, STYLES) }
        }
        case 'scales-ear': {
            const names = EAR_SCALES.map((s) => s.name)
            const scales: string[] = []
            for (const part of rest) {
                const scale = names.find((n) => n === lower(part))
                if (!scale) return null
                scales.push(scale)
            }
            const s = inOrder(scales, names)
            return s.length < 2 ? null : { kind, instrument, scales: s }
        }
        case 'degrees-ear': {
            let chromatic: boolean | null = null
            let key: string | null | undefined
            for (const part of rest) {
                const p = lower(part)
                if (p === 'diatonic' || p === 'chromatic') {
                    if (chromatic !== null) return null
                    chromatic = p === 'chromatic'
                } else if (p === 'any key') {
                    if (key !== undefined) return null
                    key = null
                } else {
                    const m = /^key\s+(\S+)$/i.exec(part)
                    const name = m ? keyOf(m[1]!) : null
                    if (!name || key !== undefined) return null
                    key = name
                }
            }
            if (chromatic === null || key === undefined) return null
            return { kind, instrument, chromatic, key }
        }
    }
}

/** The items a setting asks, in the guided order (the most distinct first). */
export function earItems(setting: EarTrainingSetting): string[] {
    switch (setting.kind) {
        case 'intervals-ear': {
            const order = [...INTERVAL_GUIDED, ...INTERVAL_GUIDED.map((s) => s + 12)]
            return inOrder(setting.intervals, order).map(intervalName)
        }
        case 'chords-ear':
            return inOrder(setting.qualities, CHORD_GUIDED)
        case 'scales-ear':
            return inOrder(setting.scales, SCALE_GUIDED)
        case 'degrees-ear':
            return DEGREE_GUIDED.filter(
                (d) => setting.chromatic || !DEGREES.find((x) => x.name === d)!.chromatic
            )
    }
}

/** Items in the setup's order (intervals by size, degrees low to high): the answer buttons. */
export function earChoices(setting: EarTrainingSetting, items: readonly string[]): string[] {
    switch (setting.kind) {
        case 'intervals-ear':
            return INTERVAL_NAMES.filter((n) => items.includes(n))
        case 'chords-ear':
            return CHORD_QUALITIES.map((q) => q.name).filter((n) => items.includes(n))
        case 'scales-ear':
            return EAR_SCALES.map((s) => s.name).filter((n) => items.includes(n))
        case 'degrees-ear':
            return DEGREES.map((d) => d.name).filter((n) => items.includes(n))
    }
}

/**
 * The spots of a setting (the map's keys), in the setup's order: an interval with its way
 * ("P5 up"), else the item itself. Only those of `items` when given (the guided set).
 */
export function earSpots(
    setting: EarTrainingSetting,
    items: readonly string[] = earItems(setting)
): string[] {
    const choices = earChoices(setting, items)
    if (setting.kind !== 'intervals-ear') return choices
    const ways = inOrder(setting.ways, WAYS)
    return choices.flatMap((name) => ways.map((way) => `${name} ${way}`))
}

/** The item a spot asks ("P5 up" → "P5"). */
export const itemOfSpot = (setting: EarTrainingSetting, spot: string): string =>
    setting.kind === 'intervals-ear' ? (spot.split(' ')[0] ?? spot) : spot

/**
 * Guided ear training: the first items of the guided order, 2 to start; the next one joins when
 * every spot of the items so far is cleared (`clearStreak` fast right answers in a row). An item
 * once asked stays, so the set never shrinks.
 */
export function guidedItems(
    setting: EarTrainingSetting,
    stats: Map<string, SpotStat>,
    clearStreak: number
): string[] {
    const items = earItems(setting)
    const spotsOf = (item: string) => earSpots(setting, [item])
    let count = Math.min(2, items.length)
    items.forEach((item, i) => {
        if (spotsOf(item).some((s) => (stats.get(s)?.asked ?? 0) > 0))
            count = Math.max(count, i + 1)
    })
    const cleared = (item: string) =>
        spotsOf(item).every((s) => (stats.get(s)?.streak ?? 0) >= clearStreak)
    while (count < items.length && items.slice(0, count).every(cleared)) count++
    return items.slice(0, count)
}

/** The item the next guided drill adds once the current ones are cleared; null when all are in. */
export function nextGuidedItem(
    setting: EarTrainingSetting,
    stats: Map<string, SpotStat>,
    clearStreak: number
): string | null {
    return earItems(setting)[guidedItems(setting, stats, clearStreak).length] ?? null
}

/** An ear training question: what sounds, and the buttons to name it. */
export interface EarQuestion {
    type: 'hear-name'
    kind: EarTrainingKind
    spot: string
    prompt: string
    /** The right button. */
    answer: string
    choices: string[]
    /** What the question plays first (a degree's cadence included). */
    sound: NoteEvent[]
    /** Play again: the sound, or a degree's note only. */
    again: NoteEvent[]
    /** When the last note of `sound` starts (seconds): the answer time counts from it. */
    last: number
}

const WAY_WORDS: Record<IntervalWay, string> = {
    up: 'going up',
    down: 'going down',
    together: 'played together'
}

const between = (random: () => number, low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1))
/** A time in seconds, rounded to the hundredth (0.45 × 3 is 1.35, not 1.3500000000000001). */
const at = (beats: number, step: number) => Math.round(beats * step * 100) / 100

/** The question of a spot: a new root at random, what sounds, the prompt and the buttons. */
export function earQuestion(
    setting: EarTrainingSetting,
    spot: string,
    choices: string[],
    random: () => number
): EarQuestion {
    const base = { type: 'hear-name' as const, kind: setting.kind, spot, choices }
    switch (setting.kind) {
        case 'intervals-ear': {
            const [name, wayWord] = spot.split(' ')
            const way: IntervalWay = WAYS.find((w) => w === wayWord) ?? 'up'
            const size = semitonesOf(name ?? '') ?? 12
            // Both notes from C3 to G5.
            const low = between(random, 48, 79 - size)
            const high = low + size
            const sound: NoteEvent[] =
                way === 'together'
                    ? [
                          { midi: low, time: 0, duration: 1.5 },
                          { midi: high, time: 0, duration: 1.5 }
                      ]
                    : [
                          { midi: way === 'up' ? low : high, time: 0, duration: 1 },
                          { midi: way === 'up' ? high : low, time: 1, duration: 1.5 }
                      ]
            return {
                ...base,
                prompt: `Name the interval you hear (${WAY_WORDS[way]})`,
                answer: name ?? spot,
                sound,
                again: sound,
                last: way === 'together' ? 0 : 1
            }
        }
        case 'chords-ear': {
            const notes = CHORD_QUALITIES.find((q) => q.name === spot)?.notes ?? [0, 4, 7]
            const root = between(random, 48, 59)
            const style = setting.styles.length
                ? setting.styles[Math.floor(random() * setting.styles.length)]!
                : 'block'
            const end = at(notes.length - 1, 0.45) + 1.5
            const sound: NoteEvent[] = notes.map((n, i) =>
                style === 'block'
                    ? { midi: root + n, time: 0, duration: 2 }
                    : { midi: root + n, time: at(i, 0.45), duration: end - at(i, 0.45) }
            )
            return {
                ...base,
                prompt: 'Name the chord you hear',
                answer: spot,
                sound,
                again: sound,
                last: style === 'block' ? 0 : at(notes.length - 1, 0.45)
            }
        }
        case 'scales-ear': {
            const notes = EAR_SCALES.find((s) => s.name === spot)?.notes ?? [0, 2, 4, 5, 7, 9, 11]
            const root = between(random, 55, 66)
            const up = [...notes, 12]
            const run = [...up, ...up.slice(0, -1).reverse()]
            const sound: NoteEvent[] = run.map((n, i) => ({
                midi: root + n,
                time: at(i, 0.35),
                duration: i === run.length - 1 ? 1 : 0.4
            }))
            return {
                ...base,
                prompt: 'Name the scale you hear',
                answer: spot,
                sound,
                again: sound,
                last: at(run.length - 1, 0.35)
            }
        }
        case 'degrees-ear': {
            const pitchClass =
                setting.key !== null ? (CLASS[setting.key] ?? 0) : between(random, 0, 11)
            // The tonic from G3 (55) to F#4 (66).
            const tonic = 55 + ((pitchClass - 7 + 12) % 12)
            const chords = [
                [-12, 0, 4, 7],
                [-7, 0, 5, 9],
                [-5, -1, 2, 7],
                [-12, 0, 4, 7]
            ]
            const cadence: NoteEvent[] = chords.flatMap((chord, i) =>
                chord.map((n) => ({ midi: tonic + n, time: at(i, 0.8), duration: 0.75 }))
            )
            const semitones = DEGREES.find((d) => d.name === spot)?.semitones ?? 0
            const time = at(chords.length - 1, 0.8) + 0.8 + 0.6
            const note = {
                midi: tonic + semitones,
                time: Math.round(time * 100) / 100,
                duration: 1.5
            }
            return {
                ...base,
                prompt: 'Name the degree of the last note',
                answer: spot,
                sound: [...cadence, note],
                again: [{ ...note, time: 0 }],
                last: note.time
            }
        }
    }
}
