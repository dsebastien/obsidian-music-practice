import { describe, expect, it } from 'bun:test'
import { createDefaultMetronomeSettings, type MetronomeSettings } from '../domain/metronome'
import { Metronome } from './metronome.service'

const fake = <T>(value: unknown): T => value as T

/** A window whose timers run by hand, and an audio context whose clock moves by hand. */
function harness(settings: Partial<MetronomeSettings> = {}) {
    const clicks: { at: number; frequency: number }[] = []
    let now = 0
    const timeouts = new Map<number, { at: number; run: () => void }>()
    let id = 0
    let interval: (() => void) | null = null
    class FakeContext {
        get currentTime() {
            return now
        }
        destination = {}
        resume = () => Promise.resolve()
        suspend = () => Promise.resolve()
        close = () => Promise.resolve()
        createOscillator() {
            const node = {
                frequency: { value: 0 },
                connect: (gain: unknown) => gain,
                start: (at: number) => clicks.push({ at, frequency: node.frequency.value }),
                stop: () => {}
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
    return { metronome, clicks, advance, config }
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
