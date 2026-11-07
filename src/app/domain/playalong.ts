/**
 * The play-along player (#75): a ```playalong block names a recording (audio or video in the
 * vault) and its sections; the player loops a passage, slows it down and counts each pass in.
 * Pure rules, no DOM.
 */
import { bpmFromTaps, clampBpm, MAX_COUNT_IN_BARS } from './metronome'

export const PLAYALONG_LANGUAGE = 'playalong'

/** Speed: 50 % to 125 %, in steps of 5 %. */
export const MIN_SPEED = 0.5
export const MAX_SPEED = 1.25
export const SPEED_STEP = 0.05

/** A loop shorter than this is refused (a slip of the key, not a passage). */
export const MIN_LOOP_SECONDS = 0.5

/** The pre-roll's range in the settings, and its default. */
export const MAX_PRE_ROLL = 2
export const DEFAULT_PRE_ROLL = 0.2

export type MediaKind = 'audio' | 'video'

/** Obsidian's own media types; webm is played as a video (its picture shows when it has one). */
const AUDIO = new Set(['mp3', 'm4a', 'wav', 'flac', 'ogg', 'oga', 'opus', '3gp', 'aac'])
const VIDEO = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv', 'm4v'])

/** Whether a file is audio or video by its extension; null for anything else. */
export function mediaKindOf(path: string): MediaKind | null {
    const m = /\.([A-Za-z0-9]+)$/.exec(path)
    if (!m) return null
    const ext = m[1]!.toLowerCase()
    if (AUDIO.has(ext)) return 'audio'
    if (VIDEO.has(ext)) return 'video'
    return null
}

