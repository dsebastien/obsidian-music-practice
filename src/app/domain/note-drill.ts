/**
 * Note, chord and scale drills (#73): the kinds and their settings in words, the weak-spot map
 * (`drill_stats`), the questions (6 in 10 from the weakest spots) and the score. Pure: the service
 * reads the vault, the modal draws.
 */
import {
    listNoteSet,
    midiOf,
    parseChordName,
    progressionChords,
    readChord,
    scaleNoteSet
} from '@dsebastien/music-notation'
import { progressionOf } from './progression'
import { progressionFences } from './backing'
import type { ReviewResult } from './review'
import {
    earChoices,
    earDefaults,
    earItems,
    earQuestion,
    earSpots,
    earWords,
    guidedItems,
    isEarTrainingKind,
    parseEarSetting,
    type EarQuestion,
    type EarTrainingKind,
    type EarTrainingSetting
} from './ear-training'

export type DrillKind =
    | 'fretboard'
    | 'keyboard'
    | 'chords'
    | 'scales'
    | 'fretboard-ear'
    | 'keyboard-ear'
    // Ear training (#72): name an interval, a chord, a scale or a degree you hear.
    | EarTrainingKind
export type DrillAsk = 'find' | 'name' | 'both'
/** Where the chords or scales come from (decision 10). */
export type DrillSource = 'notes' | 'pieces' | 'focus' | 'library'
export type DrillInstrument = 'guitar' | 'piano'

export type DrillSetting =
    | { kind: 'fretboard'; strings: number[]; frets: [number, number]; ask: DrillAsk }
    | { kind: 'keyboard'; keys: [number, number]; ask: DrillAsk }
    | { kind: 'chords'; instrument: DrillInstrument; source: DrillSource; family?: string }
    | { kind: 'scales'; instrument: DrillInstrument; source: DrillSource; ask: DrillAsk }
    // By ear (#91): a note sounds, found anywhere in the range; `exact` asks the same octave,
    // `reference` plays a reference note first.
    | {
          kind: 'fretboard-ear'
          strings: number[]
          frets: [number, number]
          exact: boolean
          reference: boolean
      }
    | { kind: 'keyboard-ear'; keys: [number, number]; exact: boolean; reference: boolean }
    | EarTrainingSetting

/** The drill kinds that play a note to find on the drawing (#91). */
export const isNoteEarKind = (kind: DrillKind): kind is 'fretboard-ear' | 'keyboard-ear' =>
    kind === 'fretboard-ear' || kind === 'keyboard-ear'

/** The drill kinds that play their questions (#91, #72): they need playback. */
export const isEarKind = (kind: DrillKind): boolean =>
    isNoteEarKind(kind) || isEarTrainingKind(kind)

export { isEarTrainingKind }

/** The `drill_kind` values, as the vault's note types allow them. */
export const KIND_LABELS: Record<DrillKind, string> = {
    'fretboard': 'Fretboard notes',
    'keyboard': 'Keyboard notes',
    'chords': 'Chord names',
    'scales': 'Scale shapes',
    'fretboard-ear': 'Fretboard by ear',
    'keyboard-ear': 'Keyboard by ear',
    'intervals-ear': 'Intervals by ear',
    'chords-ear': 'Chords by ear',
    'scales-ear': 'Scales by ear',
    'degrees-ear': 'Degrees by ear'
}

export function kindOfLabel(label: unknown): DrillKind | null {
    if (typeof label !== 'string') return null
    const wanted = label.trim().toLowerCase()
    const found = Object.entries(KIND_LABELS).find(([, l]) => l.toLowerCase() === wanted)
    return found ? (found[0] as DrillKind) : null
}

export interface DrillRules {
    /** Questions per drill. */
    questions: number
    /** Share of the questions from the weak spots (0 to 1). */
    weakShare: number
    /** Right answers in a row, each faster than `fastSeconds`, that clear a weak spot. */
    clearStreak: number
    fastSeconds: number
    /** Ear training asks the guided set (2 items, one more once they are cleared); on unless false. */
    guided?: boolean
}

/**
 * A new drill of a kind. On a narrow touch screen (`narrow`) a keyboard drill starts on one octave
 * (C4-B4): two octaves fit a phone with black keys under 24 px, too small to tap.
 */
export function drillDefaults(kind: DrillKind, narrow: boolean): DrillSetting {
    switch (kind) {
        case 'fretboard':
            return { kind: 'fretboard', strings: [6], frets: [0, 5], ask: 'both' }
        case 'keyboard':
            return { kind: 'keyboard', keys: narrow ? [60, 71] : [48, 71], ask: 'both' }
        case 'chords':
            return { kind: 'chords', instrument: 'guitar', source: 'notes' }
        case 'scales':
            return { kind: 'scales', instrument: 'guitar', source: 'notes', ask: 'name' }
        case 'fretboard-ear':
            return {
                kind: 'fretboard-ear',
                strings: [6],
                frets: [0, 5],
                exact: false,
                reference: false
            }
        case 'keyboard-ear':
            return {
                kind: 'keyboard-ear',
                keys: narrow ? [60, 71] : [48, 71],
                exact: false,
                reference: false
            }
        default:
            return earDefaults(kind)
    }
}

