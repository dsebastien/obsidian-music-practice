/**
 * The metronome: Web Audio clicks scheduled ahead of time (steady while Obsidian is busy), one
 * instance for the whole plugin so the panel, the modal and the commands drive the same one.
 */
import {
    beatOf,
    clampBpm,
    countInBeats,
    tickKind,
    tickSeconds,
    trainerBpm,
    type Meter,
    type MetronomeSettings,
    type Subdivision,
    type TickKind,
    type Trainer
} from '../domain/metronome'

/** The learning note the metronome practices, for its BPMs and Save BPM. */
export interface MetronomeItem {
    path: string
    name: string
    bpmCurrent: number | null
    bpmTarget: number | null
    /** The note's time signature, as the metronome counts it (#77). */
    meter?: ItemMeter | null
}

/** A meter read from a note, with its label ("6/8 (2 beats)"). */
export interface ItemMeter extends Meter {
    label: string
}

export interface MetronomeState {
    running: boolean
    bpm: number
    /** The beat sounding now (from 0), for the display. */
    beat: number
    trainer: Trainer | null
    item: MetronomeItem | null
    /** The count-in is playing (#77). */
    countIn: boolean
    /** Beats sounded since the start, count-in included: the flash follows it (#77). */
    pulse: number
    /** The item's time signature, used instead of the settings' beats and clicks (#77). */
    meter: ItemMeter | null
}

/** A count-in for another player (#75): clicks on the metronome's clock, without starting it. */
export interface CountInRequest {
    beats: number
    beatsPerBar: number
    bpm: number
    /** Seconds before the beat after the last click at which `done` resolves (the player starts then). */
    lead: number
    /** The window whose timer ends it (the player's: a popout's timers run there); the metronome's by default. */
    window?: Window
}

export interface CountInHandle {
    /** True at the end (`lead` before the next beat), false when cancelled. */
    done: Promise<boolean>
    /** Silences the clicks still to come; `done` resolves to false. */
    cancel(): void
}

const LOOKAHEAD_S = 0.12
const INTERVAL_MS = 25
const FREQUENCY: Record<TickKind, number> = { accent: 1600, beat: 1100, sub: 800, count: 2000 }
const LOUDNESS: Record<TickKind, number> = { accent: 1, beat: 0.7, sub: 0.35, count: 0.8 }

export class Metronome {
    state: MetronomeState = {
        running: false,
        bpm: 80,
        beat: 0,
        trainer: null,
        item: null,
        countIn: false,
        pulse: 0,
        meter: null
    }
    private context: AudioContext | null = null
    private timer: number | null = null
    private tick = 0
    private nextAt = 0
    private bars = 0
    private taps = 0
    private readonly listeners = new Set<() => void>()
    private readonly pending = new Set<number>()
    private meter = { beats: 0, subdivision: 0 }
    /** Count-in clicks left before the first bar. */
    private countInLeft = 0
    private countInTotal = 0
    /** Count-ins clicking now (#75): the audio device rests only when none is. */
    private countIns = 0

    constructor(
        private readonly win: Window,
        private readonly settings: () => MetronomeSettings
    ) {}

    /** Called after every change (BPM, beat, start, stop); returns the unsubscribe. */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private changed(): void {
        for (const listener of this.listeners) listener()
    }

    /**
     * Practice an item: its current BPM becomes the tempo and its time signature the meter (unless
     * running). An item without a time signature leaves the settings' beats and clicks.
     */
    setItem(item: MetronomeItem | null): void {
        this.state.item = item
        if (!this.state.running) {
            if (item?.bpmCurrent) this.state.bpm = clampBpm(item.bpmCurrent)
            this.state.meter = item?.meter ?? null
        }
        this.changed()
    }

    /** Beats per bar and clicks per beat now: the item's time signature, else the settings. */
    meterNow(): { beatsPerBar: number; subdivision: Subdivision } {
        const settings = this.settings()
        const meter = this.state.meter
        return meter
            ? {
                  beatsPerBar: meter.beatsPerBar,
                  subdivision: meter.subdivision ?? settings.subdivision
              }
            : { beatsPerBar: settings.beatsPerBar, subdivision: settings.subdivision }
    }

