import { createDefaultFieldNames } from '../domain/fields'
import type { FieldNames } from '../domain/fields'
import { createDefaultRules } from '../domain/rules'
import { createDefaultLocalModel } from '../domain/local-model'
import type { LocalModelSettings } from '../domain/local-model'
import { createDefaultRubric } from '../domain/rubric'
import type { RubricSettings } from '../domain/rubric'
import type { PracticeRules } from '../domain/rules'
import { ORIENTATIONS } from '../domain/notation-layout'
import type { NotationLayout } from '../domain/notation-layout'
import type { NotationToggles } from '../services/notation.service'
import { isUndoRecord } from '../domain/undo'
import { createDefaultMetronomeSettings } from '../domain/metronome'
import type { MetronomeSettings } from '../domain/metronome'
import type { UndoRecord } from '../domain/undo'

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
    /** Notation code blocks drawn by the plugin, per language (#29). */
    notation: NotationToggles
    /** Default orientation per diagram, and left-handed diagrams (#32). */
    notationLayout: NotationLayout
    /** What the last practice log changed, to undo it (#36); null when there's nothing to undo. */
    lastLog: UndoRecord | null
    /** Metronome and speed trainer defaults (#39). */
    metronome: MetronomeSettings
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
        timerStartedAt: 0,
        notation: { chord: true, chords: true, keyboard: true, fretboard: true },
        notationLayout: {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'horizontal'
        },
        lastLog: null,
        metronome: createDefaultMetronomeSettings()
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
    const settings = overlay(createDefaultSettings(), loaded)
    // Metronome values out of range fall back to the defaults.
    const m = settings.metronome
    const d = DEFAULT_SETTINGS.metronome
    if (![1, 2, 3, 4].includes(m.subdivision)) m.subdivision = d.subdivision
    if (!Number.isInteger(m.beatsPerBar) || m.beatsPerBar < 2 || m.beatsPerBar > 12)
        m.beatsPerBar = d.beatsPerBar
    if (m.volume < 0 || m.volume > 1) m.volume = d.volume
    if (!Number.isInteger(m.trainerStep) || m.trainerStep < 1) m.trainerStep = d.trainerStep
    if (!Number.isInteger(m.trainerBars) || m.trainerBars < 1) m.trainerBars = d.trainerBars
    // An undo record edited by hand or from an older version: nothing to undo.
    if (!isUndoRecord(settings.lastLog)) settings.lastLog = null
    // Orientations are text: anything but the known values falls back to the default.
    const layout = settings.notationLayout
    for (const key of ['chord', 'fretboard', 'keyboard'] as const) {
        if (!ORIENTATIONS.includes(layout[key])) layout[key] = DEFAULT_SETTINGS.notationLayout[key]
    }
    // A property name added in a newer version may already be used by another setting in an older
    // data.json: rename the new one ("frets" → "mp_frets") instead of failing the duplicate check.
    const loadedFields = isRecord(loaded) && isRecord(loaded['fields']) ? loaded['fields'] : null
    if (loadedFields) {
        const fields = settings.fields
        const keys = Object.keys(fields) as (keyof FieldNames)[]
        for (const key of keys) {
            if (key in loadedFields) continue
            if (keys.some((other) => other !== key && fields[other] === fields[key]))
                fields[key] = `mp_${fields[key]}`
        }
    }
    return settings
}
