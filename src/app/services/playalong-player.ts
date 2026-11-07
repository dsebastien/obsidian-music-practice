/**
 * One play-along player (#75): a media element, its A-B loop read on each animation frame, the
 * speed, the sections and a count-in before each pass. No DOM here: the media element, the frame
 * clock and the count-in come in, so the rules are tested with fakes.
 */
import {
    clampSpeed,
    countInPlan,
    playedTempo,
    sectionLoop,
    setMark,
    stepSpeed,
    tappedTempo,
    tempoOf,
    wrapTarget,
    type Section,
    type Tempo
} from '../domain/playalong'
import type { CountInHandle, CountInRequest } from './metronome.service'

/** What the player uses of an HTMLMediaElement. */
export interface PlayerMedia {
    currentTime: number
    readonly duration: number
    readonly paused: boolean
    playbackRate: number
    preservesPitch: boolean
    play(): Promise<void>
    pause(): void
}

/** The block window's animation frames. */
export interface PlayerClock {
    frame(callback: () => void): number
    cancelFrame(id: number): void
}

/** What a player keeps across redraws (per note and file, until the plugin unloads). */
export interface PlayerState {
    speed: number
    a: number | null
    b: number | null
    loop: boolean
    countIn: boolean
    /** The tapped tempo, at 100 %; null until tapped. */
    tapped: number | null
    position: number
}

export const createPlayerState = (): PlayerState => ({
    speed: 1,
    a: null,
    b: null,
    loop: false,
    countIn: true,
    tapped: null,
    position: 0
})

export type PlayerStatus = 'paused' | 'counting' | 'playing'

export interface PlayerDeps {
    media: PlayerMedia
    clock: PlayerClock
    countIn: (request: CountInRequest) => CountInHandle
    settings: () => { preRoll: number; countInBars: number }
    /** The note's target BPM and beats per bar, read when needed. */
    note: () => { bpmTarget: number | null; beatsPerBar: number }
    /** The block's tempo line: the recording's tempo at 100 %. */
    blockTempo: number | null
    /** A tempo was tapped (at 100 %): the service writes it as the block's tempo line. */
    onTapped: (bpm: number) => void
    sections: readonly Section[]
    state: PlayerState
    /** Before playing: the plugin pauses the other players, the metronome and the backing loop. */
    onPlay: () => void
    /** After every change, for the view. */
    changed: () => void
    notice: (message: string) => void
    /** Epoch ms, for the taps. */
    now: () => number
    /**
     * Whether its drawing is shown: a copy hidden by another view of its note (reading view and
     * live preview) pauses. A copy off the page (scrolled far, detached) counts as shown.
     */
    visible: () => boolean
}

const TAP_HISTORY = 8
/** A playhead this close to B counts as B (a frame is about 16 ms). */
const EDGE = 0.01

export class PlayAlongController {
    status: PlayerStatus = 'paused'
    readonly state: PlayerState
    private frameId: number | null = null
    private counting: CountInHandle | null = null
    private taps: number[] = []
    private freed = false
    private toldNoTempo = false
    /** Where the counted pass starts (A, or where Play was pressed): a pause goes back there. */
    private countStart = 0
    /** Bumped at each play(): a rejection of an earlier one is stale. */
    private playToken = 0

    constructor(private readonly deps: PlayerDeps) {
        // The copies of one block (reading view, its live preview copy) share this object.
        this.state = deps.state
        this.state.speed = clampSpeed(this.state.speed)
        const media = deps.media
        media.preservesPitch = true
        media.playbackRate = this.state.speed
        if (this.state.position > 0) media.currentTime = this.state.position
    }

    get sections(): readonly Section[] {
        return this.deps.sections
    }

    /**
     * The playhead, in seconds: its media's while it plays or counts, else the shared one (the copy
     * that played or moved last recorded it).
     */
    position(): number {
        return this.status === 'paused' ? this.state.position : this.deps.media.currentTime
    }

    duration(): number {
        return this.deps.media.duration
    }

    private loopOn(): boolean {
        return this.state.loop && this.state.a !== null && this.state.b !== null
    }

    tempo(): Tempo | null {
        return tempoOf(this.deps.blockTempo, this.state.tapped, this.deps.note().bpmTarget)
    }

    /** The tempo it plays at (Save BPM); null without a tempo. */
    playedBpm(): number | null {
        const tempo = this.tempo()
        return tempo ? playedTempo(tempo.bpm, this.state.speed) : null
    }

    toggle(): void {
        if (this.status === 'paused') this.play()
        else this.pause()
    }

