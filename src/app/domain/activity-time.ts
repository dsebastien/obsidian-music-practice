/**
 * Activity time: an activity's stored duration and last-session date are computed from its time
 * entries and the session notes that link to it, never added to. The same rule as the vault's
 * learning skills (`osk-learning-shared`, "Activity time") and the Kanban Action Planner's "Time
 * from linked notes": a note tagged `type/session` (or a child tag) whose activities field holds a
 * wikilink to the activity counts its minutes (rounded, above 0) on its date. Stored duration =
 * entry minutes (`max(1, round)` per entry with an end after its start) + linked minutes; last
 * session = the later of the last entry day (local day of its end) and the last linked date. An
 * entry whose description is exactly one wikilink to a linked session that counts minutes is
 * skipped: that session counts once. A stored duration above the computed one is never lowered on
 * its own: it is reported, and the user keeps the difference as a "Manual adjustment" entry or drops
 * it. Pure: no Obsidian imports.
 */
import type { FieldNames } from './fields'
import { localIso } from './log'

/** Session notes carry this tag or a child of it. */
export const SESSION_TAG = 'type/session'

/** One session note counted for an activity. */
export interface LinkedSession {
    /** Rounded minutes (0 when none). */
    minutes: number
    /** `YYYY-MM-DD`, or null without a valid date. */
    date: string | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A frontmatter value by name, any case (the exact name first). */
export function prop(fm: Record<string, unknown> | undefined | null, name: string): unknown {
    if (!fm) return undefined
    if (Object.prototype.hasOwnProperty.call(fm, name)) return fm[name]
    const lower = name.toLowerCase()
    for (const key of Object.keys(fm)) if (key.toLowerCase() === lower) return fm[key]
    return undefined
}

/** The frontmatter key to write a field under: the existing key in any case, else the name. */
export function keyOf(fm: Record<string, unknown>, name: string): string {
    const lower = name.toLowerCase()
    return (
        Object.keys(fm).find((k) => k === name) ??
        Object.keys(fm).find((k) => k.toLowerCase() === lower) ??
        name
    )
}

/** The link path of a value that is exactly one wikilink (`[[Note]]`, `[[Note#h|alias]]`), else null. */
export function wikilinkPath(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const m = /^\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]$/.exec(value.trim())
    return m ? m[1]!.trim() : null
}

