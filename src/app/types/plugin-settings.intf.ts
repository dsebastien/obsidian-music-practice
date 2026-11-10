import { createDefaultFieldNames } from '../domain/fields'
import type { FieldNames } from '../domain/fields'
import { createDefaultRules } from '../domain/rules'
import { createDefaultLocalModel } from '../domain/local-model'
import type { LocalModelSettings } from '../domain/local-model'
import { createDefaultRubric } from '../domain/rubric'
import type { RubricSettings } from '../domain/rubric'
import type { PracticeRules } from '../domain/rules'
import { NAMINGS, ROOT_MARKS } from '@dsebastien/music-notation'
import { ORIENTATIONS } from '../domain/notation-layout'
import type { NotationLayout } from '../domain/notation-layout'
import type { NotationToggles } from '../services/notation.service'
import { createDefaultPlayback, DEFAULT_STRUM, OLD_DEFAULT_STRUM } from '../domain/playback'
import type { PlaybackSettings } from '../domain/playback'
import { isUndoRecord } from '../domain/undo'
import { createDefaultMetronomeSettings, MAX_COUNT_IN_BARS } from '../domain/metronome'
import { panelItemsFrom } from '../domain/panel'
import type { PanelItem } from '../domain/panel'
import type { MetronomeSettings } from '../domain/metronome'
import type { UndoRecord } from '../domain/undo'
import { DEFAULT_PRE_ROLL, MAX_PRE_ROLL } from '../domain/playalong'

/** The play-along player (#75). */
export interface PlayAlongSettings {
    /** Draw ```playalong blocks (off: they show as code). */
    enabled: boolean
    /** Seconds played before A at each pass, 0 to 2. */
    preRoll: number
}

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
    /** When the timer was paused (epoch ms); 0 while it runs (#52). */
    timerPausedAt: number
    /** Time paused before the current pause, not counted as practice. */
    timerPausedMs: number
    /** Notation code blocks drawn by the plugin, per language (#29). */
    notation: NotationToggles
    /** Default orientation per diagram, and left-handed diagrams (#32). */
    notationLayout: NotationLayout
    /** Playing chords, scales and notes from the diagrams (#31). */
    playback: PlaybackSettings
    /** What the last practice log changed, to undo it (#36); null when there's nothing to undo. */
    lastLog: UndoRecord | null
    /** Metronome and speed trainer defaults (#39). */
    metronome: MetronomeSettings
    /** The practice panel's session list, kept until it's logged (#37). */
    panelItems: PanelItem[]
    /** Length of a chord change drill, in seconds (#40). */
    drillSeconds: number
    /** Note, chord and scale drills (#73). */
    drills: DrillSettings
    /** The play-along player (#75). */
    playAlong: PlayAlongSettings
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
/** Note drills (#73): questions per drill, the weak spots' share (percent), the streak of fast right
 * answers that clears a weak spot and what fast is (seconds); ear training's guided set (#72). */
export interface DrillSettings {
    questions: number
    weakShare: number
    clearStreak: number
    fastSeconds: number
    /** What fast is for ear training (#72). */
    earFastSeconds: number
    guided: boolean
}