/** A time in a block: `m:ss`, `mm:ss` or `h:mm:ss`, up to three decimals; null otherwise. */
export function parseTime(text: string): number | null {
    const m = /^(?:(\d+):([0-5]\d)|(\d{1,2})):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(text.trim())
    if (!m) return null
    const fraction = m[5] ? Number(`0.${m[5]}`) : 0
    const seconds = Number(m[4]) + fraction
    if (m[1] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + seconds
    return Number(m[3]) * 60 + seconds
}

/** `0:12`, `1:02:03`; with `tenths`, `0:45.5`. Anything not a positive number is 0:00. */
export function formatTime(seconds: number, tenths = false): string {
    const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
    const rounded = tenths ? Math.round(total * 10) / 10 : Math.floor(total)
    const whole = Math.floor(rounded)
    const h = Math.floor(whole / 3600)
    const m = Math.floor((whole % 3600) / 60)
    const s = whole % 60
    const ss = String(s).padStart(2, '0')
    const tail = tenths ? `.${Math.round((rounded - whole) * 10) % 10}` : ''
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}${tail}` : `${m}:${ss}${tail}`
}

export interface Section {
    /** Seconds from the start. */
    time: number
    /** May be empty: the time shows instead. */
    name: string
    /** The block line it is on (from 0). */
    line: number
}

export interface PlayAlongBlock {
    /** The recording's link text or path, as written; null when no line names one. */
    file: string | null
    /** In time order (sections of one time in their written order). */
    sections: Section[]
    /** The recording's tempo at 100 % (`tempo: 120`); null without a usable line. */
    tempo: number | null
    /** One message per line the player can't read. */
    problems: string[]
}

const TEMPO = /^tempo\s*:\s*(.*)$/i

/** The BPM of a tempo line's value (`120`, `92.5`, `96 BPM`), 20 to 300; null otherwise. */
function tempoValue(text: string): number | null {
    const m = /^(\d+(?:\.\d+)?)(?:\s*bpm)?$/i.exec(text.trim())
    const bpm = m ? Number(m[1]) : NaN
    return bpm >= 20 && bpm <= 300 ? bpm : null
}

const SECTION = /^(\S+)(?:\s+(.*))?$/

/** The link a line names: `file: …`, `[[…]]`, `![[…]]`, `[text](path)` or a plain path. */
function linkOf(line: string): string | null {
    const value = line.replace(/^file\s*:\s*/i, '').trim()
    const wiki = /^!?\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(value)
    if (wiki) return wiki[1]!.trim()
    const markdown = /^!?\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))\)$/.exec(value)
    if (markdown) {
        const target = markdown[1] ?? markdown[2]!
        try {
            return decodeURIComponent(target)
        } catch {
            return target
        }
    }
    return mediaKindOf(value) ? value : null
}

/** Reads a ```playalong block. */
export function parsePlayAlong(source: string): PlayAlongBlock {
    let file: string | null = null
    let fileLine = -1
    let tempo: number | null = null
    let tempoLine = -1
    const sections: Section[] = []
    const problems: string[] = []
    source.split('\n').forEach((raw, line) => {
        const text = raw.trim()
        if (!text) return
        const m = SECTION.exec(text)
        const time = m ? parseTime(m[1]!) : null
        if (time !== null) {
            sections.push({ time, name: (m?.[2] ?? '').trim(), line })
            return
        }
        const tempoMatch = TEMPO.exec(text)
        if (tempoMatch) {
            if (tempoLine >= 0) {
                problems.push(
                    `Line ${line + 1}: the block already has a tempo (line ${tempoLine + 1})`
                )
                return
            }
            tempoLine = line
            tempo = tempoValue(tempoMatch[1]!)
            if (tempo === null)
                problems.push(
                    `Line ${line + 1}: the tempo must be a number of BPM from 20 to 300 (tempo: 120)`
                )
            return
        }
        const link = linkOf(text)
        if (link !== null) {
            if (file === null) {
                file = link
                fileLine = line
            } else
                problems.push(
                    `Line ${line + 1}: the block already has a file (line ${fileLine + 1})`
                )
            return
        }
        problems.push(`Line ${line + 1} is not a section: write 0:12 Verse`)
    })
    // Stable: sections of one time keep their written order.
    sections.sort((x, y) => x.time - y.time || x.line - y.line)
    return { file, sections, tempo, problems }
}

/**
 * The block's text with `tempo: <bpm>` (a tapped tempo, #75): its tempo line changed in place,
 * else a new line after the file line, else first.
 */
export function withTempo(body: string, bpm: number): string {
    const line = `tempo: ${Math.round(bpm * 10) / 10}`
    if (body === '') return line
    const lines = body.split('\n')
    const at = lines.findIndex((l) => TEMPO.test(l.trim()))
    if (at >= 0) {
        lines[at] = line
        return lines.join('\n')
    }
    const fileAt = lines.findIndex((l) => {
        const t = l.trim()
        return (
            !!t &&
            !TEMPO.test(t) &&
            parseTime(t.split(/\s/)[0] ?? '') === null &&
            linkOf(t) !== null
        )
    })
    lines.splice(fileAt + 1, 0, line)
    return lines.join('\n')
}

/** A section's block line: the time to a tenth (no `.0`), then the name. */
export function sectionLine(time: number, name: string): string {
    const tenths = Math.round(Math.max(0, time) * 10) / 10
    const stamp = formatTime(tenths, !Number.isInteger(tenths))
    const label = name.trim()
    return label ? `${stamp} ${label}` : stamp
}

/**
 * The block's text with a section line added: before the first section that comes later, else
 * after the last section line, else after the file line, else first.
 */
export function insertSection(body: string, line: string): string {
    const time = parseTime(line.split(/\s/)[0] ?? '') ?? 0
    const lines = body.split('\n')
    const block = parsePlayAlong(body)
    const later = block.sections.filter((s) => s.time > time).sort((x, y) => x.line - y.line)[0]
    let at: number
    if (later) at = later.line
    else if (block.sections.length) at = Math.max(...block.sections.map((s) => s.line)) + 1
    else {
        const fileAt = lines.findIndex((l) => {
            const t = l.trim()
            return !!t && linkOf(t) !== null
        })
        at = fileAt >= 0 ? fileAt + 1 : 0
    }
    if (body === '') return line
    lines.splice(at, 0, line)
    return lines.join('\n')
}

/** A loop's marks: A and B in seconds, and whether it loops. */
export interface LoopMarks {
    a: number | null
    b: number | null
    loop: boolean
}

export type MarkResult = { ok: true; loop: LoopMarks } | { ok: false; message: string }

/**
 * Sets A or B at `time`. A set after B (or B before A) swaps them; a loop shorter than half a
 * second is refused; setting the second mark turns the loop on (a mark moved later keeps it as it is).
 */
export function setMark(marks: LoopMarks, which: 'a' | 'b', time: number): MarkResult {
    const other = which === 'a' ? marks.b : marks.a
    if (other !== null && Math.abs(time - other) < MIN_LOOP_SECONDS)
        return { ok: false, message: 'A and B must be at least half a second apart.' }
    let a = which === 'a' ? time : marks.a
    let b = which === 'b' ? time : marks.b
    if (a !== null && b !== null && a > b) {
        // A after B: B becomes A (and the other way round).
        if (which === 'a') [a, b] = [marks.b, time]
        else [a, b] = [time, marks.a]
    }
    const complete = a !== null && b !== null
    const wasComplete = marks.a !== null && marks.b !== null
    return { ok: true, loop: { a, b, loop: complete && (wasComplete ? marks.loop : true) } }
}

/** The loop of a section: from its time to the next section's (the last to the end); null when it can't. */
export function sectionLoop(
    sections: readonly Section[],
    index: number,
    duration: number
): LoopMarks | null {
    const section = sections[index]
    if (!section) return null
    const next = sections.slice(index + 1).find((s) => s.time > section.time)
    const end = next ? next.time : duration
    if (!Number.isFinite(end) || end - section.time < MIN_LOOP_SECONDS) return null
    return { a: section.time, b: end, loop: true }
}

/** Where a pass starts: A minus the pre-roll, never before the start. */
export const wrapTarget = (a: number, preRoll: number): number => Math.max(0, a - preRoll)

/** Speeds are kept to the 5 % grid, within the range; 100 % for anything not a number. */
export function clampSpeed(speed: number): number {
    if (!Number.isFinite(speed)) return 1
    const steps = Math.round(speed / SPEED_STEP)
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(steps * SPEED_STEP * 100) / 100))
}

