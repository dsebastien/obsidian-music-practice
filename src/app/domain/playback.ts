/**
 * Playing the diagrams (#31): which sound engine, the volume (music-notation 0.14: no bar has a
 * volume control, this setting is the volume), and the defaults the play bars start from (each
 * bar changes them for its own block only).
 */
import type { Engine, PlayOptions } from '@dsebastien/music-notation'

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

export interface PlaybackSettings {
    /** A playback bar on chord, keyboard and fretboard diagrams. */
    enabled: boolean
    engine: PlaybackEngine
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
 * drawn start from it.
 */
export function drawnPlaybackChanged(before: PlaybackSettings, after: PlaybackSettings): boolean {
    if (before === after) return false
    const { volume: _before, tempoUnit: _unitBefore, ...a } = before
    const { volume: _after, tempoUnit: _unitAfter, ...b } = after
    return JSON.stringify(a) !== JSON.stringify(b)
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
    current?: () => PlaybackSettings
): PlayOptions | false {
    if (!settings.enabled) return false
    return {
        ...(engines ? { engines, engine: libraryEngine(settings.engine) } : {}),
        volume: current ? () => volumeOf(current()) : volumeOf(settings),
        bpm: settings.bpm,
        ...strumOption(settings)
    }
}
