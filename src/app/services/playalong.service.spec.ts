import { describe, expect, it } from 'bun:test'
import type { MarkdownPostProcessorContext } from 'obsidian'
import {
    PlayAlongBlocks,
    type BlockWrite,
    type MountRequest,
    type PlayAlongDeps,
    type PlayAlongView
} from './playalong.service'
import type { PlayerMedia, PlayAlongController } from './playalong-player'
import type { CountInRequest } from './metronome.service'

const fake = <T>(value: unknown): T => value as T

class FakeMedia implements PlayerMedia {
    currentTime = 0
    duration = 180
    paused = true
    playbackRate = 1
    preservesPitch = false
    play(): Promise<void> {
        this.paused = false
        return Promise.resolve()
    }
    pause(): void {
        this.paused = true
    }
}

interface FakeView extends PlayAlongView {
    request: MountRequest
    media: FakeMedia
    controller: PlayAlongController | null
    destroyed: boolean
    refreshes: number
    forced: number
    shown: boolean
    focused: boolean
}

type Processor = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void

function harness(overrides: Partial<PlayAlongDeps> = {}) {
    const processors = new Map<string, Processor>()
    const views: FakeView[] = []
    const messages: { message: string; source: string }[] = []
    const notices: string[] = []
    const panel: string[] = []
    const saved: { path: string; bpm: number }[] = []
    const writes: { request: BlockWrite; result: string }[] = []
    let stops = 0
    let enabled = true
    let open = new Set<string>(['Songs/Wonderwall.md'])
    let now = 0
    let names: (string | null)[] = []
    let writeOk = true
    const blockBody = { text: '' }
    const hosts = new Map<HTMLElement, string>()
    /** The next mounted views drawn hidden (a live preview copy behind reading view). */
    let hidden = 0
    const timers = new Map<number, { at: number; fn: () => void }>()
    let timerId = 0
    /** Moves the clock on and runs the timers due. */
    const advance = (ms: number) => {
        now += ms
        for (const [id, t] of [...timers])
            if (t.at <= now) {
                timers.delete(id)
                t.fn()
            }
    }
    const deps: PlayAlongDeps = {
        enabled: () => enabled,
        exists: () => false,
        resolve: (link) =>
            link.startsWith('missing') ? null : { path: `Media/${link}`, url: `app://x/${link}` },
        note: () => ({ bpmTarget: 100, beatsPerBar: 4 }),
        settings: () => ({ preRoll: 0.2, countInBars: 1 }),
        countIn: (_request: CountInRequest) => ({ done: Promise.resolve(true), cancel: () => {} }),
        isLearningNote: (path) => path === 'Songs/Wonderwall.md',
        addToPanel: (path) => panel.push(path),
        stopOthers: () => stops++,
        saveBpm: (path, bpm) => saved.push({ path, bpm }),
        writeBlock: (request, change) => {
            const result = change(blockBody.text)
            writes.push({ request, result })
            return Promise.resolve(writeOk)
        },
        askName: () => Promise.resolve(names.shift() ?? null),
        notice: (message) => notices.push(message),
        showMessage: (_el, message, source) => messages.push({ message, source }),
        mount: (request) => {
            const view: FakeView = {
                request,
                shown: hidden-- <= 0,
                media: new FakeMedia(),
                clock: { frame: () => 1, cancelFrame: () => {} },
                window: null,
                controller: null,
                destroyed: false,
                bind(controller) {
                    view.controller = controller
                },
                refreshes: 0,
                focused: false,
                forced: 0,
                refresh(force?: boolean) {
                    view.refreshes++
                    if (force) view.forced++
                },
                visible: () => view.shown,
                hidden: () => false,
                hasFocus: () => view.focused,
                focus() {
                    view.focused = true
                },
                destroy() {
                    view.destroyed = true
                }
            }
            views.push(view)
            return view
        },
        openNotes: () => open,
        hostOf: (el) => hosts.get(el) ?? null,
        now: () => now,
        timer: {
            set: (fn, ms) => {
                timers.set(++timerId, { at: now + ms, fn })
                return timerId
            },
            clear: (id) => timers.delete(id)
        },
        ...overrides
    }
    const blocks = new PlayAlongBlocks(
        {
            registerMarkdownCodeBlockProcessor: (language: string, processor: Processor) => {
                processors.set(language, processor)
                return fake({})
            }
        },
        deps
    )
    /** Draws a block as Obsidian does; returns its element and its render child. */
    const draw = (source: string, sourcePath = 'Songs/Wonderwall.md') => {
        const el = fake<HTMLElement & { isConnected: boolean }>({ isConnected: true })
        const children: { unload: () => void }[] = []
        const ctx = fake<MarkdownPostProcessorContext>({
            sourcePath,
            addChild: (child: { load: () => void; unload: () => void }) => {
                children.push(child)
                child.load()
            },
            getSectionInfo: () => ({ lineStart: 3, lineEnd: 7, text: '' })
        })
        processors.get('playalong')!(source, el, ctx)
        return { el, child: children[0] ?? null, view: views.at(-1) ?? null }
    }
    const flush = async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve()
    }
    return {
        blocks,
        processors,
        views,
        messages,
        notices,
        panel,
        saved,
        writes,
        draw,
        flush,
        blockBody,
        stops: () => stops,
        setEnabled: (on: boolean) => (enabled = on),
        setOpen: (paths: string[]) => (open = new Set(paths)),
        setNow: (ms: number) => (now = ms),
        advance,
        timers,
        hosts,
        hideNext: (n: number) => (hidden = n),
        setNames: (list: (string | null)[]) => (names = list),
        setWriteOk: (ok: boolean) => (writeOk = ok)
    }
}

