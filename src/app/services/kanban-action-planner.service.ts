import type { App } from 'obsidian'
import { KANBAN_ACTION_PLANNER_PLUGIN_ID } from '../constants'
import type { FieldNames } from '../domain/fields'

/**
 * Adapter for the optional Kanban Action Planner (KAP). Both plugins write time entries, durations
 * and review fields; when KAP is installed its property names win so the two never diverge. Its
 * running timer is read so a practice log can adopt it instead of double-counting the time.
 */

interface KapSettingsLike {
    defaultDurationProperty?: unknown
    defaultTimeEntriesProperty?: unknown
    defaultLastSessionProperty?: unknown
    reviewedDateProperty?: unknown
    reviewIntervalProperty?: unknown
    reviewCountProperty?: unknown
    activeTimeSession?: unknown
}

function kapSettings(app: App): KapSettingsLike | null {
    const plugin = app.plugins?.plugins?.[KANBAN_ACTION_PLANNER_PLUGIN_ID] as
        | { settings?: unknown }
        | undefined
    const s = plugin?.settings
    return typeof s === 'object' && s !== null ? s : null
}

const text = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback

/** The field names, with KAP's time and review property names when KAP is installed. */
export function withKapFieldNames(app: App, fields: FieldNames): FieldNames {
    const s = kapSettings(app)
    if (!s) return fields
    return {
        ...fields,
        timeSpent: text(s.defaultDurationProperty, fields.timeSpent),
        timeEntries: text(s.defaultTimeEntriesProperty, fields.timeEntries),
        lastSession: text(s.defaultLastSessionProperty, fields.lastSession),
        lastReviewed: text(s.reviewedDateProperty, fields.lastReviewed),
        reviewInterval: text(s.reviewIntervalProperty, fields.reviewInterval),
        reviewCount: text(s.reviewCountProperty, fields.reviewCount)
    }
}

export interface KapTimer {
    path: string
    startedAt: number
}

/** KAP's running timer, or null. */
export function kapActiveTimer(app: App): KapTimer | null {
    const t = kapSettings(app)?.activeTimeSession as { path?: unknown; startedAt?: unknown } | null
    return t && typeof t.path === 'string' && typeof t.startedAt === 'number'
        ? { path: t.path, startedAt: t.startedAt }
        : null
}

/** Stop KAP's timer through its own command (it writes its time entry itself). */
export function stopKapTimer(app: App): boolean {
    return app.commands.executeCommandById(`${KANBAN_ACTION_PLANNER_PLUGIN_ID}:stop-time-tracking`)
}
