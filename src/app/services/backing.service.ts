/**
 * The backing loop (#69): a progression played in time, one chord a bar, through the library's
 * `playProgression`, with a speed trainer. One instance for the plugin, so only one plays.
 */
import {
    playProgression,
    type NotePlayer,
    type ProgressionChordInput,
    type ProgressionHandle,
    type ProgressionStrum,
    type Sound,
    type VoicingLookup
} from '@dsebastien/music-notation'
import { clampBackingBpm } from '../domain/backing'
import { trainerBpm, type Trainer } from '../domain/metronome'

export interface BackingRequest {
    chords: readonly ProgressionChordInput[]
    beatsPerBar: number
    beatUnit: number
    /** Counted beats a minute (a dotted quarter in 6/8). */
    bpm: number
    strum: ProgressionStrum
    /** A strumming pattern's ```strum text, played in every bar instead of `strum`. */
    pattern?: string
    click: boolean
    countIn: boolean
    loop: boolean
    /** 0 to 1. */
    volume: number
    trainer: Trainer | null
    player?: NotePlayer
    window?: Window
    sound?: Sound
    voicings?: VoicingLookup
}

export interface BackingState {
    running: boolean
    bpm: number
    /** The bar sounding now (from 0), null when nothing plays. */
    bar: number | null
    /** The pass (from 1). */
    pass: number
    trainer: Trainer | null
}

type Play = typeof playProgression

export class BackingTrack {
    state: BackingState = { running: false, bpm: 80, bar: null, pass: 0, trainer: null }
    private handle: ProgressionHandle | null = null
    /** Bars heard since the start or the last tempo set by hand: the trainer counts them. */
    private bars = 0
    private heard = 0
    private readonly listeners = new Set<() => void>()

    constructor(
        private readonly play: Play = playProgression,
        /** Called before each start: stops whatever else plays (the metronome). */
        private readonly beforeStart: () => void = () => {}
    ) {}

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private changed(): void {
        for (const listener of this.listeners) listener()
    }

    /** Plays the request, after stopping what played; throws when the library can't play it. */
    start(request: BackingRequest): void {
        this.stop()
        this.beforeStart()
        const bpm = clampBackingBpm(request.bpm)
        this.bars = 0
        this.heard = 0
        const handle = this.play(request.chords, {
            bpm,
            beatsPerBar: request.beatsPerBar,
            beatUnit: request.beatUnit,
            ...(request.pattern ? { pattern: request.pattern } : { strum: request.strum }),
            click: request.click,
            countIn: request.countIn,
            loop: request.loop,
            volume: request.volume,
            ...(request.player ? { player: request.player } : {}),
            ...(request.window ? { window: request.window } : {}),
            ...(request.sound ? { sound: request.sound } : {}),
            ...(request.voicings ? { voicings: request.voicings } : {}),
            onBar: (bar, _chord, pass) => {
                if (this.handle !== handle) return
                this.onBar(bar, pass)
            },
            onEnd: () => {
                if (this.handle !== handle) return
                this.handle = null
                this.state = { ...this.state, running: false, bar: null }
                this.changed()
            }
        })
        this.handle = handle
        this.state = {
            running: true,
            bpm,
            bar: null,
            pass: 0,
            trainer: request.trainer ? { ...request.trainer, start: bpm } : null
        }
        this.changed()
    }

    private onBar(bar: number, pass: number): void {
        // The first bar heard starts the count: a bar is played once the next one starts.
        if (this.heard++ > 0) this.bars++
        this.state = { ...this.state, bar, pass }
        const trainer = this.state.trainer
        if (trainer) {
            const bpm = clampBackingBpm(trainerBpm(trainer, this.bars))
            if (bpm !== this.state.bpm) {
                this.state = { ...this.state, bpm }
                this.handle?.update({ bpm })
            }
        }
        this.changed()
    }

    stop(): void {
        const handle = this.handle
        this.handle = null
        handle?.stop()
        if (this.state.running || this.state.bar !== null) {
            this.state = { ...this.state, running: false, bar: null }
            this.changed()
        }
    }

    /** A tempo by hand: from the next pass; the trainer goes on from there. */
    setBpm(bpm: number): void {
        const next = clampBackingBpm(bpm)
        this.bars = 0
        this.heard = this.state.bar !== null ? 1 : 0
        this.state = {
            ...this.state,
            bpm: next,
            trainer: this.state.trainer ? { ...this.state.trainer, start: next } : null
        }
        this.handle?.update({ bpm: next })
        this.changed()
    }

    /** The speed trainer on (from the tempo now) or off. */
    setTrainer(trainer: Trainer | null): void {
        this.bars = 0
        this.heard = this.state.bar !== null ? 1 : 0
        this.state = {
            ...this.state,
            trainer: trainer ? { ...trainer, start: this.state.bpm } : null
        }
        this.changed()
    }

    /** Click, volume or loop, from the next pass. */
    update(changes: { click?: boolean; volume?: number; loop?: boolean }): void {
        this.handle?.update(changes)
    }

    /** Stop and forget the listeners (plugin unload). */
    destroy(): void {
        this.stop()
        this.listeners.clear()
    }
}