const SOURCE = 'file: [[take.mp3]]\n0:00 Intro\n0:12 Verse\n'

describe('PlayAlongBlocks: registration', () => {
    it('registers ```playalong when it is on and no other plugin has it', () => {
        const h = harness()
        h.blocks.sync()
        expect([...h.processors.keys()]).toEqual(['playalong'])
        expect(h.blocks.status()).toBe('on')
        h.blocks.sync()
        expect(h.processors.size).toBe(1)
    })
    it('leaves it to another plugin that has it', () => {
        const h = harness({ exists: () => true })
        h.blocks.sync()
        expect(h.processors.size).toBe(0)
        expect(h.blocks.status()).toBe('taken')
    })
    it('does not register while it is off; turned off later, a block shows as code', () => {
        const h = harness()
        h.setEnabled(false)
        h.blocks.sync()
        expect(h.processors.size).toBe(0)
        expect(h.blocks.status()).toBe('off')
        h.setEnabled(true)
        h.blocks.sync()
        h.setEnabled(false)
        const { view } = h.draw(SOURCE)
        expect(view).toBeNull()
        expect(h.messages).toEqual([{ message: '', source: SOURCE }])
    })
})

describe('PlayAlongBlocks: the block', () => {
    it('mounts a player for the recording with its sections and problems', () => {
        const h = harness()
        h.blocks.sync()
        const { view } = h.draw('file: [[take.mp3]]\n0:12 Verse\nnonsense')
        expect(view?.request).toMatchObject({
            kind: 'audio',
            url: 'app://x/take.mp3',
            name: 'take.mp3'
        })
        expect(view?.request.learning()).toBe(true)
        expect(view?.request.block.sections.map((s) => s.name)).toEqual(['Verse'])
        expect(view?.request.block.problems).toEqual(['Line 3 is not a section: write 0:12 Verse'])
        expect(view?.controller?.state.speed).toBe(1)
    })
    it('a video file mounts a video player', () => {
        const h = harness()
        h.blocks.sync()
        expect(h.draw('![[clip.mp4]]').view?.request.kind).toBe('video')
    })
    it('says what is missing instead of a player', () => {
        const h = harness()
        h.blocks.sync()
        h.draw('0:12 Verse')
        h.draw('file: [[missing.mp3]]')
        h.draw('file: [[notes.pdf]]')
        expect(h.views).toHaveLength(0)
        expect(h.messages.map((m) => m.message)).toEqual([
            'playalong: name the recording on a line of its own, for example file: [[Song.mp3]]',
            'playalong: no file "missing.mp3" in the vault',
            'playalong: "Media/notes.pdf" is not an audio or video file'
        ])
    })
    it('offers no Save BPM outside a learning note, read at each refresh (a note can become one)', () => {
        const h = harness()
        h.blocks.sync()
        expect(h.draw(SOURCE, 'Inbox/Other.md').view?.request.learning()).toBe(false)
    })
})

