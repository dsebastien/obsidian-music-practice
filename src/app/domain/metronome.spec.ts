import { describe, expect, it } from 'bun:test'
import { beatOf, bpmFromTaps, clampBpm, tickKind, tickSeconds, trainerBpm } from './metronome'

describe('metronome', () => {
    it('accents the first click of a bar and marks subdivisions', () => {
        expect([0, 1, 2, 3, 4].map((t) => tickKind(t, 4, 1))).toEqual([
            'accent',
            'beat',
            'beat',
            'beat',
            'accent'
        ])
        expect([0, 1, 2, 3].map((t) => tickKind(t, 2, 2))).toEqual(['accent', 'sub', 'beat', 'sub'])
        expect([0, 1, 2, 3, 4, 5].map((t) => beatOf(t, 2, 3))).toEqual([0, 0, 0, 1, 1, 1])
    })

    it('times clicks by tempo and subdivision, within 20 to 300 BPM', () => {
        expect(tickSeconds(120, 1)).toBe(0.5)
        expect(tickSeconds(120, 2)).toBe(0.25)
        expect(clampBpm(5)).toBe(20)
        expect(clampBpm(500)).toBe(300)
        expect(clampBpm(Number.NaN)).toBe(20)
    })

    it('steps the speed trainer every few bars, and on demand, up to its target', () => {
        const trainer = { start: 60, step: 2, everyBars: 4, target: 66 }
        expect(trainerBpm(trainer, 3)).toBe(60)
        expect(trainerBpm(trainer, 4)).toBe(62)
        expect(trainerBpm(trainer, 4, 1)).toBe(64)
        expect(trainerBpm(trainer, 40)).toBe(66)
        expect(trainerBpm({ ...trainer, target: null }, 40)).toBe(80)
    })

    it('reads a tempo from taps, and starts over after a pause', () => {
        expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120)
        expect(bpmFromTaps([0])).toBeNull()
        expect(bpmFromTaps([0, 3000])).toBeNull()
    })

    it('never slows down toward a target below the start, and reads taps after a pause', () => {
        expect(trainerBpm({ start: 100, step: 2, everyBars: 1, target: 80 }, 3)).toBe(106)
        expect(bpmFromTaps([0, 500, 5000, 5500, 6000])).toBe(120)
    })
})
