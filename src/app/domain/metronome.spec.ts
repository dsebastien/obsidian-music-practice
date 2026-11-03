import { describe, expect, it } from 'bun:test'
import {
    beatOf,
    bpmFromTaps,
    clampBpm,
    countInBeats,
    createDefaultMetronomeSettings,
    drillCountIn,
    meterLabel,
    meterOf,
    tickKind,
    tickSeconds,
    trainerBpm
} from './metronome'

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

describe('time signatures (#77)', () => {
    it('counts simple meters as their beats and keeps the clicks', () => {
        expect(meterOf('3/4')).toEqual({ beatsPerBar: 3, subdivision: null })
        expect(meterOf(' 4 / 4 ')).toEqual({ beatsPerBar: 4, subdivision: null })
        expect(meterOf('2/2')).toEqual({ beatsPerBar: 2, subdivision: null })
        expect(meterOf('5/4')).toEqual({ beatsPerBar: 5, subdivision: null })
        expect(meterOf('7/8')).toEqual({ beatsPerBar: 7, subdivision: null })
        expect(meterOf('3/8')).toEqual({ beatsPerBar: 3, subdivision: null })
        expect(meterOf('C')).toEqual({ beatsPerBar: 4, subdivision: null })
        expect(meterOf('¢')).toEqual({ beatsPerBar: 2, subdivision: null })
    })

    it('counts compound meters in dotted beats of three clicks', () => {
        expect(meterOf('6/8')).toEqual({ beatsPerBar: 2, subdivision: 3 })
        expect(meterOf('9/8')).toEqual({ beatsPerBar: 3, subdivision: 3 })
        expect(meterOf('12/8')).toEqual({ beatsPerBar: 4, subdivision: 3 })
        expect(meterOf('6/16')).toEqual({ beatsPerBar: 2, subdivision: 3 })
        expect(meterLabel('6/8', meterOf('6/8')!)).toBe('6/8 (2 beats)')
        expect(meterLabel(' 3/4', meterOf('3/4')!)).toBe('3/4')
    })

    it('ignores what the metronome cannot count', () => {
        for (const value of [
            '',
            'waltz',
            '1/4',
            '13/4',
            '4/3',
            '4/5',
            '3/4/4',
            null,
            undefined,
            {},
            34
        ])
            expect(meterOf(value)).toBeNull()
    })
})

describe('count-in (#77)', () => {
    it('clicks every beat of the count-in bars, at most 4 bars', () => {
        expect(countInBeats(1, 4)).toBe(4)
        expect(countInBeats(2, 3)).toBe(6)
        expect(countInBeats(0, 4)).toBe(0)
        expect(countInBeats(9, 2)).toBe(8)
        expect(countInBeats(-1, 4)).toBe(0)
    })

    it('counts a drill in with 3, 2, 1 when the metronome counts in', () => {
        expect(drillCountIn(1)).toBe(3)
        expect(drillCountIn(0)).toBe(0)
    })

    it('counts in one bar and does not flash by default', () => {
        expect(createDefaultMetronomeSettings()).toMatchObject({ countInBars: 1, flash: false })
    })
})