describe('PlayAlongBlocks: playing', () => {
    it('Play pauses the other players, stops the metronome and the backing loop, and lists the note', async () => {
        const h = harness()
        h.blocks.sync()
        const first = h.draw(SOURCE).view!
        const second = h.draw('file: [[other.mp3]]').view!
        first.controller!.state.countIn = false
        second.controller!.state.countIn = false
        first.controller!.play()
        await h.flush()
        expect(first.media.paused).toBe(false)
        second.controller!.play()
        await h.flush()
        expect(first.media.paused).toBe(true)
        expect(first.controller!.status).toBe('paused')
        expect(second.media.paused).toBe(false)
        expect(h.stops()).toBe(2)
        expect(h.panel).toEqual(['Songs/Wonderwall.md', 'Songs/Wonderwall.md'])
    })
    it('does not list a note that is not a learning note', async () => {
        const h = harness()
        h.blocks.sync()
        const view = h.draw(SOURCE, 'Inbox/Other.md').view!
        view.controller!.play()
        await h.flush()
        expect(h.panel).toEqual([])
    })
    it('pauseAll pauses every player (the metronome or the backing loop started)', async () => {
        const h = harness()
        h.blocks.sync()
        const view = h.draw(SOURCE).view!
        view.controller!.state.countIn = false
        view.controller!.play()
        await h.flush()
        h.blocks.pauseAll()
        expect(view.controller!.status).toBe('paused')
    })
    it('Save BPM offers the tempo it plays at; without a tempo, a notice', () => {
        const h = harness()
        h.blocks.sync()
        const view = h.draw(SOURCE).view!
        view.controller!.setSpeed(0.75)
        view.request.actions.saveBpm()
        expect(h.saved).toEqual([{ path: 'Songs/Wonderwall.md', bpm: 75 }])
        const none = harness({
            note: () => ({ bpmTarget: null, beatsPerBar: 4 })
        })
        none.blocks.sync()
        none.draw(SOURCE).view!.request.actions.saveBpm()
        expect(none.saved).toEqual([])
        expect(none.notices).toEqual(['Tap the tempo first: Save BPM needs it.'])
    })
})