/** One step slower (−1) or faster (+1). */
export const stepSpeed = (speed: number, direction: -1 | 1): number =>
    clampSpeed(clampSpeed(speed) + direction * SPEED_STEP)

export type TempoSourceKind = 'block' | 'tapped' | 'target'

export interface Tempo {
    /** The recording's tempo at 100 %. */
    bpm: number
    source: TempoSourceKind
}

const positive = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value > 0

/**
 * The recording's tempo at 100 %: the block's tempo line, else a tempo tapped on the player (it is
 * written as the tempo line), else the note's target BPM. The current BPM is never used: it is the
 * tempo the learner plays at, not the recording's.
 */
export function tempoOf(
    block: number | null,
    tapped: number | null,
    bpmTarget: number | null
): Tempo | null {
    if (positive(block)) return { bpm: block, source: 'block' }
    if (positive(tapped)) return { bpm: tapped, source: 'tapped' }
    if (positive(bpmTarget)) return { bpm: bpmTarget, source: 'target' }
    return null
}

/** Taps (epoch ms) heard at `speed`: the recording's tempo at 100 %; null with too few taps. */
export function tappedTempo(taps: readonly number[], speed: number): number | null {
    const heard = bpmFromTaps(taps)
    return heard === null ? null : Math.round(heard / clampSpeed(speed))
}

/** The tempo it plays at: Save BPM offers it as the current BPM. */
export const playedTempo = (bpm: number, speed: number): number => Math.round(bpm * speed)

export interface CountInPlan {
    beats: number
    beatsPerBar: number
    /** The click tempo: the recording's tempo times the speed. */
    bpm: number
    /** How long the clicks last, to the beat after the last one. */
    seconds: number
}

/** The count-in: `bars` (1 to 4) bars of beats at tempo × speed. */
export function countInPlan(request: {
    bpm: number
    speed: number
    beatsPerBar: number
    bars: number
}): CountInPlan {
    const bars = Math.min(MAX_COUNT_IN_BARS, Math.max(1, Math.floor(request.bars)))
    const bpm = clampBpm(request.bpm * request.speed)
    const beats = bars * request.beatsPerBar
    return { beats, beatsPerBar: request.beatsPerBar, bpm, seconds: (beats * 60) / bpm }
}

export type PlayAlongAction =
    | 'toggle'
    | 'set-a'
    | 'set-b'
    | 'loop'
    | 'back'
    | 'back-little'
    | 'forward'
    | 'forward-little'
    | 'slower'
    | 'faster'
    | 'count-in'
    | 'tap'
    | 'add-section'

/** What a key does in a focused player; null for keys it leaves alone. */
export function playAlongKey(key: string, shift: boolean): PlayAlongAction | null {
    switch (key) {
        case ' ':
        case 'k':
        case 'K':
            return 'toggle'
        case '[':
            return 'set-a'
        case ']':
            return 'set-b'
        case 'l':
        case 'L':
            return 'loop'
        case 'ArrowLeft':
            return shift ? 'back-little' : 'back'
        case 'ArrowRight':
            return shift ? 'forward-little' : 'forward'
        case '-':
        case '_':
            return 'slower'
        case '+':
        case '=':
            return 'faster'
        case 'c':
        case 'C':
            return 'count-in'
        case 't':
        case 'T':
            return 'tap'
        case 'm':
        case 'M':
            return 'add-section'
        default:
            return null
    }
}