export const DEFAULT_DRILL_RULES: DrillRules = {
    questions: 20,
    weakShare: 0.6,
    clearStreak: 3,
    fastSeconds: 2,
    guided: true
}

/** Standard tuning, string 1 (high E) first, as MIDI. */
const STRINGS = [64, 59, 55, 50, 45, 40]
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** A pitch's name in sharps ("A#"), without its octave. */
export const noteName = (pitch: number): string => SHARPS[((pitch % 12) + 12) % 12]!
const keyName = (pitch: number) => `${noteName(pitch)}${Math.floor(pitch / 12) - 1}`
/** The pitch class of a note name ("Bb" and "A#" are 10); null when it isn't one. */
const classOf = (name: string): number | null => {
    const midi = midiOf(`${name.trim()}4`)
    return midi === null ? null : midi % 12
}

const SOURCE_WORDS: Record<DrillSource, string> = {
    notes: 'from my notes',
    pieces: 'from my pieces',
    focus: 'from my focus',
    library: 'from the library'
}

const listWords = (numbers: number[]): string => {
    const sorted = [...numbers].sort((a, b) => a - b)
    const run = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1)
    if (sorted.length === 1) return `string ${sorted[0]}`
    if (run && sorted.length > 2) return `strings ${sorted[0]}-${sorted.at(-1)}`
    return `strings ${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`
}
const askWords = (ask: DrillAsk) => (ask === 'both' ? '' : `, ${ask}`)
const noteEarWords = (s: { exact: boolean; reference: boolean }) =>
    `${s.exact ? ', exact octave' : ''}${s.reference ? ', with a reference' : ''}`

/** The setting in words: the `drill_setting` value ("string 5, frets 0-5"). */
export function settingWords(setting: DrillSetting): string {
    switch (setting.kind) {
        case 'fretboard':
            return `${listWords(setting.strings)}, frets ${setting.frets[0]}-${setting.frets[1]}${askWords(setting.ask)}`
        case 'keyboard':
            return `keys ${keyName(setting.keys[0])}-${keyName(setting.keys[1])}${askWords(setting.ask)}`
        case 'chords':
            return `${setting.family ? `${setting.family} chords, ` : ''}${SOURCE_WORDS[setting.source]}`
        case 'scales':
            return `${SOURCE_WORDS[setting.source]}${askWords(setting.ask)}`
        case 'fretboard-ear':
            return `${listWords(setting.strings)}, frets ${setting.frets[0]}-${setting.frets[1]}${noteEarWords(setting)}`
        case 'keyboard-ear':
            return `keys ${keyName(setting.keys[0])}-${keyName(setting.keys[1])}${noteEarWords(setting)}`
        default:
            return earWords(setting)
    }
}

/** The drill note's title, without the type's affixes: "Fretboard notes, string 5, frets 0-5". */
export const drillTitle = (setting: DrillSetting): string =>
    `${KIND_LABELS[setting.kind]}, ${settingWords(setting)}`

const readAsk = (words: string): { ask: DrillAsk; rest: string } => {
    const m = /,\s*(find|name)$/.exec(words)
    return m
        ? { ask: m[1] as DrillAsk, rest: words.slice(0, m.index) }
        : { ask: 'both', rest: words }
}
const readSource = (words: string): DrillSource | null => {
    const found = Object.entries(SOURCE_WORDS).find(([, w]) => w === words.trim())
    return found ? (found[0] as DrillSource) : null
}