describe('PlayAlongBlocks: lifecycle', () => {
    it('frees the player when Obsidian unloads the block (a redraw, the note closed)', async () => {
        const h = harness()
        h.blocks.sync()
        const { child, view } = h.draw(SOURCE)
        view!.controller!.state.countIn = false
        view!.controller!.play()
        await h.flush()
        child!.unload()
        expect(view!.media.paused).toBe(true)
        expect(view!.destroyed).toBe(true)
        expect(view!.controller!.isFreed).toBe(true)
        expect(h.blocks.liveCount()).toBe(0)
    })
    it('a block drawn again starts from the state its note and file had', () => {
        const h = harness()
        h.blocks.sync()
        const first = h.draw(SOURCE)
        first.view!.controller!.setSpeed(0.7)
        first.view!.controller!.seek(33)
        first.view!.controller!.setA()
        first.child!.unload()
        const again = h.draw(SOURCE).view!
        expect(again.controller!.state).toMatchObject({ speed: 0.7, a: 33, position: 33 })
        expect(again.media.currentTime).toBe(33)
        // Another file in the same note starts fresh.
        expect(h.draw('file: [[other.mp3]]').view!.controller!.state.speed).toBe(1)
    })
    it('frees, on a layout change, a player whose note no tab shows any more', () => {
        const h = harness()
        h.blocks.sync()
        const kept = h.draw(SOURCE)
        const embedded = h.draw(SOURCE, 'Songs/Embedded.md')
        const closed = h.draw('file: [[other.mp3]]', 'Songs/Closed.md')
        kept.el.isConnected = false
        closed.el.isConnected = false
        h.setOpen(['Songs/Wonderwall.md'])
        h.blocks.prune()
        // Off screen in an open note (reading view): kept. Shown in an embed: kept.
        expect(kept.view!.destroyed).toBe(false)
        expect(embedded.view!.destroyed).toBe(false)
        expect(closed.view!.destroyed).toBe(true)
        expect(h.blocks.liveCount()).toBe(2)
    })
    it('frees the players of a window that closes', () => {
        const h = harness()
        h.blocks.sync()
        const popout = fake<Window>({})
        const view = h.draw(SOURCE).view!
        view.window = popout
        const other = h.draw('file: [[other.mp3]]').view!
        h.blocks.windowClosed(popout)
        expect(view.destroyed).toBe(true)
        expect(other.destroyed).toBe(false)
    })
    it('frees every player and forgets the states when the plugin unloads', () => {
        const h = harness()
        h.blocks.sync()
        const first = h.draw(SOURCE)
        first.view!.controller!.setSpeed(0.6)
        const second = h.draw('file: [[other.mp3]]').view!
        h.blocks.unload()
        expect(first.view!.destroyed).toBe(true)
        expect(second.destroyed).toBe(true)
        expect(h.blocks.liveCount()).toBe(0)
        first.child!.unload()
        expect(h.draw(SOURCE).view!.controller!.state.speed).toBe(1)
    })
    it('a renamed note keeps its players and their states', () => {
        const h = harness()
        h.blocks.sync()
        const first = h.draw(SOURCE)
        first.view!.controller!.setSpeed(0.6)
        h.blocks.renamed('Songs/Wonderwall.md', 'Songs/Wonderwall (live).md')
        first.child!.unload()
        expect(h.draw(SOURCE, 'Songs/Wonderwall (live).md').view!.controller!.state.speed).toBe(0.6)
    })
})

describe('PlayAlongBlocks: Add section', () => {
    it('asks for a name and writes the section line into the block, in time order', async () => {
        const h = harness()
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const { view, el } = h.draw(SOURCE)
        view!.controller!.seek(30.04)
        h.setNames(['Chorus'])
        await view!.request.actions.addSection()
        expect(h.writes).toHaveLength(1)
        expect(h.writes[0]!.request.source).toBe(SOURCE)
        expect(h.writes[0]!.request.el).toBe(el)
        expect(h.writes[0]!.request.section()).toMatchObject({ lineStart: 3, lineEnd: 7 })
        expect(h.writes[0]!.result).toBe(
            'file: [[take.mp3]]\n0:00 Intro\n0:12 Verse\n0:30 Chorus\n'
        )
    })
    it('proposes the next section number, and writes nothing when the name is cancelled', async () => {
        let proposed = ''
        const h = harness({
            askName: (name) => {
                proposed = name
                return Promise.resolve(null)
            }
        })
        h.blocks.sync()
        await h.draw(SOURCE).view!.request.actions.addSection()
        expect(proposed).toBe('Section 3')
        expect(h.writes).toEqual([])
    })
    it('plays on after the redraw its own write caused, within 5 s, without a count-in', async () => {
        const counts: CountInRequest[] = []
        const h = harness({
            countIn: (request) => {
                counts.push(request)
                return { done: Promise.resolve(true), cancel: () => {} }
            }
        })
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const first = h.draw(SOURCE)
        first.view!.controller!.state.countIn = false
        first.view!.controller!.play()
        await h.flush()
        first.view!.media.currentTime = 30
        h.setNames(['Chorus'])
        await first.view!.request.actions.addSection()
        first.child!.unload()
        const again = h.draw(h.writes[0]!.result).view!
        again.controller!.state.countIn = true
        await h.flush()
        expect(again.controller!.status).toBe('playing')
        expect(again.media.paused).toBe(false)
        expect(counts).toEqual([])
        // Later redraws don't play on their own: the write's mark is used once.
        const later = h.draw(h.writes[0]!.result).view!
        await h.flush()
        expect(later.controller!.status).toBe('paused')
    })
    it('does not play on after 5 s, or when the player was paused', async () => {
        const h = harness()
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const first = h.draw(SOURCE)
        first.view!.controller!.state.countIn = false
        first.view!.controller!.play()
        await h.flush()
        h.setNames(['Chorus'])
        await first.view!.request.actions.addSection()
        first.child!.unload()
        h.setNow(5001)
        const late = h.draw(h.writes[0]!.result).view!
        await h.flush()
        expect(late.controller!.status).toBe('paused')
    })
    it('says so when the block could not be found', async () => {
        const h = harness()
        h.blocks.sync()
        h.setWriteOk(false)
        h.setNames(['Chorus'])
        await h.draw(SOURCE).view!.request.actions.addSection()
        expect(h.notices).toEqual([
            "Couldn't find this block in the note: it may have changed. Try again."
        ])
    })
})

