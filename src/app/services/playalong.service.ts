/**
 * The ```playalong blocks (#75): one player per block, for a recording in the vault. Registers the
 * language, keeps each player's state per note and file, plays one at a time, writes the sections
 * set in the player back into the block, and frees the players when they go.
 */
import { MarkdownRenderChild } from 'obsidian'
import type { MarkdownPostProcessorContext, MarkdownSectionInformation, Plugin } from 'obsidian'
import {
    PLAYALONG_LANGUAGE,
    insertSection,
    mediaKindOf,
    parsePlayAlong,
    sectionLine,
    withTempo,
    type MediaKind,
    type PlayAlongBlock
} from '../domain/playalong'
import {
    PlayAlongController,
    createPlayerState,
    type PlayerClock,
    type PlayerMedia,
    type PlayerState
} from './playalong-player'
import type { CountInHandle, CountInRequest } from './metronome.service'

/** What the view does for the player: the buttons that need the plugin. */
export interface PlayerActions {
    saveBpm: () => void
    addSection: () => Promise<void>
}

/** What a view draws a player from. */
export interface MountRequest {
    el: HTMLElement
    kind: MediaKind
    url: string
    /** The file's path in the vault, and its name. */
    path: string
    name: string
    block: PlayAlongBlock
    /** Save BPM shows only in a learning note (read at each refresh: a note can become one). */
    learning: () => boolean
    actions: PlayerActions
}

/** A drawn player: its media element and frame clock, in the block's window. */
export interface PlayAlongView {
    media: PlayerMedia
    clock: PlayerClock
    /** The window it was drawn in; null when it can't tell. */
    window: Window | null
    bind(controller: PlayAlongController): void
    refresh(): void
    /** Whether it is on the page and shown (not the hidden live preview copy). */
    visible(): boolean
    /** Whether it is on the page but hidden by another view of its note (not when detached). */
    hidden(): boolean
    hasFocus(): boolean
    focus(): void
    /** Removes the drawing and frees the media element (`src` dropped, `load()`). */
    destroy(): void
}

/** Where a block is, for writing a section into it (found as Keep this view finds it). */
export interface BlockWrite {
    el: HTMLElement
    source: string
    sourcePath: string
    section: () => Pick<MarkdownSectionInformation, 'lineStart' | 'lineEnd'> | null
}

export interface PlayAlongDeps {
    enabled: () => boolean
    /** Whether another processor has the language (null when it can't tell). */
    exists: (language: string) => boolean | null
    /** The recording a block names, from its note; null when it isn't in the vault. */
    resolve: (link: string, sourcePath: string) => { path: string; url: string } | null
    note: (sourcePath: string) => { bpmTarget: number | null; beatsPerBar: number }
    settings: () => { preRoll: number; countInBars: number }
    countIn: (request: CountInRequest) => CountInHandle
    isLearningNote: (path: string) => boolean
    /** Puts a learning note in the practice panel's list (when it isn't there). */
    addToPanel: (path: string) => void
    /** Stops the metronome and the backing loop. */
    stopOthers: () => void
    saveBpm: (path: string, bpm: number) => void
    /** Changes the block's text in its note; false when the block can't be found. */
    writeBlock: (request: BlockWrite, change: (body: string) => string) => Promise<boolean>
    askName: (proposed: string) => Promise<string | null>
    notice: (message: string) => void
    /** In place of a player: a message (empty for a block shown as code) and the block text. */
    showMessage: (el: HTMLElement, message: string, source: string) => void
    mount: (request: MountRequest) => PlayAlongView
    /** The notes open in a tab. */
    openNotes: () => ReadonlySet<string>
    /** The note of the tab an element is drawn in (an embed's host note); null when it can't tell. */
    hostOf: (el: HTMLElement) => string | null
    now: () => number
    /** Timers (the tapped tempo's write). */
    timer: { set: (fn: () => void, ms: number) => number; clear: (id: number) => void }
}

/** A player drawn again within this time after its own write plays on. */
const RESUME_MS = 5000
/** A tapped tempo is written once the taps stop for this long. */
const TAP_WRITE_MS = 2000

const keyOf = (sourcePath: string, file: string): string => `${sourcePath}\n${file}`

class PlayAlongChild extends MarkdownRenderChild {
    view: PlayAlongView | null = null
    controller: PlayAlongController | null = null
    /** The notes whose tabs showed it (its own, or the note that embeds it). */
    readonly hosts = new Set<string>()
    private gone = false
    private tapTimer: number | null = null

    constructor(
        readonly el: HTMLElement,
        readonly source: string,
        public sourcePath: string,
        private readonly block: PlayAlongBlock,
        private readonly media: { path: string; url: string; kind: MediaKind },
        private readonly section: BlockWrite['section'],
        private readonly owner: PlayAlongBlocks
    ) {
        super(el)
    }

    get key(): string {
        return keyOf(this.sourcePath, this.media.path)
    }

    override onload(): void {
        this.owner.added(this)
        this.build()
        // Moved to another window (a tab dragged to a popout): made again there, with its state.
        const migrated = (this.el as Partial<HTMLElement>).onWindowMigrated
        if (typeof migrated === 'function')
            this.register(migrated.call(this.el, () => this.rebuild()))
    }

