/** Metronome timing and the speed trainer, without audio (#39). */

export const MIN_BPM = 20
export const MAX_BPM = 300

/** Clicks per beat: none, 8ths, triplets, 16ths. */
export type Subdivision = 1 | 2 | 3 | 4

/** `count`: a count-in click, before the first bar (#77). */
export type TickKind = 'accent' | 'beat' | 'sub' | 'count'

/** Count-in bars: none to 4 (#77). */
export const MAX_COUNT_IN_BARS = 4

export interface MetronomeSettings {
    beatsPerBar: number
    subdivision: Subdivision
    /** 0 to 1. */
    volume: number
    /** Speed trainer: BPM added every `trainerBars` bars. */
    trainerStep: number
    trainerBars: number
    /** Bars of beat clicks before the first bar, 0 for none (#77). */
    countInBars: number
    /** A visual flash on each beat, beat one in another color, for noisy rooms (#77). */
    flash: boolean
}

export const createDefaultMetronomeSettings = (): MetronomeSettings => ({
    beatsPerBar: 4,
    subdivision: 1,
    volume: 0.7,
    trainerStep: 2,
    trainerBars: 4,
    countInBars: 1,
    flash: false
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

/** Beats per bar and clicks per beat. */
export interface Meter {
    beatsPerBar: number
    /** Clicks per beat the meter needs (triplets for 6/8); null keeps the metronome's own. */
    subdivision: Subdivision | null
}

/**
 * A note's time signature as the metronome counts it (#77): "3/4" is 3 beats; compound meters
 * ("6/8", "9/8", "12/8", "6/16") count dotted beats of three clicks, as the strum blocks do
 * (6/8 is 2 beats of triplets); "C" is 4/4 and "¢" 2/2. Null when it isn't a time signature the
 * metronome can count (2 to 12 beats a bar), so the metronome keeps its own.
 */
export function meterOf(value: unknown): Meter | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const text = String(value).trim()
    if (text === 'C') return { beatsPerBar: 4, subdivision: null }
    if (text === '¢' || text === 'C|') return { beatsPerBar: 2, subdivision: null }
    const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(text)
    if (!m) return null
    const beats = Number(m[1])
    const unit = Number(m[2])
    if (![1, 2, 4, 8, 16].includes(unit)) return null
    if (unit >= 8 && beats > 3 && beats % 3 === 0) {
        const dotted = beats / 3
        return dotted >= 2 && dotted <= 12 ? { beatsPerBar: dotted, subdivision: 3 } : null
    }
    return beats >= 2 && beats <= 12 ? { beatsPerBar: beats, subdivision: null } : null
}

/** How a meter reads in the metronome ("6/8 (2 beats)", "3/4"). */
export function meterLabel(text: string, meter: Meter): string {
    const clean = text.trim()
    return meter.subdivision === 3 ? `${clean} (${meter.beatsPerBar} beats)` : clean
}

/** Count-in clicks before the first bar: one per beat, so the subdivision doesn't change them. */
export const countInBeats = (countInBars: number, beatsPerBar: number): number =>
    Math.max(0, Math.min(MAX_COUNT_IN_BARS, Math.floor(countInBars))) * beatsPerBar

/** The drill's count-in: 3, 2, 1 seconds when the metronome counts in, else none (#77). */
export const drillCountIn = (countInBars: number): number => (countInBars > 0 ? 3 : 0)
