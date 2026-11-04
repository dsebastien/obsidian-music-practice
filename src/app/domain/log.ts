import type { FieldNames } from './fields'
import { labelFor, levelOf } from './mastery'
import type { LearningType } from './note-model'
import type { LearningItem } from './practice'
import { intervalOnLevelChange, reviewOutcome } from './review'
import type { ReviewResult } from './review'
import type { PracticeRules } from './rules'

/** One practiced item in a log. */
export interface LogItem {
    path: string
    /** Current BPM reached (written only when the item has a target BPM). */
    bpm?: number
    review?: ReviewResult
    /** New mastery level (a number of the scale). */
    level?: number
}

export interface LogRequest {
    /** YYYY-MM-DD. */
    date: string
    /** HH:MM, when known. */
    startTime?: string
    minutes: number
    /** A value of the session type's quality field. */
    quality?: string
    /** Optional title part: `<date> <focus>`. */
    focus?: string
    note?: string
    /** The session type, when the items alone don't tell (instrument-less items such as ear training). */
    sessionTypeId?: string
    /**
     * The activity the session counts for: an activity note's name or path; `null` for none. Left
     * out: the activity whose `session_types` lists the session type (see the Business Rules).
     */
    activity?: string | null
    items: LogItem[]
}

/** What to write on a learning note (its time comes from its session notes, see `item-time`). */
export interface ItemUpdate {
    /** Values to set (only fields the type defines). */
    set: Record<string, unknown>
}

/**
 * The frontmatter changes of one practiced item: last practiced, BPM, review result, new mastery
 * (as the type's own label), the first review interval when reaching the "slow" level, and the
 * date a status stamps when `stampDates` (the Obsidian Starter Kit doesn't run its automations).
 */
export function itemUpdate(
    item: LearningItem,
    type: LearningType,
    log: LogItem,
    context: {
        date: string
        fields: FieldNames
        rules: PracticeRules
        stampDates: boolean
        current: Record<string, unknown>
    }
): ItemUpdate {
    const { date, fields, rules } = context
    const has = (name: string) => type.fields.has(name)
    const set: Record<string, unknown> = {}
    if (has(fields.lastPracticed)) set[fields.lastPracticed] = date
    if (log.bpm !== undefined && item.bpmTarget !== null && has(fields.bpmCurrent))
        set[fields.bpmCurrent] = log.bpm

    let level = log.level ?? item.level
    if (log.review) {
        const outcome = reviewOutcome(
            log.review,
            { level: item.level, interval: item.reviewInterval, count: item.reviewCount },
            date,
            rules
        )
        if (has(fields.lastReviewed)) set[fields.lastReviewed] = outcome.lastReviewed
        if (has(fields.reviewCount)) set[fields.reviewCount] = outcome.reviewCount
        if (has(fields.reviewInterval)) set[fields.reviewInterval] = outcome.reviewInterval
        if (outcome.level !== undefined && log.level === undefined) level = outcome.level
    }
    if (level !== null) Object.assign(set, { ...levelChange(item, type, level, context), ...set })
    return { set }
}

/**
 * The frontmatter changes of a new mastery level: the type's label for it, the date that status
 * stamps (only when `stampDates` and still empty), and the first review interval when the level
 * reaches "slow" without one. Empty when the level doesn't change and needs no interval.
 */
export function levelChange(
    item: LearningItem,
    type: LearningType,
    level: number,
    context: {
        date: string
        fields: FieldNames
        rules: PracticeRules
        stampDates: boolean
        current: Record<string, unknown>
    }
): Record<string, unknown> {
    const { date, fields, rules, current } = context
    const has = (name: string) => type.fields.has(name)
    const set: Record<string, unknown> = {}
    if (level !== item.level) {
        const label = labelFor(level, type.statusValues)
        if (!label) throw new Error(`${type.name} has no status value for level ${level}`)
        set[type.statusProperty] = label
        if (context.stampDates) {
            const stamp = type.stamps[label]
            if (stamp && has(stamp) && !current[stamp]) set[stamp] = date
        }
    }
    if (has(fields.reviewInterval)) {
        const first = intervalOnLevelChange(level, item.reviewInterval, rules)
        if (first !== null) set[fields.reviewInterval] = first
    }
    return set
}

/**
 * Split minutes into whole minutes per item that add up to the total: the first items take the
 * remainder (20 over 3 → 7, 7, 6).
 */
export function splitMinutes(total: number, count: number): number[] {
    if (count <= 0) return []
    const base = Math.floor(total / count)
    const extra = total - base * count
    return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

/** A finite number from a frontmatter value (numbers, numeric text); null otherwise. */
export function numberOf(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value)
        return Number.isFinite(n) ? n : null
    }
    return null
}

/**
 * Apply an update to a frontmatter object (as `processFrontMatter` hands it). The last-practiced
 * and last-reviewed dates never move back.
 */
export function applyItemUpdate(
    fm: Record<string, unknown>,
    update: ItemUpdate,
    fields: FieldNames
): void {
    const set = { ...update.set }
    const movesBack = (key: string) =>
        key in set && typeof fm[key] === 'string' && String(fm[key]) > String(set[key])
    if (movesBack(fields.lastPracticed)) delete set[fields.lastPracticed]
    // An older review being logged leaves the review date and counters as they are.
    if (movesBack(fields.lastReviewed)) {
        delete set[fields.lastReviewed]
        delete set[fields.reviewCount]
        delete set[fields.reviewInterval]
    }
    for (const [key, value] of Object.entries(set)) fm[key] = value
}

