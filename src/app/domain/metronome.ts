/** Metronome timing and the speed trainer, without audio (#39). */

export const MIN_BPM = 20
export const MAX_BPM = 300

/** Clicks per beat: none, 8ths, triplets, 16ths. */
export type Subdivision = 1 | 2 | 3 | 4

export type TickKind = 'accent' | 'beat' | 'sub'

export interface MetronomeSettings {
    beatsPerBar: number
    subdivision: Subdivision
    /** 0 to 1. */
    volume: number
    /** Speed trainer: BPM added every `trainerBars` bars. */
    trainerStep: number
    trainerBars: number
}

export const createDefaultMetronomeSettings = (): MetronomeSettings => ({
    beatsPerBar: 4,
    subdivision: 1,
    volume: 0.7,
    trainerStep: 2,
    trainerBars: 4
})

export const clampBpm = (bpm: number): number =>
    Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, Number.isFinite(bpm) ? bpm : MIN_BPM)))

/** Seconds between two clicks. */
export const tickSeconds = (bpm: number, subdivision: Subdivision): number =>
    60 / clampBpm(bpm) / subdivision

/** The n-th click of a run (from 0): the first of a bar is accented, then beats, then the rest. */
export function tickKind(tick: number, beatsPerBar: number, subdivision: Subdivision): TickKind {
    const inBar = tick % (beatsPerBar * subdivision)
    if (inBar === 0) return 'accent'
    return inBar % subdivision === 0 ? 'beat' : 'sub'
}

/** The beat (from 0) a click falls on, for the beat display. */
export const beatOf = (tick: number, beatsPerBar: number, subdivision: Subdivision): number =>
    Math.floor((tick % (beatsPerBar * subdivision)) / subdivision)

export interface Trainer {
    /** The BPM the trainer started from. */
    start: number
    step: number
    everyBars: number
    /** Stops there; null for no limit. */
    target: number | null
}

/** The trainer's BPM after `bars` full bars (and `taps` manual steps), never past its target. */
export function trainerBpm(trainer: Trainer, bars: number, taps = 0): number {
    const steps = Math.floor(bars / Math.max(1, trainer.everyBars)) + taps
    const bpm = trainer.start + steps * trainer.step
    // A target at or below the start isn't a ceiling: the trainer never slows down.
    const cap = trainer.target !== null && trainer.target > trainer.start ? trainer.target : null
    return clampBpm(cap !== null ? Math.min(cap, bpm) : bpm)
}

/** Tap tempo: the BPM of the last taps (epoch ms), from their average gap; null with too few. */
export function bpmFromTaps(taps: readonly number[]): number | null {
    // Taps before a pause longer than 2 s belong to an earlier tempo.
    let from = 0
    for (let i = 1; i < taps.length; i++) if (taps[i]! - taps[i - 1]! > 2000) from = i
    const recent = taps.slice(from).slice(-5)
    if (recent.length < 2) return null
    const gaps = recent.slice(1).map((t, i) => t - recent[i]!)
    // A pause longer than 2 s starts over.
    if (gaps.some((g) => g <= 0 || g > 2000)) return null
    const average = gaps.reduce((a, b) => a + b, 0) / gaps.length
    return clampBpm(60_000 / average)
}
