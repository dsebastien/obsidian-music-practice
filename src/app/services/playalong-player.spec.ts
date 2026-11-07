import { describe, expect, it } from 'bun:test'
import type { CountInRequest } from './metronome.service'
import {
    PlayAlongController,
    createPlayerState,
    type PlayerMedia,
    type PlayerState
} from './playalong-player'
import type { Section } from '../domain/playalong'

/** A media element whose clock moves by hand. */
class FakeMedia implements PlayerMedia {
    currentTime = 0
    duration = 180
    paused = true
    playbackRate = 1
    preservesPitch = false
    plays = 0
    fail: Error | null = null
    /** Plays that are still pending (hold: true): reject one as Chromium does. */
    hold = false
    pending: ((error: Error) => void)[] = []
    play(): Promise<void> {
        this.plays++
        if (this.fail) return Promise.reject(this.fail)
        if (this.hold) {
            this.paused = false
            return new Promise((_resolve, reject) => this.pending.push(reject))
        }
        this.paused = false
        return Promise.resolve()
    }
    pause(): void {
        this.paused = true
    }
    /** Plays on for `seconds` of wall time. */
    run(seconds: number): void {
        if (!this.paused) this.currentTime += seconds * this.playbackRate
    }
}

function harness(
    options: {
        state?: Partial<PlayerState>
        /** A state object to work on as it is (shared by the copies of a block). */
        shared?: PlayerState
        note?: { bpmTarget: number | null; beatsPerBar?: number }
        blockTempo?: number | null
        preRoll?: number
        countInBars?: number
        sections?: Section[]
        visible?: () => boolean
    } = {}
) {
    const media = new FakeMedia()
    const frames = new Map<number, () => void>()
    let frameId = 0
    const counts: {
        request: CountInRequest
        resolve: (ok: boolean) => void
        cancelled: boolean
    }[] = []
    const notices: string[] = []
    let plays = 0
    let changes = 0
    let now = 1000
    const note = { bpmTarget: null, beatsPerBar: 4, ...options.note }
    const tapped: number[] = []
    const controller = new PlayAlongController({
        media,
        clock: {
            frame: (cb) => {
                frames.set(++frameId, cb)
                return frameId
            },
            cancelFrame: (id) => frames.delete(id)
        },
        countIn: (request) => {
            let resolve: (ok: boolean) => void = () => {}
            const done = new Promise<boolean>((r) => (resolve = r))
            const entry = { request, resolve, cancelled: false }
            counts.push(entry)
            return {
                done,
                cancel: () => {
                    entry.cancelled = true
                    resolve(false)
                }
            }
        },
        settings: () => ({
            preRoll: options.preRoll ?? 0.2,
            countInBars: options.countInBars ?? 1
        }),
        note: () => note,
        blockTempo: options.blockTempo ?? null,
        onTapped: (bpm) => tapped.push(bpm),
        sections: options.sections ?? [],
        visible: options.visible ?? (() => true),
        state: options.shared ?? { ...createPlayerState(), ...options.state },
        onPlay: () => plays++,
        changed: () => changes++,
        notice: (message) => notices.push(message),
        now: () => now
    })
    /** Runs the frames due now (each schedules the next while playing). */
    const frame = () => {
        const due = [...frames]
        frames.clear()
        for (const [, cb] of due) cb()
    }
    const flush = async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve()
    }
    return {
        media,
        controller,
        counts,
        notices,
        frame,
        frames,
        flush,
        plays: () => plays,
        changes: () => changes,
        tick: (ms: number) => (now += ms),
        tapped
    }
}