/** What makes two logs the same session: a run again of a log reuses its session note. */
export interface LoggedSessionKey {
    date: string
    minutes: number
    /** Item note names. */
    items: readonly string[]
    /** HH:MM, compared only when the log gives one. */
    startTime?: string | null
}

const nameSet = (names: readonly string[]): string =>
    [...new Set(names.map((n) => n.toLowerCase()))].sort().join('|')

/** Without a start time, only a session note this plugin created this recently can hold a run again. */
export const RERUN_WINDOW_MS = 15 * 60_000

/**
 * Whether a session note (of the log's session type) already holds this log: the same date, the
 * same minutes, the same items (by name, any case and order), and the same start time when the log
 * gives one (a timer's or one the user typed). Without one (the plugin may have computed and written
 * one), only a note this plugin created less than 15 minutes ago (`recent`; file times can't tell:
 * Obsidian Sync and Android reset them), whatever its start time: two real sessions of the same
 * items and minutes that day stay two notes. A log that
 * stopped half-way and is run again finds it and adds no second session.
 */
export function holdsLog(
    fm: Record<string, unknown>,
    key: LoggedSessionKey,
    fields: Pick<FieldNames, 'date' | 'timeSpent' | 'startTime' | 'practiced'>,
    recent: boolean
): boolean {
    const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
    if (text(fm[fields.date]).substring(0, 10) !== key.date) return false
    if (Number(fm[fields.timeSpent]) !== key.minutes) return false
    if (key.startTime) {
        if (text(fm[fields.startTime]) !== key.startTime) return false
    } else if (!recent) return false
    const raw = fm[fields.practiced]
    const listed = (Array.isArray(raw) ? (raw as unknown[]) : raw == null ? [] : [raw])
        .map((x) =>
            typeof x === 'string' ? (/\[\[([^\]|#]+)/.exec(x)?.[1]?.trim() ?? null) : null
        )
        .filter((x): x is string => Boolean(x))
    return nameSet(listed) === nameSet(key.items)
}

/** Session title: `<date> <focus>`, or the date alone; the type's affixes come on top. */
export function sessionTitle(date: string, focus?: string): string {
    const clean = (focus ?? '')
        .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    return clean ? `${date} ${clean}` : date
}

/** The n-th candidate file name for a session: ` 2`, ` 3`… for further sessions that day. */
export function sessionFileName(
    title: string,
    n: number,
    affixes: { prefix: string; suffix: string }
): string {
    return `${affixes.prefix}${n === 1 ? title : `${title} ${n}`}${affixes.suffix}.md`
}

/** Local datetime without zone, as the Kanban Action Planner writes it. */
export function localIso(ms: number): string {
    const d = new Date(ms)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** A level parsed from anything a caller passes (a number or a status value). */
export const parseLevel = (value: unknown): number | undefined => levelOf(value) ?? undefined

const dateOf = (value: unknown): string | null =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.substring(0, 10) : null

/**
 * The item as its note says right now: level, review fields and BPMs read from the frontmatter being
 * written. The metadata cache can lag behind a write made a moment earlier (two logs in a row, a log
 * right after a BPM change), so updates are computed from this, never from the cached item alone.
 */
export function freshItem(
    item: LearningItem,
    type: LearningType,
    fm: Record<string, unknown>,
    fields: FieldNames
): LearningItem {
    const get = (name: string): unknown => (type.fields.has(name) ? fm[name] : undefined)
    return {
        ...item,
        level: levelOf(fm[type.statusProperty]),
        reviewInterval: numberOf(get(fields.reviewInterval)),
        reviewCount: numberOf(get(fields.reviewCount)),
        lastReviewed: dateOf(get(fields.lastReviewed)),
        bpmCurrent: numberOf(get(fields.bpmCurrent)),
        bpmTarget: numberOf(get(fields.bpmTarget))
    }
}

const REVIEW_RESULTS = new Set(['good', 'shaky', 'failed'])
const isInt = (n: unknown, min: number, max: number): boolean =>
    typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max

/** Check a log request before anything is written; the problem, or null when it can be logged. */
export function validateLogRequest(request: LogRequest): string | null {
    if (typeof request !== 'object' || request === null) return 'The log request is missing.'
    const { date, minutes, startTime, items } = request
    if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00`))
    )
        return `Invalid date "${String(date)}": expected YYYY-MM-DD.`
    if (!isInt(minutes, 1, 1440)) return 'Minutes must be a whole number between 1 and 1440.'
    if (
        startTime !== undefined &&
        (typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
    )
        return `Invalid start time "${String(startTime)}": expected HH:MM.`
    if (!Array.isArray(items) || items.length === 0) return 'Pick at least one item to log.'
    const seen = new Set<string>()
    for (const item of items) {
        if (typeof item?.path !== 'string' || !item.path) return 'Every item needs a path.'
        if (seen.has(item.path)) return `"${item.path}" is listed twice.`
        seen.add(item.path)
        if (item.bpm !== undefined && !isInt(item.bpm, 1, 1000))
            return `Invalid BPM for "${item.path}".`
        if (item.level !== undefined && !isInt(item.level, 0, 10_000))
            return `Invalid level for "${item.path}".`
        if (item.review !== undefined && !REVIEW_RESULTS.has(item.review))
            return `Invalid review result for "${item.path}": good, shaky or failed.`
    }
    for (const key of ['focus', 'quality', 'note', 'sessionTypeId'] as const)
        if (request[key] !== undefined && typeof request[key] !== 'string')
            return `"${key}" must be text.`
    if (
        request.activity !== undefined &&
        request.activity !== null &&
        (typeof request.activity !== 'string' || !request.activity.trim())
    )
        return '"activity" must be the name of an activity note, or null for none.'
    return null
}
