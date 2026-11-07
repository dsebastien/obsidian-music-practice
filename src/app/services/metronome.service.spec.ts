import { describe, expect, it } from 'bun:test'
import { createDefaultMetronomeSettings, type MetronomeSettings } from '../domain/metronome'
import { Metronome } from './metronome.service'

const fake = <T>(value: unknown): T => value as T

/** A window whose timers run by hand, and an audio context whose clock moves by hand. */
function harness(settings: Partial<MetronomeSettings> = {}) {
    const clicks: { at: number; frequency: number; stops: number[] }[] = []
    let now = 0
    let suspends = 0
    const timeouts = new Map<number, { at: number; run: () => void }>()
    let id = 0
    let interval: (() => void) | null = null
    class FakeContext {
        get currentTime() {
            return now
        }
        destination = {}
        resume = () => Promise.resolve()
        suspend = () => {
            suspends++
            return Promise.resolve()
        }
        close = () => Promise.resolve()
        createOscillator() {
            const stops: number[] = []
            const node = {
                frequency: { value: 0 },
                connect: (gain: unknown) => gain,
                start: (at: number) => clicks.push({ at, frequency: node.frequency.value, stops }),
                stop: (at = now) => stops.push(at)
            }
            return node
        }
        createGain() {
            return {
                gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                connect: (dest: unknown) => dest
            }
        }
    }
    const win = {
        AudioContext: FakeContext,
        setInterval: (fn: () => void) => {
            interval = fn
            return 1
        },
        clearInterval: () => {
            interval = null
        },
        setTimeout: (fn: () => void, ms: number) => {
            timeouts.set(++id, { at: now + ms / 1000, run: fn })
            return id
        },
        clearTimeout: (n: number) => timeouts.delete(n)
    }
    const config = { ...createDefaultMetronomeSettings(), ...settings }
    const metronome = new Metronome(fake<Window>(win), () => config)
    /** Move the clock on, running the scheduler and the beat display as they fall due. */
    const advance = (seconds: number) => {
        const end = now + seconds
        while (now < end - 1e-9) {
            now = Math.min(end, now + 0.025)
            interval?.()
            for (const [key, t] of [...timeouts].sort((a, b) => a[1].at - b[1].at))
                if (t.at <= now + 1e-9) {
                    timeouts.delete(key)
                    t.run()
                }
        }
    }
    return { metronome, clicks, advance, config, suspends: () => suspends, win }
}

describe('Metronome count-in and pulse (#77)', () => {
    it('clicks one bar of beats before the first bar, then plays the bar', () => {
        const { metronome, clicks, advance } = harness({ countInBars: 1, beatsPerBar: 4 })
        metronome.setBpm(120)
        metronome.start()
        expect(metronome.state.countIn).toBe(true)
        advance(1.9)
        // 4 count-in beats half a second apart, the first in the count-in pitch.
        const countIn = clicks.slice(0, 4)
        expect(countIn.map((c) => c.frequency)).toEqual([2000, 1100, 1100, 1100])
        expect(countIn[1]!.at - countIn[0]!.at).toBeCloseTo(0.5)
        expect(metronome.state.countIn).toBe(true)
        advance(0.3)
        // The first bar's accent comes a beat after the last count-in click.
        expect(clicks[4]!.frequency).toBe(1600)
        expect(clicks[4]!.at - clicks[3]!.at).toBeCloseTo(0.5)
        expect(metronome.state.countIn).toBe(false)
        metronome.stop()
    })

    it('pulses on beats only, count-in included, not on subdivisions', () => {
        const { metronome, advance } = harness({ countInBars: 1, beatsPerBar: 2, subdivision: 2 })
        metronome.setBpm(120)
        metronome.start()
        // Count-in: 2 beats (1 s). Then 2 bars of 2 beats with 8ths (2 s).
        advance(3.01)
        expect(metronome.state.pulse).toBe(6)
        metronome.stop()
    })

    it('plays no count-in when it is off', () => {
        const { metronome, clicks, advance } = harness({ countInBars: 0 })
        metronome.start()
        expect(metronome.state.countIn).toBe(false)
        advance(0.1)
        expect(clicks[0]!.frequency).toBe(1600)
        metronome.stop()
    })

    it('starts the speed trainer counting after the count-in', () => {
        const { metronome, advance } = harness({
            countInBars: 2,
            beatsPerBar: 2,
            trainerBars: 1,
            trainerStep: 5
        })
        metronome.setBpm(120)
        metronome.setTrainer(true)
        metronome.start()
        // The count-in (4 beats, 2 s) and the first bar: no step yet.
        advance(2.9)
        expect(metronome.state.bpm).toBe(120)
        // The second bar's accent steps the tempo.
        advance(0.2)
        expect(metronome.state.bpm).toBe(125)
        metronome.stop()
    })
})