export const DEFAULT_DRILLS: DrillSettings = {
    questions: 20,
    weakShare: 60,
    clearStreak: 3,
    fastSeconds: 2,
    earFastSeconds: 4,
    guided: true
}

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
        timerPausedAt: 0,
        timerPausedMs: 0,
        notation: {
            chord: true,
            chords: true,
            keyboard: true,
            fretboard: true,
            tab: true,
            score: true,
            strum: true,
            progression: true,
            circle: true,
            picking: true
        },
        playback: createDefaultPlayback(),
        notationLayout: {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'horizontal',
            naming: 'letters',
            rootMark: 'color'
        },
        lastLog: null,
        metronome: createDefaultMetronomeSettings(),
        panelItems: [],
        drillSeconds: 60,
        drills: { ...DEFAULT_DRILLS },
        playAlong: { enabled: true, preRoll: DEFAULT_PRE_ROLL }
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
    // Lists of objects don't survive the overlay: the panel's list is read on its own.
    settings.panelItems = panelItemsFrom(isRecord(loaded) ? loaded['panelItems'] : undefined)
    // Metronome values out of range fall back to the defaults.
    const m = settings.metronome
    const d = DEFAULT_SETTINGS.metronome
    if (![1, 2, 3, 4].includes(m.subdivision)) m.subdivision = d.subdivision
    if (!Number.isInteger(m.beatsPerBar) || m.beatsPerBar < 2 || m.beatsPerBar > 12)
        m.beatsPerBar = d.beatsPerBar
    if (m.volume < 0 || m.volume > 1) m.volume = d.volume
    if (!Number.isInteger(m.trainerStep) || m.trainerStep < 1 || m.trainerStep > 50)
        m.trainerStep = d.trainerStep
    if (!Number.isInteger(m.trainerBars) || m.trainerBars < 1 || m.trainerBars > 64)
        m.trainerBars = d.trainerBars
    if (!Number.isInteger(m.countInBars) || m.countInBars < 0 || m.countInBars > MAX_COUNT_IN_BARS)
        m.countInBars = d.countInBars
    if (typeof m.flash !== 'boolean') m.flash = d.flash
    if (
        !Number.isInteger(settings.drillSeconds) ||
        settings.drillSeconds < 10 ||
        settings.drillSeconds > 600
    )
        settings.drillSeconds = DEFAULT_SETTINGS.drillSeconds
    const dr = settings.drills
    if (!Number.isInteger(dr.questions) || dr.questions < 1 || dr.questions > 100)
        dr.questions = DEFAULT_DRILLS.questions
    if (!Number.isInteger(dr.weakShare) || dr.weakShare < 0 || dr.weakShare > 100)
        dr.weakShare = DEFAULT_DRILLS.weakShare
    if (!Number.isInteger(dr.clearStreak) || dr.clearStreak < 1 || dr.clearStreak > 10)
        dr.clearStreak = DEFAULT_DRILLS.clearStreak
    if (!Number.isFinite(dr.fastSeconds) || dr.fastSeconds < 0.5 || dr.fastSeconds > 10)
        dr.fastSeconds = DEFAULT_DRILLS.fastSeconds
    if (!Number.isFinite(dr.earFastSeconds) || dr.earFastSeconds < 0.5 || dr.earFastSeconds > 20)
        dr.earFastSeconds = DEFAULT_DRILLS.earFastSeconds
    if (typeof dr.guided !== 'boolean') dr.guided = DEFAULT_DRILLS.guided
    const preRoll = settings.playAlong.preRoll
    if (preRoll < 0 || preRoll > MAX_PRE_ROLL) settings.playAlong.preRoll = DEFAULT_PRE_ROLL
    // A pause from before the start, or in the future, or negative paused time: count no pause.
    const now = Date.now()
    if (
        settings.timerPausedMs < 0 ||
        (settings.timerPausedAt &&
            (settings.timerPausedAt < settings.timerStartedAt || settings.timerPausedAt > now))
    ) {
        settings.timerPausedAt = 0
        settings.timerPausedMs = 0
    }
    // The strum stored by versions before 0.10 (40 ms) was their default: the new default lets
    // guitar chords strum at 12 ms and piano chords sound together.
    if (settings.playback.strum === OLD_DEFAULT_STRUM) settings.playback.strum = DEFAULT_STRUM
    // An undo record edited by hand or from an older version: nothing to undo.
    if (!isUndoRecord(settings.lastLog)) settings.lastLog = null
    // Orientations are text: anything but the known values falls back to the default.
    const layout = settings.notationLayout
    for (const key of ['chord', 'fretboard', 'keyboard'] as const) {
        if (!ORIENTATIONS.includes(layout[key])) layout[key] = DEFAULT_SETTINGS.notationLayout[key]
    }
    // Note names: only the library's three values, exactly as stored by the dropdown.
    if (!NAMINGS.includes(layout.naming)) layout.naming = DEFAULT_SETTINGS.notationLayout.naming
    // Root marks likewise (a data.json from before 0.21 has none).
    if (!ROOT_MARKS.includes(layout.rootMark)) {
        layout.rootMark = DEFAULT_SETTINGS.notationLayout.rootMark
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