    override onunload(): void {
        this.free()
    }

    private build(): void {
        const deps = this.owner.deps
        const view = deps.mount({
            el: this.el,
            kind: this.media.kind,
            url: this.media.url,
            path: this.media.path,
            name: this.media.path.split('/').pop() ?? this.media.path,
            block: this.block,
            learning: () => deps.isLearningNote(this.sourcePath),
            actions: {
                saveBpm: () => this.saveBpm(),
                addSection: () => this.addSection()
            }
        })
        const controller = new PlayAlongController({
            media: view.media,
            clock: view.clock,
            // Ended on the player's window timer (a popout's own).
            countIn: (request) =>
                deps.countIn(view.window ? { ...request, window: view.window } : request),
            settings: () => deps.settings(),
            note: () => deps.note(this.sourcePath),
            blockTempo: this.block.tempo,
            onTapped: (bpm) => this.tapped(bpm),
            sections: this.block.sections,
            state: this.owner.stateOf(this.key),
            onPlay: () => this.owner.playing(this),
            // Every copy of the block shows the shared state.
            changed: () => this.owner.refreshCopies(this.key),
            notice: (message) => deps.notice(message),
            now: () => deps.now(),
            visible: () => !view.hidden()
        })
        this.view = view
        this.controller = controller
        if (this.el.isConnected) {
            const host = deps.hostOf(this.el)
            if (host) this.hosts.add(host)
        }
        view.bind(controller)
        // Drawn again after its own write: only a copy on the page takes it (not the hidden live
        // preview copy), plays on when it played and gets the keyboard focus back when it had it.
        if (!view.visible()) return
        const resume = this.owner.takeResume(this.key)
        if (resume?.focus) view.focus()
        if (resume?.play) controller.play({ countIn: false })
    }

    private rebuild(): void {
        if (this.gone || !this.controller) return
        const playing = this.controller.status !== 'paused'
        this.controller.free()
        this.view?.destroy()
        this.build()
        if (playing) this.controller?.play({ countIn: false })
    }

    private saveBpm(): void {
        const bpm = this.controller?.playedBpm() ?? null
        if (bpm === null) {
            this.owner.deps.notice('Tap the tempo first: Save BPM needs it.')
            return
        }
        this.owner.deps.saveBpm(this.sourcePath, bpm)
    }

    private async addSection(): Promise<void> {
        const controller = this.controller
        if (!controller || this.gone) return
        const time = controller.position()
        const name = await this.owner.deps.askName(`Section ${this.block.sections.length + 1}`)
        // Written even when the block was drawn again meanwhile: it is found by its text.
        if (name === null) return
        const line = sectionLine(time, name)
        await this.write((body) => insertSection(body, line), "Couldn't add the section")
    }

    /** A tempo was tapped: written as the tempo line once the taps stop for 2 s. */
    private tapped(bpm: number): void {
        const timer = this.owner.deps.timer
        if (this.tapTimer !== null) timer.clear(this.tapTimer)
        this.tapTimer = timer.set(() => {
            this.tapTimer = null
            void this.write((body) => withTempo(body, bpm), "Couldn't write the tempo").then(
                (ok) => {
                    // The block's tempo line holds it now; a line removed later falls back to the target.
                    if (ok && this.controller?.state.tapped === bpm)
                        this.controller.state.tapped = null
                }
            )
        }, TAP_WRITE_MS)
    }

    /**
     * Changes the block in its note. The block drawn again plays on when this one plays, and gets
     * the focus back when this one had it. True when written.
     */
    private async write(change: (body: string) => string, failure: string): Promise<boolean> {
        const deps = this.owner.deps
        const playing =
            !this.gone && this.controller !== null && this.controller.status !== 'paused'
        const focused = !this.gone && (this.view?.hasFocus() ?? false)
        if (playing || focused) this.owner.markResume(this.key, { play: playing, focus: focused })
        const written = await deps
            .writeBlock(
                {
                    el: this.el,
                    source: this.source,
                    sourcePath: this.sourcePath,
                    section: this.section
                },
                change
            )
            .catch((error: unknown) => {
                deps.notice(`${failure}: ${error instanceof Error ? error.message : String(error)}`)
                return null
            })
        if (written === false)
            deps.notice("Couldn't find this block in the note: it may have changed. Try again.")
        if (written !== true) this.owner.clearResume(this.key)
        return written === true
    }

    /**
     * Stops and frees the player; its state stays for the next drawing (the shared object, whose
     * playhead the copy that played or moved last keeps: a hidden copy's stale one never counts).
     */
    free(): void {
        if (this.gone) return
        this.gone = true
        if (this.tapTimer !== null) this.owner.deps.timer.clear(this.tapTimer)
        this.tapTimer = null
        this.controller?.free()
        this.view?.destroy()
        this.owner.removed(this)
    }
}

/** What registering needs from the plugin. */
export type PlayAlongHost = Pick<Plugin, 'registerMarkdownCodeBlockProcessor'>