/** A setting from its words (a drill note's `drill_setting`); null when they don't read. */
export function parseSetting(
    kind: DrillKind,
    words: string,
    instrument: DrillInstrument = 'guitar'
): DrillSetting | null {
    // Ear training: the sound is in the words, whatever the note's type.
    if (isEarTrainingKind(kind)) return parseEarSetting(kind, words)
    if (isNoteEarKind(kind)) {
        // The flags come last, in this order; a find or name doesn't apply to a drill by ear.
        let text = words.trim()
        const reference = /,\s*with a reference$/.test(text)
        if (reference) text = text.replace(/,\s*with a reference$/, '')
        const exact = /,\s*exact octave$/.test(text)
        if (exact) text = text.replace(/,\s*exact octave$/, '')
        if (/,\s*(find|name)$/.test(text)) return null
        const base = parseSetting(kind === 'fretboard-ear' ? 'fretboard' : 'keyboard', text)
        if (base?.kind === 'fretboard')
            return {
                kind: 'fretboard-ear',
                strings: base.strings,
                frets: base.frets,
                exact,
                reference
            }
        if (base?.kind === 'keyboard')
            return { kind: 'keyboard-ear', keys: base.keys, exact, reference }
        return null
    }
    const { ask, rest } = readAsk(words.trim())
    if (kind === 'fretboard') {
        const m = /^strings?\s+(.+?),\s*frets\s+(\d+)-(\d+)$/.exec(rest)
        if (!m) return null
        const strings = m[1]!.includes('-')
            ? (() => {
                  const [a, b] = m[1]!.split('-').map(Number)
                  return Array.from({ length: b! - a! + 1 }, (_, i) => a! + i)
              })()
            : m[1]!.split(/,\s*|\s+and\s+/).map(Number)
        const frets: [number, number] = [Number(m[2]), Number(m[3])]
        if (
            !strings.length ||
            strings.some((s) => !Number.isInteger(s) || s < 1 || s > 6) ||
            frets[0] > frets[1] ||
            frets[1] > 24
        )
            return null
        return { kind, strings: [...new Set(strings)].sort((a, b) => a - b), frets, ask }
    }
    if (kind === 'keyboard') {
        const m = /^keys\s+(\S+)-(\S+)$/.exec(rest)
        const from = m ? midiOf(m[1]!) : null
        const to = m ? midiOf(m[2]!) : null
        if (from === null || to === null || from >= to) return null
        return { kind, keys: [from, to], ask }
    }
    if (kind === 'chords') {
        const m = /^(?:(.+?) chords,\s*)?(.+)$/.exec(words.trim())
        const source = m ? readSource(m[2]!) : null
        if (!source) return null
        return { kind, instrument, source, ...(m![1] ? { family: m![1] } : {}) }
    }
    const source = readSource(rest)
    return source ? { kind, instrument, source, ask } : null
}

/** One spot of the map: its answers so far. */
export interface SpotStat {
    /** `s5f3`, `F#4`, a chord symbol or a scale name. */
    spot: string
    /** What a right answer is, when it isn't the spot itself (the note at `s5f3`). */
    answer: string
    right: number
    asked: number
    /** Average answer time, in seconds. */
    seconds: number
    /** Right answers in a row, each faster than the fast time. */
    streak: number
}

const STAT = /^(.+):\s*(\d+)\/(\d+)\s+(\d+(?:\.\d+)?)s(?:,\s*(\d+) in a row)?$/
const FRET_SPOT = /^(s\d+f\d+)(?:\s+(.+))?$/

/** An item as text: a hand-written YAML item without quotes reads as a map (`s5f3 C: 7/9 1.8s`). */
const itemText = (item: unknown): string[] => {
    if (item === null || item === undefined) return []
    if (typeof item === 'object' && !Array.isArray(item))
        return Object.entries(item as Record<string, unknown>).map(
            ([k, v]) => `${k}: ${typeof v === 'string' || typeof v === 'number' ? v : ''}`
        )
    return typeof item === 'string' || typeof item === 'number' ? [String(item)] : []
}

/**
 * The map from `drill_stats`; items it can't read (or with no question) are kept as written. A
 * spot written twice is merged: its counts add up, its time is weighted, the later streak wins.
 */
export function parseStats(value: unknown): { stats: Map<string, SpotStat>; other: string[] } {
    const items = (Array.isArray(value) ? value : [value]).flatMap(itemText)
    const stats = new Map<string, SpotStat>()
    const other: string[] = []
    for (const item of items) {
        const text = item.trim()
        const m = STAT.exec(text)
        if (!m || Number(m[3]) === 0 || Number(m[2]) > Number(m[3])) {
            if (text) other.push(text)
            continue
        }
        const label = m[1]!.trim()
        const fret = FRET_SPOT.exec(label)
        const spot = fret ? fret[1]! : label
        const read: SpotStat = {
            spot,
            answer: fret?.[2] ?? '',
            right: Number(m[2]),
            asked: Number(m[3]),
            seconds: Number(m[4]),
            streak: m[5] ? Number(m[5]) : 0
        }
        const before = stats.get(spot)
        stats.set(
            spot,
            before
                ? {
                      ...read,
                      answer: read.answer || before.answer,
                      right: before.right + read.right,
                      asked: before.asked + read.asked,
                      seconds:
                          (before.seconds * before.asked + read.seconds * read.asked) /
                          (before.asked + read.asked)
                  }
                : read
        )
    }
    return { stats, other }
}

/** One item of `drill_stats`: `s5f3 C: 7/9 1.8s`, plus `, 2 in a row` while a streak runs. */
export function formatStat(s: SpotStat): string {
    const label = s.answer ? `${s.spot} ${s.answer}` : s.spot
    const seconds = Math.round(s.seconds * 10) / 10
    return `${label}: ${s.right}/${s.asked} ${seconds}s${s.streak > 0 ? `, ${s.streak} in a row` : ''}`
}