describe('PlayAlongBlocks: copies of one block (#75)', () => {
    it('share their marks, speed, loop, count-in and tempo (reading view and its hidden live preview copy)', () => {
        const h = harness()
        h.blocks.sync()
        const reading = h.draw(SOURCE).view!
        const preview = h.draw(SOURCE).view!
        reading.controller!.seek(10)
        reading.controller!.setA()
        reading.controller!.seek(20)
        reading.controller!.setB()
        reading.controller!.slower()
        expect(preview.controller!.state).toMatchObject({ a: 10, b: 20, loop: true, speed: 0.95 })
    })
    it('a copy starts playing where the other one stopped, at the shared speed', async () => {
        const h = harness()
        h.blocks.sync()
        const reading = h.draw(SOURCE).view!
        const preview = h.draw(SOURCE).view!
        reading.controller!.state.countIn = false
        reading.controller!.seek(42)
        reading.controller!.setSpeed(0.8)
        preview.controller!.play()
        await h.flush()
        expect(preview.media.currentTime).toBe(42)
        expect(preview.media.playbackRate).toBe(0.8)
    })
})

describe('PlayAlongBlocks: a tapped tempo (#75)', () => {
    it('is written as the tempo line once the taps stop for 2 s', async () => {
        const h = harness({ note: () => ({ bpmTarget: null, beatsPerBar: 4 }) })
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const view = h.draw(SOURCE).view!
        view.controller!.tap()
        h.advance(500)
        view.controller!.tap()
        h.advance(500)
        view.controller!.tap()
        h.advance(1999)
        expect(h.writes).toEqual([])
        h.advance(1)
        await h.flush()
        expect(h.writes).toHaveLength(1)
        expect(h.writes[0]!.result).toBe('file: [[take.mp3]]\ntempo: 120\n0:00 Intro\n0:12 Verse\n')
    })
    it('a block drawn again reads the tempo line; the tapped tempo it wrote is not kept on top', () => {
        const h = harness()
        h.blocks.sync()
        const first = h.draw('file: [[take.mp3]]\ntempo: 120')
        expect(first.view!.controller!.tempo()).toEqual({ bpm: 120, source: 'block' })
    })
    it('writes nothing once the player is freed', async () => {
        const h = harness()
        h.blocks.sync()
        const { view, child } = h.draw(SOURCE)
        view!.controller!.tap()
        h.advance(500)
        view!.controller!.tap()
        child!.unload()
        h.advance(5000)
        await h.flush()
        expect(h.writes).toEqual([])
        expect(h.timers.size).toBe(0)
    })
})