    /**
     * Plays from the playhead (from A when the loop is on and the playhead is past B), after the
     * count-in when it is on; `countIn: false` plays at once (going on after a redraw).
     */
    play(options: { countIn?: boolean } = {}): void {
        if (this.freed || this.status !== 'paused') return
        this.deps.onPlay()
        // Another copy of the block may have moved the playhead or the speed.
        const media = this.deps.media
        media.playbackRate = this.state.speed
        if (Math.abs(media.currentTime - this.state.position) > 0.05)
            media.currentTime = this.state.position
        const at = Math.max(0, media.currentTime)
        const { preRoll } = this.deps.settings()
        const a = this.state.a
        const b = this.state.b
        // Past B, or in the pre-roll before A (a section loop set while paused): a pass from A.
        const pass =
            this.loopOn() && (at >= b! - EDGE || (at >= wrapTarget(a!, preRoll) - EDGE && at <= a!))
        this.startFrom(pass ? a! : at, pass, options.countIn ?? true)
    }

    /**
     * Starts a pass at `start`: with the count-in, from the pre-roll before it so that `start`
     * sounds on the beat after the clicks; else at once (from the pre-roll for a loop's pass).
     */
    private startFrom(start: number, pass: boolean, countIn = true): void {
        const { preRoll, countInBars } = this.deps.settings()
        const media = this.deps.media
        const tempo = this.tempo()
        if (countIn && this.state.countIn && tempo) {
            media.pause()
            const from = wrapTarget(start, preRoll)
            media.currentTime = from
            this.state.position = from
            const plan = countInPlan({
                bpm: tempo.bpm,
                speed: this.state.speed,
                beatsPerBar: this.deps.note().beatsPerBar,
                bars: countInBars
            })
            const handle = this.deps.countIn({
                beats: plan.beats,
                beatsPerBar: plan.beatsPerBar,
                bpm: plan.bpm,
                // To the millisecond: the clock schedules no finer.
                lead: Math.round(((start - from) / this.state.speed) * 1000) / 1000
            })
            this.counting = handle
            this.countStart = start
            this.status = 'counting'
            this.stopFrames()
            this.deps.changed()
            void handle.done.then((ok) => {
                if (!ok || this.freed || this.counting !== handle) return
                this.counting = null
                this.resume()
            })
            return
        }
        if (countIn && this.state.countIn && !tempo && !this.toldNoTempo) {
            this.toldNoTempo = true
            this.deps.notice('Count-in: tap the tempo first (T, or the Tap button).')
        }
        media.currentTime = pass ? wrapTarget(start, preRoll) : start
        this.state.position = media.currentTime
        this.resume()
    }

    /** The media plays; the frame loop watches for B. */
    private resume(): void {
        const media = this.deps.media
        this.status = 'playing'
        this.startFrames()
        this.deps.changed()
        const token = ++this.playToken
        media.play().catch((error: unknown) => {
            // A play() interrupted by a pause or a new pass (AbortError), or an earlier one: no failure.
            if (this.freed || token !== this.playToken || this.status !== 'playing') return
            if (error instanceof Error && error.name === 'AbortError') return
            this.status = 'paused'
            this.stopFrames()
            this.deps.notice(
                `Couldn't play the recording: ${error instanceof Error ? error.message : String(error)}`
            )
            this.deps.changed()
        })
    }

    pause(): void {
        const counting = this.status === 'counting'
        this.cancelCount()
        this.deps.media.pause()
        this.stopFrames()
        if (counting) {
            // Back to the pass's start: Play again counts in to the same beat.
            this.deps.media.currentTime = this.countStart
            this.state.position = this.countStart
        } else if (this.status !== 'paused') this.state.position = this.deps.media.currentTime
        if (this.status !== 'paused') {
            this.status = 'paused'
            this.deps.changed()
        }
    }

    private cancelCount(): void {
        const handle = this.counting
        this.counting = null
        handle?.cancel()
    }

    private startFrames(): void {
        if (this.frameId !== null) return
        this.frameId = this.deps.clock.frame(() => this.frame())
    }

    private stopFrames(): void {
        if (this.frameId !== null) this.deps.clock.cancelFrame(this.frameId)
        this.frameId = null
    }

    /** Each animation frame of the block's window: `check`, then the next frame while it plays. */
    frame(): void {
        this.frameId = null
        if (this.check()) this.startFrames()
    }

