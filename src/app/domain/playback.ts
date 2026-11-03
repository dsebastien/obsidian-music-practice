/**
 * Playing the diagrams (#31): which sound engine, and the defaults the diagrams' playback bar
 * starts from (each bar changes them for its own block only).
 */
import type { PlayOptions } from '@dsebastien/music-notation'

/** The soundfont (realistic, alphaTab's synthesizer) or the light synthesizer (computed). */
export const PLAYBACK_ENGINES = ['soundfont', 'light'] as const
export type PlaybackEngine = (typeof PLAYBACK_ENGINES)[number]

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
}

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
    strum: DEFAULT_STRUM
})

/** The strum to pass to the library: none at the default, so the instrument decides. */
export const strumOption = (settings: PlaybackSettings): { strum?: number } =>
    settings.strum === DEFAULT_STRUM ? {} : { strum: settings.strum }

/** The library's `play` option for these settings; false when playback is off. */
export function playOptions(
    settings: PlaybackSettings,
    soundfont: PlayOptions['player']
): PlayOptions | false {
    if (!settings.enabled) return false
    return {
        ...(settings.engine === 'soundfont' && soundfont ? { player: soundfont } : {}),
        volume: Math.min(1, Math.max(0, settings.volume / 100)),
        bpm: settings.bpm,
        ...strumOption(settings)
    }
}