describe('PlayAlongController: start', () => {
    it('applies the state: speed, pitch kept, position', () => {
        const { media, controller } = harness({ state: { speed: 0.75, position: 42 } })
        expect(media.playbackRate).toBe(0.75)
        expect(media.preservesPitch).toBe(true)
        expect(media.currentTime).toBe(42)
        expect(controller.status).toBe('paused')
    })
    it('plays at once without a tempo, and tells the plugin (one player at a time, the panel)', async () => {
        const { media, controller, counts, plays, flush, frames } = harness()
        controller.play()
        await flush()
        expect(counts).toHaveLength(0)
        expect(media.paused).toBe(false)
        expect(controller.status).toBe('playing')
        expect(plays()).toBe(1)
        expect(frames.size).toBe(1)
    })
    it('says once that the count-in needs a tempo', async () => {
        const { controller, notices, flush } = harness()
        controller.play()
        await flush()
        controller.pause()
        controller.play()
        await flush()
        expect(notices).toEqual(['Count-in: tap the tempo first (T, or the Tap button).'])
    })
    it('a refused play (a file the device cannot play) goes back to paused with a notice', async () => {
        const { media, controller, notices, flush } = harness()
        media.fail = new Error('NotSupportedError')
        controller.play()
        await flush()
        expect(controller.status).toBe('paused')
        expect(notices.at(-1)).toBe("Couldn't play the recording: NotSupportedError")
    })
})

describe('PlayAlongController: count-in', () => {
    it('counts in at the tempo, the recording reaching the start on the beat after the clicks', async () => {
        const { media, controller, counts, flush } = harness({
            note: { bpmTarget: 120, beatsPerBar: 3 },
            state: { position: 10 },
            countInBars: 2
        })
        controller.play()
        expect(controller.status).toBe('counting')
        expect(media.paused).toBe(true)
        expect(media.currentTime).toBeCloseTo(9.8)
        expect(counts[0]!.request).toEqual({ beats: 6, beatsPerBar: 3, bpm: 120, lead: 0.2 })
        counts[0]!.resolve(true)
        await flush()
        expect(media.paused).toBe(false)
        expect(controller.status).toBe('playing')
    })
    it('scales the click tempo and the lead with the speed', () => {
        const { controller, counts } = harness({
            note: { bpmTarget: 120 },
            state: { position: 10, speed: 0.5 }
        })
        controller.play()
        expect(counts[0]!.request.bpm).toBe(60)
        expect(counts[0]!.request.lead).toBeCloseTo(0.4)
    })
    it('starts at 0 without a pre-roll before the start, the lead shortened to match', () => {
        const { media, controller, counts } = harness({
            note: { bpmTarget: 90 },
            state: { position: 0.1 }
        })
        controller.play()
        expect(media.currentTime).toBe(0)
        expect(counts[0]!.request.lead).toBeCloseTo(0.1)
    })
    it('plays no count-in when it is off', async () => {
        const { media, controller, counts, flush } = harness({
            note: { bpmTarget: 90 },
            state: { countIn: false }
        })
        controller.play()
        await flush()
        expect(counts).toHaveLength(0)
        expect(media.paused).toBe(false)
    })
    it('pause cancels a count-in, and its late end does nothing', async () => {
        const { media, controller, counts, flush } = harness({
            note: { bpmTarget: 90 }
        })
        controller.play()
        controller.pause()
        expect(counts[0]!.cancelled).toBe(true)
        expect(controller.status).toBe('paused')
        counts[0]!.resolve(true)
        await flush()
        expect(media.paused).toBe(true)
    })
    it('a seek during the count-in counts in again from there', () => {
        const { media, controller, counts } = harness({
            note: { bpmTarget: 90 }
        })
        controller.play()
        controller.seek(60)
        expect(counts[0]!.cancelled).toBe(true)
        expect(counts).toHaveLength(2)
        expect(media.currentTime).toBeCloseTo(59.8)
        expect(controller.status).toBe('counting')
    })
})

