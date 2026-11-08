/**
 * Note, chord and scale drills (#73): the kinds and their settings in words, the weak-spot map
 * (`drill_stats`), the questions (6 in 10 from the weakest spots) and the score. Pure: the service
 * reads the vault, the modal draws.
 */
import {
    midiOf,
    parseChordName,
    progressionChords,
    readChord,
    scaleNoteSet
} from '@dsebastien/music-notation'
import { progressionOf } from './progression'
import type { ReviewResult } from './review'

export type DrillKind = 'fretboard' | 'keyboard' | 'chords' | 'scales'
export type DrillAsk = 'find' | 'name' | 'both'
/** Where the chords or scales come from (decision 10). */
export type DrillSource = 'notes' | 'pieces' | 'focus' | 'library'
export type DrillInstrument = 'guitar' | 'piano'

export type DrillSetting =
    | { kind: 'fretboard'; strings: number[]; frets: [number, number]; ask: DrillAsk }
    | { kind: 'keyboard'; keys: [number, number]; ask: DrillAsk }
    | { kind: 'chords'; instrument: DrillInstrument; source: DrillSource; family?: string }
    | { kind: 'scales'; instrument: DrillInstrument; source: DrillSource; ask: DrillAsk }

/** The `drill_kind` values, as the vault's note types allow them. */
export const KIND_LABELS: Record<DrillKind, string> = {
    fretboard: 'Fretboard notes',
    keyboard: 'Keyboard notes',
    chords: 'Chord names',
    scales: 'Scale shapes'
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
}

export const DEFAULT_DRILL_RULES: DrillRules = {
    questions: 20,
    weakShare: 0.6,
    clearStreak: 3,
    fastSeconds: 2
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

const STAT = /^(.+):\s*(\d+)\/(\d+)\s+([\d.]+)s(?:,\s*(\d+) in a row)?$/
const FRET_SPOT = /^(s\d+f\d+)(?:\s+(.+))?$/

/** The map from `drill_stats`; items it can't read are kept as written. */
export function parseStats(value: unknown): { stats: Map<string, SpotStat>; other: string[] } {
    const items = Array.isArray(value)
        ? value
        : value === null || value === undefined
          ? []
          : [value]
    const stats = new Map<string, SpotStat>()
    const other: string[] = []
    for (const item of items) {
        const text = String(item).trim()
        const m = STAT.exec(text)
        if (!m || Number(m[2]) > Number(m[3])) {
            if (text) other.push(text)
            continue
        }
        const label = m[1]!.trim()
        const fret = FRET_SPOT.exec(label)
        const spot = fret ? fret[1]! : label
        stats.set(spot, {
            spot,
            answer: fret?.[2] ?? '',
            right: Number(m[2]),
            asked: Number(m[3]),
            seconds: Number(m[4]),
            streak: m[5] ? Number(m[5]) : 0
        })
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
    if (setting.kind === 'keyboard') {
        const out: string[] = []
        for (let p = setting.keys[0]; p <= setting.keys[1]; p++) out.push(keyName(p))
        return out
    }
    return [...new Set(pool)]
}

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

const scaleClasses = (name: string): number[] =>
    [...new Set(scaleNoteSet(name)?.members.map((m) => m.chroma) ?? [])].sort((a, b) => a - b)

function questionAt(
    setting: DrillSetting,
    spot: string,
    pool: readonly string[],
    random: () => number
): Question {
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
            choices: choicesFor(spot, pool, random)
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
              choices: choicesFor(spot, pool, random)
          }
}

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
    const spots = spotsOf(setting, pool)
    if (!spots.length) return []
    const inRange = new Set(spots)
    const weak = weakSpots(context.stats, rules)
        .map((s) => s.spot)
        .filter((s) => inRange.has(s))
    const out: Question[] = []
    let cursor = 0
    let previous: string | null = null
    for (let i = 0; i < rules.questions; i++) {
        const weakSlot = Math.floor((i + 1) * rules.weakShare) > Math.floor(i * rules.weakShare)
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
        out.push(questionAt(setting, spot, pool, random))
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

/** A family's chords on the 12 roots. */
export const libraryChords = (family: string): string[] =>
    CHORD_FAMILIES.find((f) => f.name === family)?.suffixes.flatMap((s) =>
        ROOTS.map((r) => `${r}${s}`)
    ) ?? []

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
    const fence = /^(`{3,}|~{3,})\s*progression\b[^\n]*\n([\s\S]*?)^\1\s*$/gm
    let m: RegExpExecArray | null
    while ((m = fence.exec(text))) {
        let key: string | null = null
        const tokens: string[] = []
        for (const line of m[2]!.split('\n')) {
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

/** The chords of `symbols` that none of `known` is (each read by the library), each once. */
export function missingFrom(symbols: readonly string[], known: readonly string[]): string[] {
    const have = new Set(known.map(canonical).filter((s): s is string => s !== null))
    const out: string[] = []
    for (const s of symbols) {
        const c = canonical(s)
        if (c && !have.has(c) && !out.includes(c)) out.push(c)
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
    const m = /^([A-G])(?:\s+(Sharp|Flat))?\s+(.+)$/i.exec(bareName(name))
    if (!m) return null
    const root = `${m[1]!.toUpperCase()}${m[2] ? (m[2].toLowerCase() === 'sharp' ? '#' : 'b') : ''}`
    return scaleOf(root, m[3]!)
}