    /** Back to the settings' beats and clicks (beats or clicks chosen by hand). */
    clearMeter(): void {
        if (!this.state.meter) return
        this.state.meter = null
        this.changed()
    }

    setBpm(bpm: number): void {
        this.state.bpm = clampBpm(bpm)
        // A tempo set by hand restarts the trainer from there.
        if (this.state.trainer)
            this.state.trainer = { ...this.state.trainer, start: this.state.bpm }
        this.bars = 0
        this.taps = 0
        this.changed()
    }

    /** Turn the speed trainer on (from the current BPM, up to the item's target) or off. */
    setTrainer(on: boolean): void {
        const { trainerStep, trainerBars } = this.settings()
        this.state.trainer = on
            ? {
                  start: this.state.bpm,
                  step: trainerStep,
                  everyBars: trainerBars,
                  target: this.state.item?.bpmTarget ?? null
              }
            : null
        this.bars = 0
        this.taps = 0
        this.changed()
    }

    /** The speed trainer's manual step ("+", after a clean repetition). */
    stepUp(): void {
        if (!this.state.trainer) return this.setBpm(this.state.bpm + this.settings().trainerStep)
        this.taps++
        this.state.bpm = trainerBpm(this.state.trainer, this.bars, this.taps)
        this.changed()
    }

    start(): void {
        if (this.state.running) return
        const Context = (this.win as Window & { AudioContext?: typeof AudioContext }).AudioContext
        if (!Context) throw new Error('This device has no Web Audio: the metronome cannot play.')
        this.context ??= new Context()
        this.context.resume().catch(() => {})
        this.tick = 0
        this.bars = 0
        this.taps = 0
        // The trainer goes on from the tempo it reached, not from where it first started.
        if (this.state.trainer)
            this.state.trainer = { ...this.state.trainer, start: this.state.bpm }
        this.nextAt = this.context.currentTime + 0.05
        this.countInTotal = countInBeats(this.settings().countInBars, this.meterNow().beatsPerBar)
        this.countInLeft = this.countInTotal
        this.meter = { beats: 0, subdivision: 0 }
        this.state.countIn = this.countInLeft > 0
        this.state.pulse = 0
        this.state.running = true
        this.timer = this.win.setInterval(() => this.schedule(), INTERVAL_MS)
        this.schedule()
        this.changed()
    }

    stop(): void {
        if (this.timer !== null) this.win.clearInterval(this.timer)
        this.timer = null
        for (const id of this.pending) this.win.clearTimeout(id)
        this.pending.clear()
        this.state.running = false
        this.state.beat = 0
        this.state.countIn = false
        this.countInLeft = 0
        // Let the audio device rest until the next start.
        this.context?.suspend().catch(() => {})
        this.changed()
    }

    toggle(): void {
        if (this.state.running) this.stop()
        else this.start()
    }

    /**
     * Clicks a count-in for another player (the play-along player, #75) on this metronome's audio
     * clock, with its volume and sounds (the first beat of each bar in the count-in pitch), without
     * starting the metronome. `done` resolves `lead` seconds before the beat after the last click.
     */
    countIn(request: CountInRequest): CountInHandle {
        let cancelled = false
        let timer: number | null = null
        const timers = request.window ?? this.win
        this.countIns++
        const nodes: OscillatorNode[] = []
        let finish: (ok: boolean) => void = () => {}
        const done = new Promise<boolean>((resolve) => (finish = resolve))
        const cancel = (): void => {
            if (cancelled) return
            cancelled = true
            if (timer !== null) timers.clearTimeout(timer)
            timer = null
            this.countIns--
            this.rest(0)
            for (const node of nodes) {
                try {
                    node.stop(0)
                } catch {
                    // Already stopped.
                }
            }
            nodes.length = 0
            finish(false)
        }
        const Context = (this.win as Window & { AudioContext?: typeof AudioContext }).AudioContext
        if (!Context) {
            cancelled = true
            this.countIns--
            finish(true)
            return { done, cancel }
        }
        this.context ??= new Context()
        const context = this.context
        void context
            .resume()
            .catch(() => {})
            .then(() => {
                if (cancelled) return
                const { volume } = this.settings()
                const beat = tickSeconds(request.bpm, 1)
                // A lead longer than the clicks (a long pre-roll at a slow speed): the clicks start
                // later, so the player never has to start before now.
                const start =
                    context.currentTime + 0.05 + Math.max(0, request.lead - request.beats * beat)
                for (let n = 0; n < request.beats; n++) {
                    const kind: TickKind = n % request.beatsPerBar === 0 ? 'count' : 'beat'
                    nodes.push(this.click(context, start + n * beat, kind, volume))
                }
                const end = start + request.beats * beat - request.lead
                const delay = Math.max(0, (end - context.currentTime) * 1000)
                timer = timers.setTimeout(() => {
                    timer = null
                    if (cancelled) return
                    // Ended: a cancel from now on changes nothing.
                    cancelled = true
                    nodes.length = 0
                    this.countIns--
                    finish(true)
                    // The audio device rests once the clicks are over (after the beat they lead to).
                    this.rest(
                        Math.max(0, (start + request.beats * beat - context.currentTime) * 1000) +
                            150
                    )
                }, delay)
            })
        return { done, cancel }
    }

