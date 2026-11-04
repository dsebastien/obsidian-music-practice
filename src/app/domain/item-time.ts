/**
 * Item time: a learning note's duration is computed from its session notes, never added to. The
 * same rule as the vault's learning skills (`osk-learning-shared`, "Session notes and time"). A
 * session note (tag `type/session` or a child tag) that links to the item gives it its entry in the
 * minutes-per-item field (`"<minutes> [[<note>]]"`), else, when the item is only listed in the
 * practiced field, an even share of the session's minutes (whole minutes, the first items listed
 * take the remainder, as a log splits them). Never lowered on its own: a stored duration above the
 * computed one is reported. Pure: no Obsidian imports.
 */
import { isSessionNote, prop } from './activity-time'
import type { LowerDecision } from './activity-time'
import type { FieldNames } from './fields'

/** The link path of the first wikilink in a value (`"20 [[A Minor]]"` → "A Minor"), else null. */
export function firstLinkPath(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const m = /\[\[([^\]|#]+)/.exec(String(value))
    return m ? m[1]!.trim() : null
}

const listOf = (value: unknown): unknown[] =>
    Array.isArray(value)
        ? (value as unknown[])
        : value === undefined || value === null
          ? []
          : [value]

/** Positive finite minutes from a number or numeric text, else 0. */
const positive = (value: unknown): number => {
    const n =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
    return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * The minutes one session note gives each note it lists, by note path: its minutes-per-item entry
 * (two entries for one note add up), else an even share of the session's minutes for the notes
 * only listed in the practiced field. Not a session note: empty.
 */
export function sessionItemMinutes(
    fm: Record<string, unknown> | undefined | null,
    fields: Pick<FieldNames, 'practiced' | 'practicedMinutes' | 'timeSpent'>,
    resolve: (linkpath: string) => string | null
): Map<string, number> {
    const out = new Map<string, number>()
    if (!fm || !isSessionNote(fm)) return out
    const dest = (value: unknown): string | null => {
        const link = firstLinkPath(value)
        return link === null ? null : resolve(link)
    }
    const per = new Map<string, number>()
    for (const entry of listOf(prop(fm, fields.practicedMinutes))) {
        const m = /^\s*(\d+(?:\.\d+)?)\s*(.*)$/.exec(
            typeof entry === 'string' || typeof entry === 'number' ? String(entry) : ''
        )
        const d = m ? dest(m[2]) : null
        if (d !== null) per.set(d, (per.get(d) ?? 0) + Number(m![1]))
    }
    const listed = [
        ...new Set(
            listOf(prop(fm, fields.practiced))
                .map(dest)
                .filter((d): d is string => d !== null)
        )
    ]
    const total = Math.round(positive(prop(fm, fields.timeSpent)))
    const base = listed.length ? Math.floor(total / listed.length) : 0
    const extra = total - base * listed.length
    listed.forEach((path, i) => {
        if (!per.has(path)) out.set(path, base + (i < extra ? 1 : 0))
    })
    for (const [path, minutes] of per) out.set(path, minutes)
    return out
}

/** What a recompute does to an item's stored duration. */
export interface ItemTimePlan {
    /** The stored value, rounded; null when empty, NaN when it isn't a number. */
    stored: number | null
    /** Minutes from the session notes (rounded sum). */
    computed: number
    /** Session notes that gave the item minutes (or listed it). */
    sessions: number
    /** The value to write, or null to leave it. */
    write: number | null
    /** The stored value is above the computed one: left as it is, to report. */
    decision: LowerDecision | null
    /** The stored value isn't a number ("1h"): left as it is, to report. */
    notANumber: boolean
}

/**
 * The recompute of one item: `contributions` are the minutes each session note gives it. Nothing
 * to count, or the same value: no write. A stored value above the computed one is never lowered
 * on its own (`lower: 'drop'` accepts it). A stored value that isn't a number is left alone.
 */
export function planItemTime(
    storedValue: unknown,
    contributions: readonly number[],
    lower: 'drop' | null = null
): ItemTimePlan {
    const computed = Math.round(contributions.reduce((a, b) => a + b, 0))
    const empty = storedValue === undefined || storedValue === null || storedValue === ''
    const n = empty ? null : Math.round(Number(storedValue))
    const plan: ItemTimePlan = {
        stored: n,
        computed,
        sessions: contributions.length,
        write: null,
        decision: null,
        notANumber: false
    }
    if (contributions.length === 0 || n === computed) return plan
    if (n !== null && !Number.isFinite(n)) return { ...plan, notANumber: true }
    if (n !== null && n > computed && lower !== 'drop')
        return { ...plan, decision: { stored: n, computed, difference: n - computed } }
    return { ...plan, write: computed }
}

/** The minutes-per-item values of a session: `"<minutes> [[<note>]]"`, one per note. */
export function practicedMinutesValues(
    names: readonly string[],
    minutes: readonly number[]
): string[] {
    return names.map((name, i) => `${minutes[i] ?? 0} [[${name}]]`)
}
