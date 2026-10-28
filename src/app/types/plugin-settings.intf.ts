import { createDefaultFieldNames } from '../domain/fields'
import type { FieldNames } from '../domain/fields'
import { createDefaultRules } from '../domain/rules'
import { createDefaultLocalModel } from '../domain/local-model'
import type { LocalModelSettings } from '../domain/local-model'
import { createDefaultRubric } from '../domain/rubric'
import type { RubricSettings } from '../domain/rubric'
import type { PracticeRules } from '../domain/rules'

export interface PluginSettings {
    /** Every number the practice rules use (#27). */
    rules: PracticeRules
    /** Frontmatter property names. */
    fields: FieldNames
    /** What each mastery level means, per kind of item. */
    rubric: RubricSettings
    /** The note model used when the Obsidian Starter Kit isn't available (#4). */
    local: LocalModelSettings
    /** Minutes offered by default for a practice plan. */
    defaultPlanMinutes: number
    /** Heading of the session note section that receives a log's note. */
    notesHeading: string
    /** Activity a subject's sessions count towards, by name; `{subject}` is the subject ("Learn {subject}"). */
    activityName: string
    /** Start of the running practice timer (epoch ms); 0 when no timer runs. Survives restarts. */
    timerStartedAt: number
}

/**
 * A fresh default settings object, safe to hand to Immer.
 *
 * `produce` deep-freezes what it returns, including any subtree it shares
 * with its base. Producing from the shared DEFAULT_SETTINGS froze that
 * constant (nested values too) for the rest of the process, so any later code
 * or test touching it failed with "Attempted to assign to readonly
 * property". Produce from this instead, and keep it deep-fresh: build
 * nested arrays and objects as new values, never by spreading DEFAULT_SETTINGS.
 */
export function createDefaultSettings(): PluginSettings {
    return {
        rules: createDefaultRules(),
        fields: createDefaultFieldNames(),
        rubric: createDefaultRubric(),
        local: createDefaultLocalModel(),
        defaultPlanMinutes: 30,
        notesHeading: 'Notes',
        activityName: 'Learn {subject}',
        timerStartedAt: 0
    }
}

/** The defaults, for reading and comparing. Never produce from it. */
export const DEFAULT_SETTINGS: PluginSettings = createDefaultSettings()

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Overlay loaded values on a default object, key by key: a loaded value is kept only when it has
 * the default's type (numbers finite, arrays of the same element type), so a hand-edited or older
 * data.json can never put a wrong type into the settings. Unknown keys are dropped.
 */
export function overlay<T>(defaults: T, loaded: unknown): T {
    if (!isRecord(defaults) || !isRecord(loaded)) return defaults
    const out: Record<string, unknown> = { ...defaults }
    for (const [key, def] of Object.entries(defaults)) {
        const value = loaded[key]
        if (value === undefined) continue
        if (isRecord(def)) out[key] = overlay(def, value)
        else if (Array.isArray(def)) {
            // Number tuples (the plan split) keep their length; lists of text may grow or shrink.
            const sample: unknown = def[0]
            const sameType =
                Array.isArray(value) && value.every((v: unknown) => typeof v === typeof sample)
            const lengthOk =
                typeof sample !== 'number' || (Array.isArray(value) && value.length === def.length)
            if (sameType && lengthOk) out[key] = [...(value as unknown[])]
        } else if (typeof def === 'number') {
            if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
        } else if (typeof value === typeof def) out[key] = value
    }
    return out as T
}

/** Settings from whatever data.json holds, every field checked against the defaults. */
export function settingsFrom(loaded: unknown): PluginSettings {
    return overlay(createDefaultSettings(), loaded)
}