describe('PlayAlongBlocks: review fixes', () => {
    it('a change on one copy refreshes every copy of the block', () => {
        const h = harness()
        h.blocks.sync()
        const reading = h.draw(SOURCE).view!
        const preview = h.draw(SOURCE).view!
        const before = preview.refreshes
        reading.controller!.slower()
        expect(preview.refreshes).toBeGreaterThan(before)
    })
    it('only a copy on the page plays on after its own write, and gets the focus back', async () => {
        const h = harness()
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const first = h.draw(SOURCE)
        first.view!.controller!.state.countIn = false
        first.view!.focused = true
        first.view!.controller!.play()
        await h.flush()
        h.setNames(['Chorus'])
        await first.view!.request.actions.addSection()
        first.child!.unload()
        // The hidden live preview copy is drawn first: it doesn't take the play or the focus.
        h.hideNext(1)
        const hidden = h.draw(h.writes[0]!.result).view!
        const shown = h.draw(h.writes[0]!.result).view!
        await h.flush()
        expect(hidden.controller!.status).toBe('paused')
        expect(hidden.focused).toBe(false)
        expect(shown.controller!.status).toBe('playing')
        expect(shown.focused).toBe(true)
    })
    it('keeps a player off the page while the note that shows it (an embed) is open', () => {
        const h = harness()
        h.blocks.sync()
        const embedded = h.draw(SOURCE, 'Songs/Embedded.md')
        h.hosts.set(embedded.el, 'Songs/Host.md')
        h.setOpen(['Songs/Host.md'])
        h.blocks.prune()
        embedded.el.isConnected = false
        h.blocks.prune()
        expect(embedded.view!.destroyed).toBe(false)
        h.setOpen([])
        h.blocks.prune()
        expect(embedded.view!.destroyed).toBe(true)
    })
    it('a name typed while the block was drawn again is still written', async () => {
        let answer: (name: string | null) => void = () => {}
        const h = harness({ askName: () => new Promise((r) => (answer = r)) })
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const { view, child } = h.draw(SOURCE)
        view!.controller!.seek(30)
        const pending = view!.request.actions.addSection()
        child!.unload()
        answer('Bridge')
        await pending
        expect(h.writes).toHaveLength(1)
        expect(h.writes[0]!.result).toContain('0:30 Bridge')
    })
})

describe('PlayAlongBlocks: the count-in window', () => {
    it("ends the count-in on the player's window", () => {
        const requests: CountInRequest[] = []
        const h = harness({
            countIn: (request) => {
                requests.push(request)
                return { done: new Promise(() => {}), cancel: () => {} }
            }
        })
        h.blocks.sync()
        const view = h.draw(SOURCE).view!
        const popout = fake<Window>({})
        view.window = popout
        view.controller!.play()
        expect(requests[0]!.window).toBe(popout)
    })
})

describe('PlayAlongBlocks: focus after Add section', () => {
    it('comes back when the player had it before the name was asked (the modal takes it meanwhile)', async () => {
        let first: FakeView | null = null
        const h = harness({
            askName: () => {
                // The modal has the focus while it is open.
                if (first) first.focused = false
                return Promise.resolve('Bridge')
            }
        })
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const drawn = h.draw(SOURCE)
        first = drawn.view as FakeView
        first.focused = true
        await first.request.actions.addSection()
        drawn.child!.unload()
        const again = h.draw(h.writes[0]!.result).view!
        expect(again.focused).toBe(true)
    })
})

describe('PlayAlongBlocks: taking over after a write, once on the page', () => {
    it('a copy drawn before Obsidian puts it on the page takes over once it shows', async () => {
        const h = harness()
        h.blocks.sync()
        h.blockBody.text = SOURCE
        const first = h.draw(SOURCE)
        first.view!.focused = true
        first.view!.controller!.state.countIn = false
        first.view!.controller!.play()
        await h.flush()
        h.setNames(['Bridge'])
        await first.view!.request.actions.addSection()
        first.child!.unload()
        h.hideNext(1)
        const again = h.draw(h.writes[0]!.result).view!
        expect(again.focused).toBe(false)
        again.shown = true
        h.advance(200)
        await h.flush()
        expect(again.focused).toBe(true)
        expect(again.controller!.status).toBe('playing')
    })
    it('stops checking after 1.5 s, and when freed', () => {
        const h = harness()
        h.blocks.sync()
        h.hideNext(1)
        const { child } = h.draw(SOURCE)
        h.advance(2000)
        expect(h.timers.size).toBe(0)
        h.hideNext(1)
        const second = h.draw(SOURCE)
        second.child!.unload()
        expect(h.timers.size).toBe(0)
        void child
    })
})

describe("PlayAlongBlocks: a note's properties changed", () => {
    it('makes its players read the tempo and the note kind again, and only its players', () => {
        const h = harness()
        h.blocks.sync()
        const mine = h.draw(SOURCE).view!
        const other = h.draw(SOURCE, 'Inbox/Other.md').view!
        h.blocks.noteChanged('Songs/Wonderwall.md')
        expect(mine.forced).toBe(1)
        expect(other.forced).toBe(0)
    })
})
