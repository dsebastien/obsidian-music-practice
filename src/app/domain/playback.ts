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

export const createDefaultPlayback = (): PlaybackSettings => ({
    enabled: true,
    engine: 'soundfont',
    volume: 80,
    bpm: 90,
    strum: 40
})

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
        strum: settings.strum
    }
}