describe('PlayAlongController: A-B loop', () => {
    const looping = { a: 10, b: 20, loop: true }
    it('wraps at B to A minus the pre-roll, read on each frame', async () => {
        const { media, controller, frame, flush } = harness({
            state: { ...looping, countIn: false, position: 19 }
        })
        controller.play()
        await flush()
        media.run(0.9)
        frame()
        expect(media.currentTime).toBeCloseTo(19.9)
        media.run(0.2)
        frame()
        expect(media.currentTime).toBeCloseTo(9.8)
        await flush()
        expect(media.paused).toBe(false)
        expect(controller.status).toBe('playing')
    })
    it('counts in before every pass', async () => {
        const { media, controller, counts, frame, flush } = harness({
            note: { bpmTarget: 100 },
            state: { ...looping, position: 12 }
        })
        controller.play()
        counts[0]!.resolve(true)
        await flush()
        media.currentTime = 20
        frame()
        expect(media.paused).toBe(true)
        expect(media.currentTime).toBeCloseTo(9.8)
        expect(controller.status).toBe('counting')
        expect(counts).toHaveLength(2)
        counts[1]!.resolve(true)
        await flush()
        expect(media.paused).toBe(false)
    })
    it('Play past B starts at A; Play before A plays on into the loop', () => {
        const past = harness({ state: { ...looping, countIn: false, position: 50 } })
        past.controller.play()
        expect(past.media.currentTime).toBeCloseTo(9.8)
        const before = harness({ state: { ...looping, countIn: false, position: 2 } })
        before.controller.play()
        expect(before.media.currentTime).toBe(2)
    })
    it('a seek past B wraps on the next frame: the loop holds', async () => {
        const { media, controller, frame, flush } = harness({
            state: { ...looping, countIn: false, position: 12 }
        })
        controller.play()
        await flush()
        controller.seek(100)
        frame()
        expect(media.currentTime).toBeCloseTo(9.8)
    })
    it('keeps the loop through a speed change', async () => {
        const { media, controller, frame, flush } = harness({
            state: { ...looping, countIn: false, position: 12 }
        })
        controller.play()
        await flush()
        controller.slower()
        controller.slower()
        expect(media.playbackRate).toBe(0.9)
        expect(controller.state.speed).toBe(0.9)
        media.currentTime = 20.05
        frame()
        expect(media.currentTime).toBeCloseTo(9.8)
    })
    it('wraps when the recording ends inside the loop; stops without one', async () => {
        const loop = harness({ state: { a: 170, b: 180, loop: true, countIn: false } })
        loop.controller.play()
        await loop.flush()
        loop.media.paused = true
        loop.controller.ended()
        expect(loop.media.currentTime).toBeCloseTo(169.8)
        await loop.flush()
        expect(loop.media.paused).toBe(false)
        const plain = harness({ state: { countIn: false } })
        plain.controller.play()
        await plain.flush()
        plain.media.paused = true
        plain.controller.ended()
        expect(plain.controller.status).toBe('paused')
    })
    it('does not wrap with the loop off', async () => {
        const { media, controller, frame, flush } = harness({
            state: { a: 10, b: 20, loop: false, countIn: false, position: 19.9 }
        })
        controller.play()
        await flush()
        media.run(1)
        frame()
        expect(media.currentTime).toBeCloseTo(20.9)
    })
    it('sets A and B at the playhead; B turns the loop on', () => {
        const { controller } = harness()
        controller.seek(10)
        controller.setA()
        controller.seek(22.5)
        controller.setB()
        expect(controller.state).toMatchObject({ a: 10, b: 22.5, loop: true })
    })
    it('refuses a loop too short, with a notice', () => {
        const { controller, notices } = harness({ state: { a: 10 } })
        controller.seek(10.2)
        controller.setB()
        expect(controller.state.b).toBeNull()
        expect(notices).toEqual(['A and B must be at least half a second apart.'])
    })
    it('Clear removes the marks and the loop; Loop needs both marks', () => {
        const { controller, notices } = harness({ state: looping })
        controller.clearLoop()
        expect(controller.state).toMatchObject({ a: null, b: null, loop: false })
        controller.toggleLoop()
        expect(controller.state.loop).toBe(false)
        expect(notices).toEqual(['Set A and B first ([ and ]).'])
    })
    it('Loop turns an existing loop off and on again', () => {
        const { controller } = harness({ state: looping })
        controller.toggleLoop()
        expect(controller.state.loop).toBe(false)
        controller.toggleLoop()
        expect(controller.state.loop).toBe(true)
    })
})

