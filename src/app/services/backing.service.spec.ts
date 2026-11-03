import { describe, expect, it } from 'bun:test'
import type {
    PlayProgressionOptions,
    ProgressionChanges,
    ProgressionChordInput,
    ProgressionHandle
} from '@dsebastien/music-notation'
import { BackingTrack, type BackingRequest } from './backing.service'

/** A fake playProgression: records each call, its updates and stops. */
function fakePlay() {
    const calls: {
        chords: readonly ProgressionChordInput[]
        options: PlayProgressionOptions
        updates: ProgressionChanges[]
        stopped: boolean
    }[] = []
    const play = (
        chords: readonly ProgressionChordInput[],
        options: PlayProgressionOptions = {}
    ): ProgressionHandle => {
        const call = { chords, options, updates: [] as ProgressionChanges[], stopped: false }
        calls.push(call)
        return {
            stop: () => {
                call.stopped = true
            },
            update: (changes) => {
                call.updates.push(changes)
            }
        }
    }
    return { calls, play }
}

const request = (change: Partial<BackingRequest> = {}): BackingRequest => ({
    chords: ['G', 'D', 'Em', 'C'],
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 80,
    strum: 'beats',
    click: true,
    countIn: true,
    loop: true,
    volume: 0.8,
    trainer: null,
    ...change
})

describe('BackingTrack', () => {
    it('plays the chords in time with its settings, and stops what was playing first', () => {
        const { calls, play } = fakePlay()
        let before = 0
        const track = new BackingTrack(play, () => before++)
        track.start(request())
        expect(before).toBe(1)
        expect(calls[0]!.chords).toEqual(['G', 'D', 'Em', 'C'])
        expect(calls[0]!.options).toMatchObject({
            bpm: 80,
            beatsPerBar: 4,
            beatUnit: 4,
            strum: 'beats',
            click: true,
            countIn: true,
            loop: true,
            volume: 0.8
        })
        expect(track.state.running).toBe(true)
        track.start(request({ bpm: 90 }))
        expect(calls[0]!.stopped).toBe(true)
        expect(calls[1]!.options.bpm).toBe(90)
        track.stop()
        expect(calls[1]!.stopped).toBe(true)
        expect(track.state.running).toBe(false)
        expect(track.state.bar).toBeNull()
    })

    it('passes a strumming pattern instead of a strum style', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        track.start(request({ strum: 'beats', pattern: 'D DU UDU' }))
        expect(calls[0]!.options.pattern).toBe('D DU UDU')
        expect(calls[0]!.options.strum).toBeUndefined()
    })

    it('lights the bar that sounds and tells its listeners', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        const seen: (number | null)[] = []
        track.subscribe(() => seen.push(track.state.bar))
        track.start(request())
        calls[0]!.options.onBar!(0, 'G', 1)
        calls[0]!.options.onBar!(1, 'D', 1)
        expect(track.state.bar).toBe(1)
        expect(track.state.pass).toBe(1)
        expect(seen.slice(-2)).toEqual([0, 1])
    })

    it('the speed trainer steps up every N bars played, to its target, from the next pass', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        track.start(request({ trainer: { start: 80, step: 5, everyBars: 2, target: 90 } }))
        const onBar = calls[0]!.options.onBar!
        onBar(0, 'G', 1)
        onBar(1, 'D', 1)
        expect(calls[0]!.updates).toEqual([])
        onBar(2, 'Em', 1) // two bars played
        expect(track.state.bpm).toBe(85)
        expect(calls[0]!.updates).toEqual([{ bpm: 85 }])
        onBar(3, 'C', 1)
        onBar(0, 'G', 2) // four bars
        onBar(1, 'D', 2)
        onBar(2, 'Em', 2) // six bars: capped at the target
        expect(track.state.bpm).toBe(90)
        expect(calls[0]!.updates).toEqual([{ bpm: 85 }, { bpm: 90 }])
    })

    it('a tempo set by hand applies from the next pass and restarts the trainer from there', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        track.start(request({ trainer: { start: 80, step: 5, everyBars: 2, target: null } }))
        const onBar = calls[0]!.options.onBar!
        onBar(0, 'G', 1)
        onBar(1, 'D', 1)
        track.setBpm(100)
        expect(calls[0]!.updates).toEqual([{ bpm: 100 }])
        onBar(2, 'Em', 1) // one bar since the change
        expect(track.state.bpm).toBe(100)
        onBar(3, 'C', 1)
        onBar(0, 'G', 2)
        expect(track.state.bpm).toBe(105)
        // Out of range: clamped to the library's 20–240.
        track.setBpm(400)
        expect(track.state.bpm).toBe(240)
    })

    it('turning the trainer on or off while playing starts it from the tempo now', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        track.start(request({ bpm: 70 }))
        track.setTrainer({ start: 999, step: 2, everyBars: 1, target: null })
        expect(track.state.trainer?.start).toBe(70)
        calls[0]!.options.onBar!(0, 'G', 1)
        calls[0]!.options.onBar!(1, 'D', 1)
        expect(track.state.bpm).toBe(72)
        track.setTrainer(null)
        calls[0]!.options.onBar!(2, 'Em', 1)
        expect(track.state.bpm).toBe(72)
    })

    it('changes click, volume and loop from the next pass', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        track.start(request())
        track.update({ click: false, volume: 0.5 })
        expect(calls[0]!.updates).toEqual([{ click: false, volume: 0.5 }])
    })

    it('a progression that ends (no loop) is no longer running', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        track.start(request({ loop: false }))
        calls[0]!.options.onEnd!()
        expect(track.state.running).toBe(false)
    })

    it("a chord the library can't read is an error and nothing plays", () => {
        const track = new BackingTrack(() => {
            throw new Error('Unknown chord "Xyz"')
        })
        expect(() => track.start(request())).toThrow('Unknown chord')
        expect(track.state.running).toBe(false)
    })

    it('destroy stops and forgets its listeners', () => {
        const { calls, play } = fakePlay()
        const track = new BackingTrack(play)
        let n = 0
        track.subscribe(() => n++)
        track.start(request())
        track.destroy()
        const before = n
        expect(calls[0]!.stopped).toBe(true)
        track.start(request())
        expect(n).toBe(before)
    })
})