    /** Suspends the audio context after `ms` when nothing uses it (no metronome, no count-in). */
    private rest(ms: number): void {
        const id = this.win.setTimeout(() => {
            this.pending.delete(id)
            if (!this.state.running && this.countIns === 0) this.context?.suspend().catch(() => {})
        }, ms)
        this.pending.add(id)
    }

    /** Stop and release the audio device (plugin unload). */
    destroy(): void {
        this.stop()
        void this.context?.close()
        this.context = null
        this.listeners.clear()
    }

    /** Schedules every click due before the look-ahead window ends. */
    private schedule(): void {
        const context = this.context
        if (!context || !this.state.running) return
        const { volume } = this.settings()
        const { beatsPerBar, subdivision } = this.meterNow()
        // After a stall (a busy window, a throttled tab), go on from now: never play the missed clicks at once.
        if (this.nextAt < context.currentTime) this.nextAt = context.currentTime + 0.02
        // The count-in: one click a beat, then the first bar starts (#77).
        while (this.countInLeft > 0 && this.nextAt < context.currentTime + LOOKAHEAD_S) {
            const n = this.countInTotal - this.countInLeft
            this.click(context, this.nextAt, n % beatsPerBar === 0 ? 'count' : 'beat', volume)
            this.showBeat(context, this.nextAt, n % beatsPerBar, true, true)
            this.nextAt += tickSeconds(this.state.bpm, 1)
            this.countInLeft--
        }
        if (this.countInLeft > 0) return
        // Beats per bar or clicks changed while playing: start a new bar, so accents stay on beat one.
        if (beatsPerBar !== this.meter.beats || subdivision !== this.meter.subdivision) {
            this.meter = { beats: beatsPerBar, subdivision }
            this.tick = 0
        }
        while (this.nextAt < context.currentTime + LOOKAHEAD_S) {
            const kind = tickKind(this.tick, beatsPerBar, subdivision)
            if (kind === 'accent' && this.tick > 0) {
                this.bars++
                if (this.state.trainer)
                    this.state.bpm = trainerBpm(this.state.trainer, this.bars, this.taps)
            }
            this.click(context, this.nextAt, kind, volume)
            this.showBeat(
                context,
                this.nextAt,
                beatOf(this.tick, beatsPerBar, subdivision),
                false,
                kind !== 'sub'
            )
            this.nextAt += tickSeconds(this.state.bpm, subdivision)
            this.tick++
        }
    }

    private click(
        context: AudioContext,
        at: number,
        kind: TickKind,
        volume: number
    ): OscillatorNode {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.frequency.value = FREQUENCY[kind]
        const peak = Math.max(0.0001, volume * LOUDNESS[kind])
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start(at)
        oscillator.stop(at + 0.06)
        return oscillator
    }

    /** Moves the beat display when the click sounds; a beat (not a subdivision) also pulses. */
    private showBeat(
        context: AudioContext,
        at: number,
        beat: number,
        countIn: boolean,
        pulse: boolean
    ): void {
        const delay = Math.max(0, (at - context.currentTime) * 1000)
        const id = this.win.setTimeout(() => {
            this.pending.delete(id)
            if (!this.state.running) return
            this.state.beat = beat
            this.state.countIn = countIn
            if (pulse) this.state.pulse++
            this.changed()
        }, delay)
        this.pending.add(id)
    }
}