describe('Metronome meter from the item (#77)', () => {
    it("counts the item's time signature instead of the settings, until chosen by hand", () => {
        const { metronome } = harness({ beatsPerBar: 4, subdivision: 2 })
        metronome.setItem({
            path: 'Waltz.md',
            name: 'Waltz',
            bpmCurrent: 90,
            bpmTarget: 120,
            meter: { beatsPerBar: 3, subdivision: null, label: '3/4' }
        })
        expect(metronome.meterNow()).toEqual({ beatsPerBar: 3, subdivision: 2 })
        metronome.setItem({
            path: 'Jig.md',
            name: 'Jig',
            bpmCurrent: null,
            bpmTarget: null,
            meter: { beatsPerBar: 2, subdivision: 3, label: '6/8 (2 beats)' }
        })
        expect(metronome.meterNow()).toEqual({ beatsPerBar: 2, subdivision: 3 })
        metronome.clearMeter()
        expect(metronome.meterNow()).toEqual({ beatsPerBar: 4, subdivision: 2 })
    })

    it('keeps the meter it plays while running, and an item without one uses the settings', () => {
        const { metronome } = harness({ beatsPerBar: 4 })
        metronome.setItem({
            path: 'A.md',
            name: 'A',
            bpmCurrent: null,
            bpmTarget: null,
            meter: { beatsPerBar: 3, subdivision: null, label: '3/4' }
        })
        metronome.start()
        metronome.setItem({ path: 'B.md', name: 'B', bpmCurrent: null, bpmTarget: null })
        expect(metronome.meterNow().beatsPerBar).toBe(3)
        metronome.stop()
        metronome.setItem({ path: 'B.md', name: 'B', bpmCurrent: null, bpmTarget: null })
        expect(metronome.meterNow().beatsPerBar).toBe(4)
    })
})

describe('Metronome.countIn (#75, the play-along player)', () => {
    it('clicks the beats at the tempo, the first of each bar in the count-in pitch', async () => {
        const { metronome, clicks, advance } = harness({ volume: 0.5 })
        const count = metronome.countIn({ beats: 6, beatsPerBar: 3, bpm: 120, lead: 0 })
        await Promise.resolve()
        await Promise.resolve()
        expect(clicks.map((c) => c.frequency)).toEqual([2000, 1100, 1100, 2000, 1100, 1100])
        const gaps = clicks.slice(1).map((c, i) => c.at - clicks[i]!.at)
        for (const gap of gaps) expect(gap).toBeCloseTo(0.5)
        let done = null as boolean | null
        void count.done.then((ok) => (done = ok))
        advance(clicks[0]!.at + 2.9)
        await Promise.resolve()
        expect(done).toBeNull()
        advance(0.2)
        await Promise.resolve()
        expect(done).toBe(true)
        // The metronome itself did not start.
        expect(metronome.state.running).toBe(false)
    })
    it('ends `lead` seconds before the beat after the last click', async () => {
        const { metronome, clicks, advance } = harness()
        const count = metronome.countIn({ beats: 4, beatsPerBar: 4, bpm: 60, lead: 0.4 })
        await Promise.resolve()
        await Promise.resolve()
        const downbeat = clicks[0]!.at + 4
        let doneAt: number | null = null
        let now = 0
        void count.done.then(() => (doneAt = now))
        while (doneAt === null && now < 10) {
            advance(0.025)
            now += 0.025
            await Promise.resolve()
        }
        expect(doneAt).not.toBeNull()
        expect(Math.abs(doneAt! - (downbeat - 0.4))).toBeLessThan(0.06)
    })
    it('a lead longer than the count-in ends it at once', async () => {
        const { metronome, advance } = harness()
        const count = metronome.countIn({ beats: 1, beatsPerBar: 4, bpm: 300, lead: 4 })
        let done = null as boolean | null
        void count.done.then((ok) => (done = ok))
        await Promise.resolve()
        await Promise.resolve()
        advance(0.05)
        await Promise.resolve()
        expect(done).toBe(true)
    })
    it('cancel silences the clicks still to come and ends it with false', async () => {
        const { metronome, clicks, advance } = harness()
        const count = metronome.countIn({ beats: 4, beatsPerBar: 4, bpm: 60, lead: 0 })
        await Promise.resolve()
        await Promise.resolve()
        let done = null as boolean | null
        void count.done.then((ok) => (done = ok))
        count.cancel()
        await Promise.resolve()
        expect(done).toBe(false)
        // Each click was stopped again at once (its own stop came first).
        expect(clicks).toHaveLength(4)
        for (const click of clicks) expect(click.stops.at(-1)).toBe(0)
        advance(5)
        await Promise.resolve()
        expect(done).toBe(false)
    })
    it('a cancel before the clicks are scheduled schedules none', async () => {
        const { metronome, clicks } = harness()
        const count = metronome.countIn({ beats: 4, beatsPerBar: 4, bpm: 60, lead: 0 })
        count.cancel()
        await Promise.resolve()
        await Promise.resolve()
        expect(clicks).toEqual([])
        expect(await count.done).toBe(false)
    })
})