describe('PlayAlongController: sections', () => {
    const sections: Section[] = [
        { time: 0, name: 'Intro', line: 1 },
        { time: 12, name: 'Verse', line: 2 },
        { time: 45, name: 'Chorus', line: 3 }
    ]
    it('jumps to a section', () => {
        const { media, controller } = harness({ sections })
        controller.jump(2)
        expect(media.currentTime).toBe(45)
    })
    it('loops a section, from the pre-roll before it', () => {
        const { media, controller } = harness({ sections })
        controller.loopSection(1)
        expect(controller.state).toMatchObject({ a: 12, b: 45, loop: true })
        expect(media.currentTime).toBeCloseTo(11.8)
    })
    it('looping a section while playing counts in a new pass', async () => {
        const { controller, counts, flush } = harness({
            sections,
            note: { bpmTarget: 80 },
            state: { countIn: true }
        })
        controller.play()
        counts[0]!.resolve(true)
        await flush()
        controller.loopSection(1)
        expect(controller.status).toBe('counting')
        expect(counts).toHaveLength(2)
    })
})

describe('PlayAlongController: tempo, tap and Save BPM', () => {
    it('takes the tapped tempo, divided by the speed, when the note has none', () => {
        const { controller, tick } = harness({ state: { speed: 0.5 } })
        controller.tap()
        tick(500)
        controller.tap()
        tick(500)
        controller.tap()
        expect(controller.tempo()).toEqual({ bpm: 240, source: 'tapped' })
        expect(controller.state.tapped).toBe(240)
        expect(controller.playedBpm()).toBe(120)
    })
    it("takes the block's tempo line, then a tapped tempo, then the note's target BPM", () => {
        const block = harness({ blockTempo: 120, note: { bpmTarget: 96 }, state: { tapped: 80 } })
        expect(block.controller.tempo()).toEqual({ bpm: 120, source: 'block' })
        const tap = harness({ note: { bpmTarget: 96 }, state: { tapped: 80, speed: 0.8 } })
        expect(tap.controller.tempo()).toEqual({ bpm: 80, source: 'tapped' })
        expect(tap.controller.playedBpm()).toBe(64)
        const target = harness({ note: { bpmTarget: 96 }, state: { speed: 0.75 } })
        expect(target.controller.tempo()).toEqual({ bpm: 96, source: 'target' })
        expect(target.controller.playedBpm()).toBe(72)
    })
    it('reports each tempo tapped (the service writes it as the tempo line)', () => {
        const { controller, tick, tapped } = harness()
        controller.tap()
        expect(tapped).toEqual([])
        tick(600)
        controller.tap()
        expect(tapped).toEqual([100])
    })
    it('has no BPM to save without a tempo', () => {
        expect(harness().controller.playedBpm()).toBeNull()
    })
})

describe('PlayAlongController: lifecycle', () => {
    it('free pauses, cancels the count-in and the frames, and makes every call a no-op', async () => {
        const { media, controller, counts, frames, flush } = harness({
            note: { bpmTarget: 90 }
        })
        controller.play()
        controller.free()
        expect(counts[0]!.cancelled).toBe(true)
        expect(media.paused).toBe(true)
        expect(frames.size).toBe(0)
        controller.play()
        controller.seek(30)
        await flush()
        expect(counts).toHaveLength(1)
        expect(media.currentTime).not.toBe(30)
        expect(controller.status).toBe('paused')
    })
    it('a frame while paused does nothing and is not scheduled again', async () => {
        const { controller, frame, frames, flush } = harness({ state: { countIn: false } })
        controller.play()
        await flush()
        controller.pause()
        frame()
        expect(frames.size).toBe(0)
    })
    it('nudges stay inside the recording', () => {
        const { media, controller } = harness({ state: { position: 3 } })
        controller.nudge(-5)
        expect(media.currentTime).toBe(0)
        controller.nudge(500)
        expect(media.currentTime).toBe(180)
    })
    it('follows a pause from outside (the media element paused by the system)', async () => {
        const { media, controller, frame, flush } = harness({ state: { countIn: false } })
        controller.play()
        await flush()
        media.paused = true
        frame()
        expect(controller.status).toBe('paused')
    })
})

describe('PlayAlongController: timeupdate', () => {
    it('wraps from a timeupdate when frames do not run (a hidden window), without a second frame loop', async () => {
        const { media, controller, frames, flush } = harness({
            state: { a: 10, b: 20, loop: true, countIn: false, position: 19 }
        })
        controller.play()
        await flush()
        expect(frames.size).toBe(1)
        media.currentTime = 20.3
        expect(controller.check()).toBe(false)
        expect(media.currentTime).toBeCloseTo(9.8)
        await flush()
        expect(frames.size).toBe(1)
        media.currentTime = 12
        expect(controller.check()).toBe(true)
        expect(frames.size).toBe(1)
    })
})