/** One answer of a drill. */
export interface Answer {
    spot: string
    answer: string
    right: boolean
    seconds: number
}

/** The map after a drill's answers (a new map; the one given is unchanged). */
export function mergeStats(
    stats: Map<string, SpotStat>,
    answers: Answer[],
    rules: DrillRules
): Map<string, SpotStat> {
    const out = new Map([...stats].map(([k, v]) => [k, { ...v }]))
    for (const a of answers) {
        const s = out.get(a.spot) ?? {
            spot: a.spot,
            answer: a.answer,
            right: 0,
            asked: 0,
            seconds: 0,
            streak: 0
        }
        s.seconds = (s.seconds * s.asked + a.seconds) / (s.asked + 1)
        s.asked++
        if (a.right) s.right++
        s.streak = a.right && a.seconds < rules.fastSeconds ? s.streak + 1 : 0
        if (a.answer) s.answer = a.answer
        out.set(a.spot, s)
    }
    return out
}

/**
 * Weak spots, weakest first (most misses, then slowest): a miss or a slow average, and not yet
 * cleared by a streak of fast right answers.
 */
export function weakSpots(stats: Map<string, SpotStat>, rules: DrillRules): SpotStat[] {
    return [...stats.values()]
        .filter(
            (s) =>
                s.asked > 0 &&
                s.streak < rules.clearStreak &&
                (s.right < s.asked || s.seconds >= rules.fastSeconds)
        )
        .sort((a, b) => b.asked - b.right - (a.asked - a.right) || b.seconds - a.seconds)
}

