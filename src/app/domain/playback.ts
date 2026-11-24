/**
 * Playing the diagrams (#31): which sound engine, the volume (music-notation 0.14: no bar has a
 * volume control, this setting is the volume), and the defaults the play bars start from (each
 * bar changes them for its own block only).
 */
import { GUITAR_TONES, guitarToneOf } from '@dsebastien/music-notation'
import type {
    AmpOptions,
    Engine,
    GuitarTone,
    NotePlayer,
    PlayEffects,
    PlayOptions
} from '@dsebastien/music-notation'

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
     * The room every play sounds in (music-notation #103): how loud it is against the notes, 0 to
     * 100 (the library's 0 to 1). 0 turns the room off.
     */
    roomLevel: number
    /** How long the room rings, in seconds: 0.2 (a small room) to 3 (a hall). */
    roomLength: number
    /** A speaker cabinet for the clean and overdriven guitars; off by default. */
    ampCabinet: boolean
    /** How hard the amplifier of the clean and overdriven guitars is driven, 0 to 100; 0 by default. */
    ampDrive: number
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

/** The library's own room: 12.5 of 100 (18 dB under the notes), 1.2 seconds. */
export const DEFAULT_ROOM_LEVEL = 12.5
export const DEFAULT_ROOM_LENGTH = 1.2
/** The shortest and the longest room, in seconds (the library's range). */
export const ROOM_LENGTHS = [0.2, 3] as const

export const createDefaultPlayback = (): PlaybackSettings => ({
    enabled: true,
    engine: 'soundfont',
    guitar: 'steel',
    volume: 80,
    bpm: 90,
    strum: DEFAULT_STRUM,
    tempoUnit: 'bpm',
    roomLevel: DEFAULT_ROOM_LEVEL,
    roomLength: DEFAULT_ROOM_LENGTH,
    ampCabinet: false,
    ampDrive: 0
})

const within = (value: number, min: number, max: number, fallback: number): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

/** The amplifier the settings ask for; null when the cabinet is off and the drive is 0. */
export function ampOf(settings: PlaybackSettings): AmpOptions | null {
    const drive = within(settings.ampDrive, 0, 100, 0) / 100
    if (!settings.ampCabinet && drive === 0) return null
    return { ...(drive > 0 ? { drive } : {}), ...(settings.ampCabinet ? { cabinet: true } : {}) }
}

/**
 * The room and the amplifier the settings ask for, as the library's effects (music-notation
 * #103). The room off (level 0) and no amplifier: `dry`, so the notes go straight to the output
 * and no room is computed at all (the plugin's sound before the room). The room off with an
 * amplifier: the room at 0, because `dry` would leave out the amplifier too. The library gives
 * an amplifier to the clean and overdriven guitars only.
 */
export function playEffects(settings: PlaybackSettings): PlayEffects {
    const reverb = within(settings.roomLevel, 0, 100, DEFAULT_ROOM_LEVEL) / 100
    const amp = ampOf(settings)
    if (reverb === 0 && !amp) return { dry: true }
    return {
        reverb,
        room: within(settings.roomLength, ROOM_LENGTHS[0], ROOM_LENGTHS[1], DEFAULT_ROOM_LENGTH),
        ...(amp ? { amp } : {})
    }
}

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
 * drawn start from it. Nor does the guitar (#108), nor the room and the amplifier: each play reads
 * them, so they are heard at the next Play.
 */
export function drawnPlaybackChanged(before: PlaybackSettings, after: PlaybackSettings): boolean {
    if (before === after) return false
    const drawn = ({
        volume: _volume,
        tempoUnit: _unit,
        guitar: _guitar,
        roomLevel: _level,
        roomLength: _length,
        ampCabinet: _cabinet,
        ampDrive: _drive,
        ...rest
    }: PlaybackSettings): Omit<
        PlaybackSettings,
        'volume' | 'tempoUnit' | 'guitar' | 'roomLevel' | 'roomLength' | 'ampCabinet' | 'ampDrive'
    > => rest
    return JSON.stringify(drawn(before)) !== JSON.stringify(drawn(after))
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
 * itself (the library does the same for the bars it draws). `guitar` is read at each play. With
 * `effects`, the room and the amplifier of the settings too (a play that names its own keeps
 * them), also read at each play.
 */
export function guitarPlayer(
    player: NotePlayer,
    guitar: () => GuitarSound,
    effects?: () => PlayEffects
): NotePlayer {
    return {
        get reportsStart() {
            return player.reportsStart
        },
        play: (events, options) => {
            const named = options.guitar && (options.effects || !effects)
            return player.play(
                events,
                named
                    ? options
                    : {
                          ...options,
                          guitar: options.guitar ?? guitar(),
                          ...(effects && !options.effects ? { effects: effects() } : {})
                      }
            )
        }
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
 * volume, the room and the amplifier are read at each play, so a change in Settings → Playback
 * applies to diagrams already drawn.
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
        ...effectOptions(current ?? (() => settings)),
        bpm: settings.bpm,
        ...strumOption(settings)
    }
}

/** The room and the amplifier as the library's `play` options, each read at each play. */
function effectOptions(
    current: () => PlaybackSettings
): Pick<PlayOptions, 'reverb' | 'room' | 'dry' | 'amp'> {
    const effects = (): PlayEffects => playEffects(current())
    return {
        reverb: () => effects().reverb,
        room: () => effects().room,
        dry: () => effects().dry === true,
        amp: () => effects().amp
    }
}

/**
 * The effects a `play` option asks for, read now: for a play the plugin starts itself with the
 * options it gives the library (the note drill). Undefined when the option names none.
 */
export function effectsNow(play: PlayOptions): PlayEffects | undefined {
    const read = <T>(value: T | (() => T | null | undefined) | undefined): T | undefined =>
        (typeof value === 'function' ? (value as () => T | null | undefined)() : value) ?? undefined
    const reverb = read(play.reverb)
    const room = read(play.room)
    const amp = read(play.amp)
    const effects: PlayEffects = {
        ...(reverb === undefined ? {} : { reverb }),
        ...(room === undefined ? {} : { room }),
        ...(read(play.dry) === true ? { dry: true } : {}),
        ...(amp ? { amp } : {})
    }
    return Object.keys(effects).length ? effects : undefined
}