describe('PlayAlongController: shared state (#75)', () => {
    it('works on the state it is given, not a copy, and records the playhead in it', async () => {
        const state = { ...createPlayerState(), countIn: false }
        const { media, controller, flush } = harness({ shared: state })
        expect(controller.state).toBe(state)
        controller.seek(30)
        expect(state.position).toBe(30)
        controller.play()
        await flush()
        media.run(2)
        controller.pause()
        expect(state.position).toBe(32)
    })
})

describe('PlayAlongController: review fixes', () => {
    const looping = { a: 10, b: 20, loop: true }
    it('Play from the pre-roll before A (a section loop set while paused) counts in to A', () => {
        const { media, controller, counts } = harness({
            note: { bpmTarget: 120 },
            state: { ...looping, position: 9.8 }
        })
        controller.play()
        expect(media.currentTime).toBeCloseTo(9.8)
        expect(counts[0]!.request.lead).toBeCloseTo(0.2)
    })
    it('a pause during a count-in keeps the start, so Play again counts in to the same beat', () => {
        const { media, controller, counts } = harness({
            note: { bpmTarget: 120 },
            state: { position: 30 }
        })
        controller.play()
        controller.pause()
        expect(controller.state.position).toBe(30)
        expect(media.currentTime).toBe(30)
        controller.play()
        controller.pause()
        controller.play()
        expect(counts.at(-1)!.request.lead).toBeCloseTo(0.2)
        expect(media.currentTime).toBeCloseTo(29.8)
    })
    it('ignores a play() interrupted by a pause (AbortError), with no notice', async () => {
        const { media, controller, notices, flush } = harness({ state: { countIn: false } })
        media.hold = true
        controller.play()
        controller.pause()
        const abort = new Error('The play() request was interrupted by a call to pause().')
        abort.name = 'AbortError'
        media.pending[0]!(abort)
        await flush()
        expect(notices).toEqual([])
        expect(controller.status).toBe('paused')
    })
    it('a stale rejection after a new pass leaves the player playing', async () => {
        const sections: Section[] = [
            { time: 0, name: 'Intro', line: 1 },
            { time: 12, name: 'Verse', line: 2 }
        ]
        const { media, controller, notices, flush, frames } = harness({
            sections,
            state: { countIn: false }
        })
        media.hold = true
        controller.play()
        controller.loopSection(0)
        media.pending[0]!(new Error('NotAllowedError'))
        await flush()
        expect(controller.status).toBe('playing')
        expect(frames.size).toBe(1)
        expect(notices).toEqual([])
    })
    it('a seek past B during a count-in counts in once, from A', () => {
        const { media, controller, counts } = harness({
            note: { bpmTarget: 120 },
            state: { ...looping, position: 12 }
        })
        controller.play()
        controller.seek(25)
        expect(counts).toHaveLength(2)
        expect(media.currentTime).toBeCloseTo(9.8)
        expect(counts[1]!.request.lead).toBeCloseTo(0.2)
    })
    it('ignores ended while paused or counting', () => {
        const paused = harness({ state: { ...looping, countIn: false } })
        paused.controller.ended()
        expect(paused.controller.status).toBe('paused')
        expect(paused.media.paused).toBe(true)
        const counting = harness({ note: { bpmTarget: 120 }, state: looping })
        counting.controller.play()
        counting.controller.ended()
        expect(counting.controller.status).toBe('counting')
        expect(counting.counts).toHaveLength(1)
        expect(counting.counts[0]!.cancelled).toBe(false)
    })
    it('a copy that becomes hidden (another view of the note) pauses', async () => {
        let shown = true
        const { controller, flush, frame } = harness({
            state: { countIn: false },
            visible: () => shown
        })
        controller.play()
        await flush()
        shown = false
        frame()
        expect(controller.status).toBe('paused')
    })
    it('a paused copy shows the shared playhead', () => {
        const state = { ...createPlayerState(), position: 0 }
        const { media, controller } = harness({ shared: state })
        state.position = 77
        expect(media.currentTime).toBe(0)
        expect(controller.position()).toBe(77)
    })
})