/** A small seeded random (mulberry32), so a drill can be replayed in specs. */
export function seededRandom(seed: number): () => number {
    let t = seed >>> 0
    return () => {
        t = (t + 0x6d2b79f5) >>> 0
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
}

/** An ear training setting (#72). */
export const isEarTraining = (setting: DrillSetting): setting is EarTrainingSetting =>
    isEarTrainingKind(setting.kind)

const pickOne = <T>(items: readonly T[], random: () => number): T =>
    items[Math.floor(random() * items.length)]!

/** Every spot a fretboard or keyboard setting asks about. */
export function spotsOf(setting: DrillSetting, pool: readonly string[] = []): string[] {
    if (setting.kind === 'fretboard') {
        const out: string[] = []
        for (const s of setting.strings)
            for (let f = setting.frets[0]; f <= setting.frets[1]; f++) out.push(`s${s}f${f}`)
        return out
    }
    if (setting.kind === 'keyboard' || setting.kind === 'keyboard-ear') {
        const out: string[] = []
        for (let p = setting.keys[0]; p <= setting.keys[1]; p++) out.push(keyName(p))
        return out
    }
    if (setting.kind === 'fretboard-ear') return earPitches(setting).map(keyName)
    if (isEarTraining(setting)) return earSpots(setting)
    return [...new Set(pool)]
}

/** The pitches a fretboard setting plays, each once, low to high. */
const earPitches = (setting: { strings: number[]; frets: [number, number] }): number[] => {
    const out = new Set<number>()
    for (const s of setting.strings)
        for (let f = setting.frets[0]; f <= setting.frets[1]; f++) out.add(STRINGS[s - 1]! + f)
    return [...out].sort((a, b) => a - b)
}

/** The reference a drill by ear plays first: C4 on a keyboard, the setting's lowest note on a fretboard. */
export const referenceOf = (
    setting: Extract<DrillSetting, { kind: 'fretboard-ear' | 'keyboard-ear' }>
): number => (setting.kind === 'keyboard-ear' ? 60 : earPitches(setting)[0]!)

export type Question =
    | {
          type: 'find-fret'
          spot: string
          prompt: string
          string: number
          pitch: number
          note: string
      }
    | {
          type: 'name-fret'
          spot: string
          prompt: string
          string: number
          fret: number
          pitch: number
          note: string
      }
    | { type: 'find-key'; spot: string; prompt: string; pitch: number; note: string }
    | { type: 'name-key'; spot: string; prompt: string; pitch: number; note: string }
    | { type: 'name-chord'; spot: string; prompt: string; choices: string[] }
    | { type: 'name-scale'; spot: string; prompt: string; choices: string[] }
    | { type: 'find-scale'; spot: string; prompt: string; classes: number[] }
    | {
          type: 'hear-fret' | 'hear-key'
          spot: string
          prompt: string
          /** The note that sounds; `note` is its name with its octave (`G3`). */
          pitch: number
          note: string
          /** Only this pitch is right; else any octave. */
          exact: boolean
          /** The reference that sounds first, null without one. */
          reference: number | null
      }
    | EarQuestion

/** What the learner gave: a pick on the drawing, a note name, or a choice. */
export interface Given {
    string?: number | null
    pitch?: number
    note?: string
    choice?: string
}

/** The root of a chord symbol ("C#m7" → "C#"). */
const rootOf = (symbol: string) => /^[A-G][#b]?/.exec(symbol)?.[0] ?? ''

/** `count` choices: the right one and others, those on the same root first, in random order. */
export function choicesFor(
    right: string,
    pool: readonly string[],
    random: () => number,
    count = 4
): string[] {
    const others = [...new Set(pool)].filter((p) => p !== right)
    const shuffle = <T>(list: T[]) =>
        list
            .map((v) => ({ v, k: random() }))
            .sort((a, b) => a.k - b.k)
            .map((x) => x.v)
    const root = rootOf(right)
    const same = shuffle(others.filter((o) => root && rootOf(o) === root))
    const rest = shuffle(others.filter((o) => !(root && rootOf(o) === root)))
    return shuffle([right, ...[...same, ...rest].slice(0, count - 1)])
}

/** Choices from a small pool, topped up to `count` from the library (those on the same root first). */
function filled(
    choices: string[],
    right: string,
    library: string[],
    random: () => number,
    count = 4
): string[] {
    if (choices.length >= count) return choices
    const extra = choicesFor(
        right,
        library.filter((c) => !choices.includes(c)),
        random,
        count - choices.length + 1
    ).filter((c) => c !== right)
    // Shuffled again, so the library's choices aren't always last.
    return [...choices, ...extra.slice(0, count - choices.length)]
        .map((v) => ({ v, k: random() }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.v)
}

const scaleClasses = (name: string): number[] =>
    [...new Set(scaleNoteSet(name)?.members.map((m) => m.chroma) ?? [])].sort((a, b) => a - b)

function questionAt(
    setting: DrillSetting,
    spot: string,
    pool: readonly string[],
    random: () => number,
    choices: string[]
): Question {
    if (isEarTraining(setting)) return earQuestion(setting, spot, choices, random)
    if (setting.kind === 'fretboard-ear' || setting.kind === 'keyboard-ear')
        return {
            type: setting.kind === 'fretboard-ear' ? 'hear-fret' : 'hear-key',
            spot,
            // Never the note's name: it is what you hear.
            prompt: `Find the note you hear${setting.exact ? ' (exact octave)' : ''}`,
            pitch: midiOf(spot)!,
            note: spot,
            exact: setting.exact,
            reference: setting.reference ? referenceOf(setting) : null
        }
    const ask = 'ask' in setting ? setting.ask : 'name'
    const find = ask === 'find' || (ask === 'both' && random() < 0.5)
    if (setting.kind === 'fretboard') {
        const [, s, f] = /^s(\d+)f(\d+)$/.exec(spot)!.map(Number)
        const pitch = STRINGS[s! - 1]! + f!
        const note = noteName(pitch)
        return find
            ? {
                  type: 'find-fret',
                  spot,
                  prompt: `Find ${note} on string ${s}`,
                  string: s!,
                  pitch,
                  note
              }
            : {
                  type: 'name-fret',
                  spot,
                  prompt: 'Name the marked note',
                  string: s!,
                  fret: f!,
                  pitch,
                  note
              }
    }
    if (setting.kind === 'keyboard') {
        const pitch = midiOf(spot)!
        const note = noteName(pitch)
        return find
            ? { type: 'find-key', spot, prompt: `Find ${spot}`, pitch, note }
            : { type: 'name-key', spot, prompt: 'Name the marked key', pitch, note }
    }
    if (setting.kind === 'chords')
        return {
            type: 'name-chord',
            spot,
            prompt: 'Name this chord',
            choices: filled(choicesFor(spot, pool, random), spot, libraryChords(), random)
        }
    return find
        ? {
              type: 'find-scale',
              spot,
              prompt: `Find the notes of ${spot}`,
              classes: scaleClasses(spot)
          }
        : {
              type: 'name-scale',
              spot,
              prompt: 'Name this scale',
              choices: filled(choicesFor(spot, pool, random), spot, libraryScales(), random)
          }
}

// A share given as a fraction (0.29) is not exact in binary: round before flooring.
const slotsUpTo = (n: number, share: number) => Math.floor(Math.round(n * share * 1e6) / 1e6)

/** How many of `count` questions go to the weak spots. */
export const weakSlots = (count: number, share: number): number => slotsUpTo(count, share)

/**
 * The drill's questions: `rules.questions` of them, `weakShare` of the slots (spread evenly) from
 * the weak spots in the setting (weakest first, cycled), the others at random; never the same
 * spot twice in a row when there is another one to ask.
 */
export function questions(
    setting: DrillSetting,
    context: {
        stats: Map<string, SpotStat>
        rules: DrillRules
        random: () => number
        /** Chords or scales to ask (chord and scale drills). */
        pool?: readonly string[]
    }
): Question[] {
    const { rules, random } = context
    const pool = context.pool ?? []
    // Ear training asks its guided set (unless guided is off), with one button per item.
    const ear = isEarTraining(setting) ? setting : null
    const items = ear
        ? rules.guided === false
            ? earItems(ear)
            : guidedItems(ear, context.stats, rules.clearStreak)
        : []
    const choices = ear ? earChoices(ear, items) : []
    const spots = ear ? earSpots(ear, items) : spotsOf(setting, pool)
    if (!spots.length) return []
    const inRange = new Set(spots)
    const weak = weakSpots(context.stats, rules)
        .map((s) => s.spot)
        .filter((s) => inRange.has(s))
    const out: Question[] = []
    let cursor = 0
    let previous: string | null = null
    for (let i = 0; i < rules.questions; i++) {
        const weakSlot = slotsUpTo(i + 1, rules.weakShare) > slotsUpTo(i, rules.weakShare)
        let spot: string | null = null
        if (weakSlot && weak.length) {
            for (let tries = 0; tries < weak.length && spot === null; tries++) {
                const candidate = weak[cursor++ % weak.length]!
                if (candidate !== previous) spot = candidate
            }
        }
        if (spot === null) {
            const choices = spots.filter((s) => s !== previous)
            spot = pickOne(choices.length ? choices : spots, random)
        }
        out.push(questionAt(setting, spot, pool, random, choices))
        previous = spot
    }
    return out
}

/** Whether what was given answers the question (a find-scale pick: one of the scale's notes). */
export function isRight(question: Question, given: Given): boolean {
    switch (question.type) {
        case 'find-fret':
            return (
                given.string === question.string &&
                given.pitch !== undefined &&
                given.pitch % 12 === question.pitch % 12
            )
        case 'find-key':
            return given.pitch === question.pitch
        case 'name-fret':
        case 'name-key':
            return given.note !== undefined && classOf(given.note) === question.pitch % 12
        case 'name-chord':
        case 'name-scale':
            return given.choice === question.spot
        case 'find-scale':
            return given.pitch !== undefined && question.classes.includes(given.pitch % 12)
        case 'hear-fret':
        case 'hear-key':
            return (
                given.pitch !== undefined &&
                (question.exact
                    ? given.pitch === question.pitch
                    : given.pitch % 12 === question.pitch % 12)
            )
        case 'hear-name':
            return given.choice === question.answer
    }
}

export interface Score {
    right: number
    total: number
    /** Right answers out of the questions, 0 to 1. */
    share: number
    /** Average time of the right answers, in seconds. */
    seconds: number
}

export function scoreOf(answers: Answer[]): Score {
    const right = answers.filter((a) => a.right)
    return {
        right: right.length,
        total: answers.length,
        share: answers.length ? right.length / answers.length : 0,
        seconds: right.length ? right.reduce((t, a) => t + a.seconds, 0) / right.length : 0
    }
}

/** The review a drill gives: 90 % or more good, 60 % or more shaky, else failed. */
export const reviewResultOf = (share: number): ReviewResult =>
    share >= 0.9 ? 'good' : share >= 0.6 ? 'shaky' : 'failed'

/** Chord families a drill can keep to (decision 10: "any chord family of the library"). */
export const CHORD_FAMILIES: { name: string; suffixes: string[] }[] = [
    { name: 'Major', suffixes: [''] },
    { name: 'Minor', suffixes: ['m'] },
    { name: '7th', suffixes: ['7'] },
    { name: 'Major 7th', suffixes: ['maj7'] },
    { name: 'Minor 7th', suffixes: ['m7'] },
    { name: 'Sus', suffixes: ['sus2', 'sus4'] },
    { name: 'Diminished', suffixes: ['dim', 'dim7', 'm7b5'] },
    { name: 'Augmented', suffixes: ['aug'] },
    { name: 'Power', suffixes: ['5'] },
    { name: '6th and 9th', suffixes: ['6', 'm6', '9', 'add9'] }
]

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const SCALE_TYPES = [
    'major',
    'minor',
    'major pentatonic',
    'minor pentatonic',
    'blues',
    'dorian',
    'mixolydian',
    'lydian',
    'phrygian',
    'harmonic minor',
    'melodic minor'
]

/** A chord symbol as the library reads it ("B min" → "Bm"); null when it isn't one. */
const canonical = (symbol: string): string | null => readChord(symbol.trim())?.symbol ?? null

/** Whether a chord belongs to a family (its quality, whatever its bass). */
export function inFamily(symbol: string, family: string): boolean {
    const chord = readChord(symbol.trim())
    const f = CHORD_FAMILIES.find((x) => x.name === family)
    if (!chord || !f) return false
    const suffix = chord.symbol.replace(/\/.*$/, '').slice(chord.root.length)
    return f.suffixes.some((s) => canonical(`C${s}`)?.slice(1) === suffix)
}

/** A family's chords on the 12 roots; every family's without one. */
export const libraryChords = (family?: string): string[] =>
    (family === undefined
        ? CHORD_FAMILIES
        : CHORD_FAMILIES.filter((f) => f.name === family)
    ).flatMap((f) => f.suffixes.flatMap((s) => ROOTS.map((r) => `${r}${s}`)))

/** The common scales on the 12 roots ("A minor pentatonic"). */
export const libraryScales = (): string[] =>
    SCALE_TYPES.flatMap((t) => ROOTS.map((r) => `${r} ${t}`))

/** The chords a note's ```chords charts and ```progression blocks play, each once, in order. */
export function chordsOfText(text: string): string[] {
    const out: string[] = []
    const add = (symbol: string | null) => {
        if (symbol && !out.includes(symbol)) out.push(symbol)
    }
    for (const symbol of progressionOf(text, Number.MAX_SAFE_INTEGER)) add(canonical(symbol))
    // Each block in letters, as the library reads it (its own naming line, #12).
    for (const block of progressionFences(text)) {
        let key: string | null = null
        const tokens: string[] = []
        for (const line of block.split('\n')) {
            const kv = /^\s*([a-z-]+)\s*:\s*(.*)$/i.exec(line)
            if (kv) {
                const name = kv[1]!.toLowerCase()
                if (name === 'key') key = kv[2]!.trim()
                if (name === 'progression') tokens.push(...kv[2]!.split(/[\s,|]+/))
                continue
            }
            tokens.push(...line.split(/[\s,|]+/))
        }
        for (const token of tokens.filter(Boolean)) {
            if (/^[A-G]/.test(token)) add(canonical(token))
            else if (key) add(progressionChords([token], key)?.[0]?.symbol ?? null)
        }
    }
    return out
}

/** A chord as pitch classes and quality, so C# and Db are the same chord ("1|m7|"). */
function chordKey(symbol: string): string | null {
    const chord = readChord(symbol.trim())
    if (!chord) return null
    const [main, bass] = chord.symbol.split('/')
    const root = classOf(chord.root)
    const below = bass ? classOf(bass) : null
    return root === null ? null : `${root}|${main!.slice(chord.root.length)}|${below ?? ''}`
}

/** Whether two symbols are the same chord, whatever their spelling (C# and Db). */
export function sameChord(a: string, b: string): boolean {
    const ka = chordKey(a)
    return ka !== null && ka === chordKey(b)
}

/** A scale as its root's pitch class and its type ("3|major" for Eb major and D# major). */
function scaleKey(name: string): string | null {
    const m = /^([A-G][#b]?)\s+(.+)$/.exec(name.trim())
    const root = m ? classOf(m[1]!) : null
    return root === null ? null : `${root}|${m![2]!.toLowerCase()}`
}

/** Whether two scale names are the same scale, whatever the root's spelling. */
export function sameScale(a: string, b: string): boolean {
    const ka = scaleKey(a)
    return ka !== null && ka === scaleKey(b)
}

/** The chords of `symbols` that none of `known` is (whatever their spelling), each once. */
export function missingFrom(symbols: readonly string[], known: readonly string[]): string[] {
    const have = new Set(known.map(chordKey).filter((s): s is string => s !== null))
    const out: string[] = []
    const seen = new Set<string>()
    for (const s of symbols) {
        const c = canonical(s)
        const key = chordKey(s)
        if (c && key && !have.has(key) && !seen.has(key)) {
            out.push(c)
            seen.add(key)
        }
    }
    return out
}

/** A note name without its type's suffix and its shape ("A Major - Open (Guitar Chord)" → "A Major"). */
const bareName = (name: string) =>
    name
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/\s+-\s+.*$/, '')
        .trim()

/** The chord a chord note's name spells ("F Sharp Minor 7 - Barre (Guitar Chord)" → "F#m7"). */
export function chordOfName(name: string): string | null {
    return parseChordName(bareName(name))?.symbol ?? null
}

/** A scale from its root and type ("A", "Minor pentatonic" → "A minor pentatonic"); null when the library doesn't know it. */
export function scaleOf(root: string, type: string): string | null {
    const r = root.trim()
    if (!/^[A-G][#b]?$/.test(r)) return null
    const name = `${r} ${type.trim().toLowerCase()}`
    return scaleNoteSet(name)?.members.length ? name : null
}

/** The scale a scale note's name spells ("C Sharp Major (Piano Scale)" → "C# major"). */
export function scaleOfName(name: string): string | null {
    const m = /^([A-G])(?:\s+(Sharp|Flat)|([#b♯♭]))?\s+(.+)$/i.exec(bareName(name))
    if (!m) return null
    const accidental = m[2]
        ? m[2].toLowerCase() === 'sharp'
            ? '#'
            : 'b'
        : m[3]
          ? /[#♯]/.test(m[3])
              ? '#'
              : 'b'
          : ''
    return scaleOf(`${m[1]!.toUpperCase()}${accidental}`, m[4]!)
}

/** A pick on the drawing, as the library gives it. */
export interface DrawnPick {
    string: number | null
    fret: number | null
    pitch: number
}

/** A mark to draw: on a place (fretboards) or on every target of a pitch (keyboards). */
export interface DrillMark {
    at: { string: number; fret: number } | { pitch: number }
    result: 'right' | 'wrong'
}

const placeOf = (pick: DrawnPick): DrillMark['at'] =>
    pick.string !== null && pick.fret !== null
        ? { string: pick.string, fret: pick.fret }
        : { pitch: pick.pitch }

/**
 * A find-fret or find-key question after one pick: right or wrong, and the marks to draw (after a
 * miss, every right place too: each fret of the note on the string in `frets`, or the right key).
 */
export function afterPick(
    question: Question,
    pick: DrawnPick,
    frets: [number, number]
): { right: boolean; done: boolean; marks: DrillMark[] } {
    const right = isRight(question, pick)
    const marks: DrillMark[] = [{ at: placeOf(pick), result: right ? 'right' : 'wrong' }]
    if (!right && question.type === 'find-fret')
        for (let f = frets[0]; f <= frets[1]; f++)
            if ((STRINGS[question.string - 1]! + f) % 12 === question.pitch % 12)
                marks.push({ at: { string: question.string, fret: f }, result: 'right' })
    if (!right && question.type === 'find-key')
        marks.push({ at: { pitch: question.pitch }, result: 'right' })
    return { right, done: true, marks }
}

/**
 * A drill by ear after one pick: right or wrong, and the marks (after a miss, every place in the
 * range that was right: each string × fret, or each key, with the note or its pitch).
 */
export function afterHear(
    question: Question,
    pick: DrawnPick,
    area: { strings: number[]; frets: [number, number] } | { keys: [number, number] }
): { right: boolean; done: boolean; marks: DrillMark[] } {
    const right = isRight(question, pick)
    const marks: DrillMark[] = [{ at: placeOf(pick), result: right ? 'right' : 'wrong' }]
    if (right || (question.type !== 'hear-fret' && question.type !== 'hear-key'))
        return { right, done: true, marks }
    const hits = (pitch: number) =>
        question.exact ? pitch === question.pitch : pitch % 12 === question.pitch % 12
    if ('keys' in area) {
        for (let p = area.keys[0]; p <= area.keys[1]; p++)
            if (hits(p)) marks.push({ at: { pitch: p }, result: 'right' })
    } else
        for (const s of [...area.strings].sort((a, b) => a - b))
            for (let f = area.frets[0]; f <= area.frets[1]; f++)
                if (hits(STRINGS[s - 1]! + f))
                    marks.push({ at: { string: s, fret: f }, result: 'right' })
    return { right, done: true, marks }
}

/** A find-scale question in progress: the notes found (pitch classes) and the wrong picks. */
export interface ScaleState {
    found: number[]
    misses: number
}

export const startScale = (): ScaleState => ({ found: [], misses: 0 })

/** A find-scale question after one pick: done once every note is found, right only without a miss. */
export function scalePick(
    question: Question,
    state: ScaleState,
    pick: DrawnPick
): { state: ScaleState; done: boolean; right: boolean; marks: DrillMark[] } {
    const classes = question.type === 'find-scale' ? question.classes : []
    const ok = classes.includes(pick.pitch % 12)
    const found =
        ok && !state.found.includes(pick.pitch % 12)
            ? [...state.found, pick.pitch % 12].sort((a, b) => a - b)
            : state.found
    const next = { found, misses: state.misses + (ok ? 0 : 1) }
    const done = classes.length > 0 && classes.every((c) => found.includes(c))
    return {
        state: next,
        done,
        right: done && next.misses === 0,
        marks: [{ at: placeOf(pick), result: ok ? 'right' : 'wrong' }]
    }
}

/**
 * A piano chord note's keys (`pitches`): exact keys ("A3 C#4 E4", or a list), or pitch classes
 * ("A C# E") stacked upwards from middle C, as Identify this chord reads them. Empty when none read.
 */
export function pianoKeys(value: unknown): number[] {
    const text = (Array.isArray(value) ? value : [value])
        .filter((v) => v !== null && v !== undefined)
        .map(String)
        .join(' ')
        .trim()
    const set = text ? listNoteSet(text) : null
    if (!set) return []
    if (set.pitches) return set.pitches
    let previous = 59
    return set.members.map((m) => {
        let midi = 60 + m.chroma
        while (midi <= previous) midi += 12
        previous = midi
        return midi
    })
}

/** A drill note's title for its file name: sharps spelled out, which file names can't hold ("C Sharp 3"). */
export const drillFileTitle = (setting: DrillSetting): string =>
    drillTitle(setting).replace(/([A-G])#(-?\d)?/g, (_, note: string, octave?: string) =>
        octave === undefined ? `${note} Sharp` : `${note} Sharp ${octave}`
    )