    /**
     * The loop's end, a pause from outside, the view; also on `timeupdate` (frames stop in a
     * hidden window). True when it plays on.
     */
    check(): boolean {
        if (this.freed || this.status !== 'playing') return false
        const media = this.deps.media
        if (!this.deps.visible()) {
            this.pause()
            return false
        }
        if (media.paused) {
            this.stopFrames()
            this.status = 'paused'
            this.deps.changed()
            return false
        }
        if (this.loopOn() && media.currentTime >= this.state.b! - EDGE) {
            this.wrap()
            return false
        }
        this.state.position = media.currentTime
        this.deps.changed()
        return true
    }

    /** The recording ended: a loop goes round, else it stops. */
    ended(): void {
        // Only a playing player: an `ended` after a seek to the end while paused, or one that
        // comes during a count-in, changes nothing.
        if (this.freed || this.status !== 'playing') return
        if (this.loopOn()) {
            this.wrap()
            return
        }
        this.stopFrames()
        this.status = 'paused'
        this.state.position = this.deps.media.currentTime
        this.deps.changed()
    }

    /** Back to A for the next pass. */
    private wrap(): void {
        this.stopFrames()
        this.cancelCount()
        this.deps.media.pause()
        this.status = 'paused'
        this.startFrom(this.state.a!, true)
    }

    seek(time: number): void {
        if (this.freed) return
        const duration = this.duration()
        const end = Number.isFinite(duration) ? duration : Number.POSITIVE_INFINITY
        const to = Math.min(end, Math.max(0, time))
        if (this.status === 'counting') {
            // Counted in again from the new place (past B with the loop on: a pass from A).
            this.cancelCount()
            this.status = 'paused'
            if (this.loopOn() && to >= this.state.b! - EDGE) this.startFrom(this.state.a!, true)
            else this.startFrom(to, false)
            return
        }
        this.deps.media.currentTime = to
        this.state.position = to
        this.deps.changed()
    }

    nudge(seconds: number): void {
        this.seek(this.position() + seconds)
    }

    setSpeed(speed: number): void {
        if (this.freed) return
        this.state.speed = clampSpeed(speed)
        this.deps.media.playbackRate = this.state.speed
        this.deps.changed()
    }

    slower(): void {
        this.setSpeed(stepSpeed(this.state.speed, -1))
    }

    faster(): void {
        this.setSpeed(stepSpeed(this.state.speed, 1))
    }

    private mark(which: 'a' | 'b'): void {
        if (this.freed) return
        const result = setMark(this.state, which, this.position())
        if (!result.ok) {
            this.deps.notice(result.message)
            return
        }
        Object.assign(this.state, result.loop)
        this.deps.changed()
    }

    setA(): void {
        this.mark('a')
    }

    setB(): void {
        this.mark('b')
    }

    clearLoop(): void {
        if (this.freed) return
        this.state.a = null
        this.state.b = null
        this.state.loop = false
        this.deps.changed()
    }

    toggleLoop(): void {
        if (this.freed) return
        if (this.state.a === null || this.state.b === null) {
            this.deps.notice('Set A and B first ([ and ]).')
            return
        }
        this.state.loop = !this.state.loop
        this.deps.changed()
    }

    toggleCountIn(): void {
        if (this.freed) return
        this.state.countIn = !this.state.countIn
        this.deps.changed()
    }

    jump(index: number): void {
        const section = this.deps.sections[index]
        if (section) this.seek(section.time)
    }

    /** Loops a section: from the pre-roll before it; a pass starts at once when it plays. */
    loopSection(index: number): void {
        if (this.freed) return
        const loop = sectionLoop(this.deps.sections, index, this.duration())
        if (!loop) {
            this.deps.notice(
                'This section is too short to loop, or the recording is still loading.'
            )
            return
        }
        Object.assign(this.state, loop)
        if (this.status === 'paused') {
            this.deps.media.currentTime = wrapTarget(loop.a!, this.deps.settings().preRoll)
            this.state.position = this.deps.media.currentTime
            this.deps.changed()
            return
        }
        this.wrap()
    }

    /** A tap of the tempo heard; two taps or more set it (at 100 %). */
    tap(): void {
        if (this.freed) return
        this.taps = [...this.taps, this.deps.now()].slice(-TAP_HISTORY)
        const bpm = tappedTempo(this.taps, this.state.speed)
        if (bpm !== null) {
            this.state.tapped = bpm
            this.toldNoTempo = false
            this.deps.onTapped(bpm)
        }
        this.deps.changed()
    }

    get isFreed(): boolean {
        return this.freed
    }

    /** Stops for good: the block is gone, its note closed, or the plugin unloads. */
    free(): void {
        if (this.freed) return
        this.pause()
        this.freed = true
    }
}
