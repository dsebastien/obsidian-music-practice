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
    items: LogItem[]
}

/** What to write on a learning note. */
export interface ItemUpdate {
    /** Values to set (only fields the type defines). */
    set: Record<string, unknown>
    /** Minutes to add to the duration field, when the type has one. */
    addMinutes: { field: string; minutes: number } | null
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
        minutes: number
        fields: FieldNames
        rules: PracticeRules
        stampDates: boolean
        current: Record<string, unknown>
    }
): ItemUpdate {
    const { date, minutes, fields, rules } = context
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
    return {
        set,
        addMinutes: has(fields.timeSpent) ? { field: fields.timeSpent, minutes } : null
    }
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

/**
 * Apply an update to a frontmatter object (as `processFrontMatter` hands it). The last-practiced
 * date never moves back, and minutes are added to whatever the note already counts.
 */
export function applyItemUpdate(
    fm: Record<string, unknown>,
    update: ItemUpdate,
    fields: FieldNames
): void {
    for (const [key, value] of Object.entries(update.set)) {
        if (
            key === fields.lastPracticed &&
            typeof fm[key] === 'string' &&
            String(fm[key]) > String(value)
        )
            continue
        fm[key] = value
    }
    if (update.addMinutes) {
        const { field, minutes } = update.addMinutes
        fm[field] = (Number(fm[field]) || 0) + minutes
    }
}

/** A Kanban Action Planner time entry. */
export interface TimeEntry {
    startTime: string
    endTime: string
    description: string
}

export type TimeEntryResult = 'added' | 'exists' | 'adopted'

/**
 * Add a session's time entry to an activity's frontmatter, deduplicated by its description (the
 * session link): logging the same session twice adds nothing. When a running Kanban Action Planner
 * timer was adopted, its own entry (same start, within a minute) is relabeled instead of adding a
 * second one. Duration and last-session date move with an added entry.
 */
export function addTimeEntry(
    fm: Record<string, unknown>,
    entry: TimeEntry,
    minutes: number,
    date: string,
    fields: FieldNames,
    adoptedStartMs: number | null = null
): TimeEntryResult {
    const entries = (
        Array.isArray(fm[fields.timeEntries]) ? (fm[fields.timeEntries] as unknown[]) : []
    ).filter((x): x is TimeEntry => typeof x === 'object' && x !== null)
    if (entries.some((x) => x.description === entry.description)) return 'exists'
    if (adoptedStartMs !== null) {
        const hit = entries
            .filter((x) => Math.abs(new Date(x.startTime).getTime() - adoptedStartMs) < 60_000)
            .pop()
        if (hit) {
            hit.description = entry.description
            fm[fields.timeEntries] = entries
            return 'adopted'
        }
    }
    entries.push(entry)
    fm[fields.timeEntries] = entries
    fm[fields.timeSpent] = (Number(fm[fields.timeSpent]) || 0) + minutes
    const last = fm[fields.lastSession]
    if (typeof last !== 'string' || last < date) fm[fields.lastSession] = date
    return 'added'
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