/** Whether a note's tags (`tags` or `tag`, a list or a comma or space separated string) mark a session. */
export function isSessionNote(fm: Record<string, unknown> | undefined | null): boolean {
    const raw: unknown[] = [prop(fm, 'tags'), prop(fm, 'tag')].flatMap((v): unknown[] =>
        v === undefined || v === null ? [] : Array.isArray(v) ? (v as unknown[]) : [v]
    )
    return raw
        .filter((x): x is string => typeof x === 'string')
        .flatMap((x) => x.split(/[,\s]+/))
        .map((x) => x.replace(/^#/, '').toLowerCase())
        .some((t) => t === SESSION_TAG || t.startsWith(`${SESSION_TAG}/`))
}

/** Minutes of a session: a number or a decimal string, rounded; anything else is 0. */
export function sessionMinutes(value: unknown): number {
    const n =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value)
              ? Number(value)
              : NaN
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

/** A session's day: the first 10 characters of its date when they are `YYYY-MM-DD`. */
export function sessionDay(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const day = value.substring(0, 10)
    return DAY.test(day) ? day : null
}

const pad = (n: number) => String(n).padStart(2, '0')
const localDay = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** What a recompute would write on an activity. */
export interface ActivityTimePlan {
    /** The time entries to keep (the adopted timer's entry removed). */
    entries: unknown[]
    /** Entries removed (0 or 1: the adopted timer's). */
    removed: number
    /** Whether the adopted timer's entry was found. */
    adoptedFound: boolean
    /** The duration to store, or null to leave it as it is (nothing to count). */
    minutes: number | null
    /** The last-session date to store, or null to leave it (no dated entry or session). */
    lastSession: string | null
    /** Whether applying the plan changes the note. */
    changed: boolean
    /**
     * The stored duration is above the computed one (typed by hand, or a session removed or
     * shortened): it is left as it is until the user decides (`lower`: keep or drop).
     */
    decision: LowerDecision | null
    /** Minutes kept as a "Manual adjustment" time entry (`lower: 'keep'`), else 0. */
    adjusted: number
}

/** A stored duration above the computed one, left alone. */
export interface LowerDecision {
    stored: number
    computed: number
    difference: number
}

/**
 * What to do with a stored duration above the computed one: `keep` the difference as a time entry
 * described "Manual adjustment", or `drop` it. Without a choice it stays as it is (reported).
 */
export type LowerChoice = 'keep' | 'drop' | null

/** The description of the entry that keeps a stored duration's surplus. */
export const MANUAL_ADJUSTMENT = 'Manual adjustment'

/**
 * Local midnight of a note's `created` day (its first 10 characters when they are a date), else
 * of `fallbackMs`'s day (the file's creation time): the "Manual adjustment" entry starts there, so
 * no week's budget jumps.
 */
export function createdDayStart(created: unknown, fallbackMs: number): number {
    const day = typeof created === 'string' ? sessionDay(created) : null
    const d = day ? new Date(`${day}T00:00:00`) : new Date(fallbackMs)
    if (!Number.isFinite(d.getTime()))
        return new Date(new Date(fallbackMs).setHours(0, 0, 0, 0)).getTime()
    return new Date(d.setHours(0, 0, 0, 0)).getTime()
}

/**
 * The "Manual adjustment" entry for a surplus of `minutes`: from local midnight of the created day
 * (else of the file's creation day), or earlier when it would end after `now` (created today, or a
 * `created` in the future), so it never ends in the future. Local times without offset, as the
 * Kanban Action Planner and the vault engine write them.
 */
export function manualAdjustment(
    created: unknown,
    fileCtimeMs: number | null,
    minutes: number,
    now: number
): { startTime: string; endTime: string; description: string } {
    const start = Math.min(createdDayStart(created, fileCtimeMs ?? now), now - minutes * 60_000)
    return {
        startTime: localIso(start),
        endTime: localIso(start + minutes * 60_000),
        description: MANUAL_ADJUSTMENT
    }
}

/**
 * The recompute of an activity. `linked`: the session notes that link to it, by path.
 * `resolve`: an entry description's link path → the note path it resolves to (from the activity).
 * `adoptedStartMs`: a stopped Kanban Action Planner timer's start; its entry (same start within a
 * minute, the last one) is removed, because the session note holds that time. A value under the time
 * entries field that isn't a list yields null: such a note is left alone.
 */
export function planActivityTime(
    fm: Record<string, unknown>,
    fields: Pick<FieldNames, 'timeEntries' | 'timeSpent' | 'lastSession'>,
    linked: ReadonlyMap<string, LinkedSession>,
    resolve: (linkpath: string) => string | null,
    adoptedStartMs: number | null = null,
    lower: LowerChoice = null,
    now: number = Date.now(),
    /** The activity file's creation time, for a "Manual adjustment" when it has no `created`. */
    fileCtimeMs: number | null = null
): ActivityTimePlan | null {
    const raw = prop(fm, fields.timeEntries)
    if (raw !== undefined && raw !== null && !Array.isArray(raw)) return null
    const all = (raw as unknown[] | null | undefined) ?? []
    const startOf = (x: unknown) =>
        typeof x === 'object' && x !== null
            ? new Date(String((x as { startTime?: unknown }).startTime)).getTime()
            : NaN
    let adoptIdx = -1
    if (adoptedStartMs !== null)
        all.forEach((x, k) => {
            const start = startOf(x)
            if (Number.isFinite(start) && Math.abs(start - adoptedStartMs) < 60_000) adoptIdx = k
        })
    const entries: unknown[] = []
    let entryMinutes = 0
    let counted = 0
    let entryLast = ''
    all.forEach((x, k) => {
        if (k === adoptIdx) return
        entries.push(x)
        if (typeof x !== 'object' || x === null) return
        const e = x as { startTime?: unknown; endTime?: unknown; description?: unknown }
        const link = wikilinkPath(e.description)
        const dest = link === null ? null : resolve(link)
        if (dest !== null && (linked.get(dest)?.minutes ?? 0) > 0) return
        const start = new Date(String(e.startTime)).getTime()
        const end = new Date(String(e.endTime)).getTime()
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            entryMinutes += Math.max(1, Math.round((end - start) / 60_000))
            counted++
        }
        const dayMs = Number.isFinite(end) ? end : start
        if (Number.isFinite(dayMs)) {
            const day = localDay(dayMs)
            if (day > entryLast) entryLast = day
        }
    })
    let linkedMinutes = 0
    let linkedLast = ''
    for (const s of linked.values()) {
        if (s.minutes > 0) linkedMinutes += s.minutes
        if (s.date && s.date > linkedLast) linkedLast = s.date
    }
    let minutes = counted > 0 || linkedMinutes > 0 ? entryMinutes + linkedMinutes : null
    const lastSession = [entryLast, linkedLast].sort().pop() || null
    const removed = adoptIdx >= 0 ? 1 : 0
    const storedMinutes = prop(fm, fields.timeSpent)
    const storedLast = prop(fm, fields.lastSession)
    // Never lowered on its own: a stored total above the computed one waits for the user.
    const stored = storedMinutes === null || storedMinutes === '' ? NaN : Number(storedMinutes)
    let decision: LowerDecision | null = null
    let adjusted = 0
    if (minutes !== null && Number.isFinite(stored) && Math.round(stored) > minutes) {
        const difference = Math.round(stored) - minutes
        if (lower === 'keep') {
            entries.push(manualAdjustment(prop(fm, 'created'), fileCtimeMs, difference, now))
            adjusted = difference
            minutes += difference
        } else if (lower !== 'drop') {
            decision = { stored: Math.round(stored), computed: minutes, difference }
            minutes = null
        }
    }
    const changed =
        removed > 0 ||
        adjusted > 0 ||
        (minutes !== null && storedMinutes !== minutes) ||
        (lastSession !== null && sessionDay(storedLast) !== lastSession)
    return {
        entries,
        removed,
        adoptedFound: adoptIdx >= 0,
        minutes,
        lastSession,
        changed,
        decision,
        adjusted
    }
}

/** Write a plan on the activity's frontmatter (only what it changes). */
export function applyActivityTime(
    fm: Record<string, unknown>,
    plan: ActivityTimePlan,
    fields: Pick<FieldNames, 'timeEntries' | 'timeSpent' | 'lastSession'>
): void {
    if (!plan.changed) return
    if (plan.removed > 0 || plan.adjusted > 0) fm[keyOf(fm, fields.timeEntries)] = plan.entries
    if (plan.minutes !== null && prop(fm, fields.timeSpent) !== plan.minutes)
        fm[keyOf(fm, fields.timeSpent)] = plan.minutes
    if (plan.lastSession !== null && sessionDay(prop(fm, fields.lastSession)) !== plan.lastSession)
        fm[keyOf(fm, fields.lastSession)] = plan.lastSession
}

/**
 * A session note's contribution to an activity: null when it isn't a session or its activities
 * field holds no wikilink that resolves (through `resolvesToActivity`) to the activity. A note
 * that links twice counts once.
 */
export function linkedSessionOf(
    fm: Record<string, unknown> | undefined | null,
    fields: Pick<FieldNames, 'activities' | 'timeSpent' | 'date'>,
    resolvesToActivity: (linkpath: string) => boolean
): LinkedSession | null {
    if (!fm || !isSessionNote(fm)) return null
    const raw = prop(fm, fields.activities)
    const links = (Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw])
        .map(wikilinkPath)
        .filter((l): l is string => l !== null)
    if (!links.some(resolvesToActivity)) return null
    return {
        minutes: sessionMinutes(prop(fm, fields.timeSpent)),
        date: sessionDay(prop(fm, fields.date))
    }
}