export class PlayAlongBlocks {
    private registered = false
    private taken = false
    private readonly live = new Set<PlayAlongChild>()
    private readonly states = new Map<string, PlayerState>()
    private readonly resumes = new Map<string, { until: number; play: boolean; focus: boolean }>()

    constructor(
        private readonly host: PlayAlongHost,
        readonly deps: PlayAlongDeps
    ) {}

    /** Registers the language when it is on and no other plugin has it (once). */
    sync(): void {
        if (this.registered || this.taken || !this.deps.enabled()) return
        if (this.deps.exists(PLAYALONG_LANGUAGE) === true) {
            this.taken = true
            return
        }
        try {
            this.host.registerMarkdownCodeBlockProcessor(PLAYALONG_LANGUAGE, (source, el, ctx) =>
                this.process(source, el, ctx)
            )
            this.registered = true
        } catch {
            this.taken = true
        }
    }

    status(): 'on' | 'off' | 'taken' {
        if (this.taken) return 'taken'
        return this.registered && this.deps.enabled() ? 'on' : 'off'
    }

    private process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
        const deps = this.deps
        if (!deps.enabled()) {
            deps.showMessage(el, '', source)
            return
        }
        const block = parsePlayAlong(source)
        if (block.file === null) {
            deps.showMessage(
                el,
                'playalong: name the recording on a line of its own, for example file: [[Song.mp3]]',
                source
            )
            return
        }
        const media = deps.resolve(block.file, ctx.sourcePath)
        if (!media) {
            deps.showMessage(el, `playalong: no file "${block.file}" in the vault`, source)
            return
        }
        const kind = mediaKindOf(media.path)
        if (!kind) {
            deps.showMessage(el, `playalong: "${media.path}" is not an audio or video file`, source)
            return
        }
        ctx.addChild(
            new PlayAlongChild(
                el,
                source,
                ctx.sourcePath,
                block,
                { ...media, kind },
                () => ctx.getSectionInfo(el),
                this
            )
        )
    }

    /**
     * The state of a note's recording, shared by every copy of its block (reading view and the
     * hidden live preview copy, a block drawn again); a fresh one the first time.
     */
    stateOf(key: string): PlayerState {
        let state = this.states.get(key)
        if (!state) {
            state = createPlayerState()
            this.states.set(key, state)
        }
        return state
    }

    markResume(key: string, what: { play: boolean; focus: boolean }): void {
        this.resumes.set(key, { until: this.deps.now() + RESUME_MS, ...what })
    }

    clearResume(key: string): void {
        this.resumes.delete(key)
    }

    /** What a player drawn now takes over after its own write (used once); null when nothing. */
    takeResume(key: string): { play: boolean; focus: boolean } | null {
        const resume = this.resumes.get(key)
        this.resumes.delete(key)
        return resume && this.deps.now() <= resume.until ? resume : null
    }

    added(child: PlayAlongChild): void {
        this.live.add(child)
    }

    removed(child: PlayAlongChild): void {
        this.live.delete(child)
    }

    liveCount(): number {
        return this.live.size
    }

    /** A player starts: the others pause, the metronome and the backing loop stop, the note is listed. */
    playing(child: PlayAlongChild): void {
        for (const other of this.live) if (other !== child) other.controller?.pause()
        this.deps.stopOthers()
        if (this.deps.isLearningNote(child.sourcePath)) this.deps.addToPanel(child.sourcePath)
    }

    /** Redraws every live copy of a note's recording. */
    refreshCopies(key: string): void {
        for (const child of this.live) if (child.key === key) child.view?.refresh()
    }

    /** The metronome or the backing loop started. */
    pauseAll(): void {
        for (const child of this.live) child.controller?.pause()
    }

    /**
     * A layout change: frees the players whose note no tab shows any more and that are off the
     * page (an open note's block out of view in reading view, or one in an embed, stays).
     */
    prune(): void {
        const open = this.deps.openNotes()
        for (const child of [...this.live]) {
            if (child.el.isConnected) {
                const host = this.deps.hostOf(child.el)
                if (host) child.hosts.add(host)
                continue
            }
            const shown = open.has(child.sourcePath) || [...child.hosts].some((h) => open.has(h))
            if (!shown) child.free()
        }
    }

    /** A popout window closed: its players go. */
    windowClosed(win: Window): void {
        for (const child of [...this.live]) if (child.view?.window === win) child.free()
    }

    /** A note was renamed or moved: its players and their states follow it. */
    renamed(oldPath: string, newPath: string): void {
        for (const [key, state] of [...this.states]) {
            const [path, file] = key.split('\n')
            if (path !== oldPath || file === undefined) continue
            this.states.delete(key)
            this.states.set(keyOf(newPath, file), state)
        }
        for (const child of this.live) if (child.sourcePath === oldPath) child.sourcePath = newPath
    }

    /** The plugin unloads: every player stops and is freed; the states go. */
    unload(): void {
        for (const child of [...this.live]) child.free()
        this.live.clear()
        this.states.clear()
        this.resumes.clear()
    }
}
