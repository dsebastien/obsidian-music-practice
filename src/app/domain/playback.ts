/**
 * Playing the diagrams (#31): which sound engine, the volume (music-notation 0.14: no bar has a
 * volume control, this setting is the volume), and the defaults the play bars start from (each
 * bar changes them for its own block only).
 */
import { GUITAR_TONES, guitarToneOf } from '@dsebastien/music-notation'
import type { Engine, GuitarTone, NotePlayer, PlayOptions } from '@dsebastien/music-notation'

/**
 * The sound pack's instruments (`generaluser`, #100: an optional download), the built-in
 * soundfont (`soundfont`: realistic, small, in the plugin) or the light synthesizer (computed).
 * The first two play through alphaTab's synthesizer.
 */
export const PLAYBACK_ENGINES = ['generaluser', 'soundfont', 'light'] as const
export type PlaybackEngine = (typeof PLAYBACK_ENGINES)[number]

/**
 * The notation library's name for an engine (music-notation #124). The stored `soundfont` is its
 * `sonivox`: the value is older than the library's names and stays as it is in the settings.
 */
export const libraryEngine = (engine: PlaybackEngine): Engine =>
    engine === 'soundfont' ? 'sonivox' : engine

/**
 * The guitars that can play the guitar sound (#108, music-notation #103): a steel-string acoustic
 * (the default), a nylon-string classical guitar, a clean electric, an overdriven electric. The
 * library's names, stored as they are.
 */
export const GUITAR_SOUNDS = GUITAR_TONES
export type GuitarSound = GuitarTone

export interface PlaybackSettings {
    /** A playback bar on chord, keyboard and fretboard diagrams. */
    enabled: boolean
    engine: PlaybackEngine
    /** The guitar that plays diagrams, patterns, progressions and charts (#108). */
    guitar: GuitarSound
    /** 0 to 100. */
    volume: number
    /** Scales: notes per minute. */
    bpm: number
    /** Chords: milliseconds between strings. */
    strum: number
    /**
     * The unit the tempo on a tab or score bar shows first (music-notation #114): BPM or percent.
     * A switch on a bar saves it here.
     */
    tempoUnit: TempoUnit
}

export const TEMPO_UNITS = ['bpm', 'percent'] as const
export type TempoUnit = (typeof TEMPO_UNITS)[number]

/**
 * The library's own guitar strum (12 ms between strings). At this value the plugin passes no strum
 * and the library's default applies; any value strums guitar chords only, piano chords always
 * sound together (music-notation 0.9).
 */
export const DEFAULT_STRUM = 12

/** The strum the plugin used before 0.10, stored in older settings: read as the default. */
export const OLD_DEFAULT_STRUM = 40

export const createDefaultPlayback = (): PlaybackSettings => ({
    enabled: true,
    engine: 'soundfont',
    guitar: 'steel',
    volume: 80,
    bpm: 90,
    strum: DEFAULT_STRUM,
    tempoUnit: 'bpm'
})

/** The strum to pass to the library: none at the default, so the instrument decides. */
export const strumOption = (settings: PlaybackSettings): { strum?: number } =>
    settings.strum === DEFAULT_STRUM ? {} : { strum: settings.strum }

/** The settings' volume, 0 to 1, as the library wants it. */
export const volumeOf = (settings: PlaybackSettings): number =>
    Math.min(1, Math.max(0, settings.volume / 100))

/**
 * Whether a playback change shows on the bars (engine, tempo, strum, on or off), so they are drawn
 * again. The volume doesn't: it is heard at once (#95), and a redraw would stop what plays. Nor
 * does the tab tempo's unit: a bar saves it when the reader switches it, and only the next scores
 * drawn start from it. Nor does the guitar (#108): each play reads it, so it is heard at the next
 * Play.
 */
export function drawnPlaybackChanged(before: PlaybackSettings, after: PlaybackSettings): boolean {
    if (before === after) return false
    const { volume: _before, tempoUnit: _unitBefore, guitar: _guitarBefore, ...a } = before
    const { volume: _after, tempoUnit: _unitAfter, guitar: _guitarAfter, ...b } = after
    return JSON.stringify(a) !== JSON.stringify(b)
}

/**
 * The guitar a note asks for with its guitar sound property (#108: a classical piece plays on
 * nylon); null when the note has none or its value isn't a guitar. Read as the library reads a
 * block's `guitar:` line, in upper or lower case, `acoustic`, `classical`, `electric` and `overdriven` too.
 */
export function noteGuitar(
    frontmatter: Record<string, unknown> | null | undefined,
    property: string
): GuitarSound | null {
    if (!frontmatter || !property) return null
    const value: unknown = frontmatter[property]
    // A list of one value, as Obsidian stores a property typed as a list.
    return guitarToneOf(Array.isArray(value) && value.length === 1 ? value[0] : value)
}

/** The guitar that plays: the note's own when it names one, else the setting's. */
export const guitarOf = (settings: PlaybackSettings, note: GuitarSound | null): GuitarSound =>
    note ?? guitarToneOf(settings.guitar) ?? 'steel'

/**
 * `player` with the guitar given to each play that doesn't name one, for what the plugin plays
 * itself (the library does the same for the bars it draws). `guitar` is read at each play.
 */
export function guitarPlayer(player: NotePlayer, guitar: () => GuitarSound): NotePlayer {
    return {
        get reportsStart() {
            return player.reportsStart
        },
        play: (events, options) =>
            player.play(events, options.guitar ? options : { ...options, guitar: guitar() })
    }
}

/** The new level (0 to 1) when Settings → Playback → Volume changed, else null (#95). */
export const volumeChange = (before: PlaybackSettings, after: PlaybackSettings): number | null =>
    before.volume === after.volume ? null : volumeOf(after)

/**
 * The library's `play` option for these settings; false when playback is off. `engines` are the
 * players the plugin has (the sound pack's and the built-in soundfont's; the light synthesizer is
 * the library's own): a block plays through its own `engine:` line, else the setting, else the
 * best one there is (music-notation #124). With `current` (the settings as they are now), the
 * volume is read at each play, so a change in Settings → Playback applies to diagrams already
 * drawn.
 */
export function playOptions(
    settings: PlaybackSettings,
    engines: PlayOptions['engines'],
    current?: () => PlaybackSettings,
    /** The guitar that plays, read at each play (#108): the note's own, else the setting's. */
    guitar?: () => GuitarSound
): PlayOptions | false {
    if (!settings.enabled) return false
    return {
        ...(engines ? { engines, engine: libraryEngine(settings.engine) } : {}),
        ...(guitar ? { guitar } : {}),
        volume: current ? () => volumeOf(current()) : volumeOf(settings),
        bpm: settings.bpm,
        ...strumOption(settings)
    }
}