describe('Metronome.countIn: review fixes (#75)', () => {
    it('a lead longer than the clicks starts them later, so the next beat still comes `lead` after the end', async () => {
        const { metronome, clicks } = harness()
        // 1 beat at 120 BPM lasts 0.5 s; the player needs 2 s before the beat.
        metronome.countIn({ beats: 1, beatsPerBar: 4, bpm: 120, lead: 2 })
        await Promise.resolve()
        await Promise.resolve()
        // The beat after the click (click + 0.5 s) comes 2 s after now at least.
        expect(clicks[0]!.at + 0.5).toBeGreaterThanOrEqual(2)
    })
    it('lets the audio device rest after the count-in when the metronome is not running', async () => {
        const { metronome, advance, suspends } = harness()
        const count = metronome.countIn({ beats: 2, beatsPerBar: 2, bpm: 120, lead: 0 })
        await Promise.resolve()
        await Promise.resolve()
        let done = false
        void count.done.then(() => (done = true))
        const before = suspends()
        advance(1.1)
        await Promise.resolve()
        expect(done).toBe(true)
        expect(suspends()).toBe(before)
        advance(0.3)
        expect(suspends()).toBe(before + 1)
    })
    it('ends on the timer of the window it is given (a popout player)', async () => {
        const { metronome } = harness()
        const set: number[] = []
        const popout = {
            setTimeout: (fn: () => void, ms: number) => {
                set.push(ms)
                fn()
                return 1
            },
            clearTimeout: () => {}
        }
        const count = metronome.countIn({
            beats: 1,
            beatsPerBar: 4,
            bpm: 120,
            lead: 0,
            window: fake<Window>(popout)
        })
        await Promise.resolve()
        await Promise.resolve()
        expect(await count.done).toBe(true)
        expect(set.length).toBeGreaterThan(0)
    })
})

describe('Metronome.countIn: a cancel after the end', () => {
    it('changes nothing: the next count-in still lets the device rest', async () => {
        const { metronome, advance, suspends } = harness()
        const first = metronome.countIn({ beats: 1, beatsPerBar: 4, bpm: 120, lead: 0 })
        await Promise.resolve()
        await Promise.resolve()
        advance(1)
        await Promise.resolve()
        first.cancel()
        expect(await first.done).toBe(true)
        const second = metronome.countIn({ beats: 1, beatsPerBar: 4, bpm: 120, lead: 0 })
        await Promise.resolve()
        await Promise.resolve()
        void second.done
        const before = suspends()
        advance(1.5)
        expect(suspends()).toBe(before + 1)
    })
})
