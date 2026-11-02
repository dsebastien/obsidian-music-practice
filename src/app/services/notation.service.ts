import { MarkdownPreviewRenderer, MarkdownRenderChild, MarkdownView } from 'obsidian'
import type { Plugin, Workspace } from 'obsidian'
import {
    LANGUAGES,
    blockFromProperties,
    renderBlock,
    textTabToAlphaTex
} from '@dsebastien/music-notation'
import type {
    LayoutDefaults,
    NotationLanguage,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'
import { renderTab } from '@dsebastien/music-notation/tab'
import type { TabResult } from '@dsebastien/music-notation/tab'
import type { PlayOptions } from '@dsebastien/music-notation'
import type { AlphaTabRuntime, AlphaTabWindow } from './alphatab.service'

/** Tabs and scores, drawn by alphaTab through the library's tab entry (#15). */
export const TAB_LANGUAGES = ['tab', 'score'] as const
export type TabLanguage = (typeof TAB_LANGUAGES)[number]

/** Every block language the plugin can draw. */
export type BlockLanguage = NotationLanguage | TabLanguage
export const BLOCK_LANGUAGES: readonly BlockLanguage[] = [...LANGUAGES, ...TAB_LANGUAGES]

export type NotationToggles = Record<BlockLanguage, boolean>

/** What tab blocks need: alphaTab, the files they name, and extras on the drawn score. */
export interface TabHost {
    runtime: AlphaTabRuntime
    /** The bytes of a file a block names, from the note it's in; null when not found. */
    resolveFile: (link: string, sourcePath: string) => Promise<Uint8Array | null>
    /** Adds the plugin's own controls (export) once a score is drawn. */
    decorate?: (result: TabResult, sourcePath: string) => void
}

/**
 * alphaTex comments: a tab written in one (for reference) doesn't make the block a text tab.
 * `//` only at a line start or after a space (text tabs use `5//7` for slides).
 */
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/gm

/** A text tab line: a string name or number, or a drum's name, a bar line, then mostly dashes. */
const isStaffLine = (line: string): boolean => {
    if (!/^\s*[A-Za-z0-9#-]{0,8}\s*[|:]/.test(line)) return false
    const dashes = line.match(/-/g)?.length ?? 0
    return dashes >= 4 && dashes * 3 >= line.replace(/\s/g, '').length
}

/**
 * Whether a tab or score block holds a plain-text tab (`e|---0---|` lines) rather than alphaTex:
 * notes written before the plugin drew tabs used ```tab for monospace text. A tab the library
 * converts, or two staff lines or more (blank staves, drum tabs, a few strings, text after them).
 */
export const isTextTab = (source: string): boolean => {
    const text = source.replace(COMMENTS, '')
    if (textTabToAlphaTex(text) !== null) return true
    return text.split('\n').filter(isStaffLine).length >= 2
}

/** A block shown as Obsidian shows code (a language turned off, a plain-text tab). */
const asCode = (el: HTMLElement, language: string, source: string) =>
    el.createEl('pre').createEl('code', { cls: `language-${language}`, text: source })

/**
 * A tab or score block: alphaTab is loaded on the first one, then the score draws and plays.
 * It draws once the block is on the page, in the window it shows in: alphaTab, its font and its
 * player belong to that window (popouts), and the note may be moved to another window later.
 */
class TabChild extends MarkdownRenderChild {
    private result: TabResult | null = null
    private loading: HTMLElement | null = null
    private gone = false
    /** Bumped at each draw, so a draw that finishes late after a newer one does nothing. */
    private generation = 0

    constructor(
        el: HTMLElement,
        private readonly language: TabLanguage,
        private readonly source: string,
        private readonly host: TabHost,
        private readonly sourcePath: string,
        private readonly live: Set<TabChild>
    ) {
        super(el)
    }

    override onload(): void {
        this.live.add(this)
        const el = this.containerEl
        if (el.isConnected) this.draw()
        else this.register(el.onNodeInserted(() => this.draw(), true))
        // Moved to another window (a tab dragged to a popout): drawn again there.
        this.register(el.onWindowMigrated(() => this.draw()))
    }

    private draw(): void {
        if (this.gone) return
        const generation = ++this.generation
        this.result?.destroy()
        this.result = null
        this.loading?.remove()
        const win = (this.containerEl.ownerDocument.defaultView ?? window) as AlphaTabWindow
        const loading = this.containerEl.createDiv({ cls: 'mn-tab-loading', text: 'Loading…' })
        this.loading = loading
        this.host.runtime
            .module(win)
            .then((alphaTab) => {
                if (this.gone || generation !== this.generation) return
                loading.remove()
                this.result = renderTab(this.language, this.source, this.containerEl, {
                    alphaTab,
                    assets: this.host.runtime.assets(win),
                    resolveFile: (link) => this.host.resolveFile(link, this.sourcePath)
                })
                const result = this.result
                void result.ready.then(({ ok }) => {
                    if (ok && !this.gone && result === this.result)
                        this.host.decorate?.(result, this.sourcePath)
                })
            })
            .catch((error: unknown) => {
                if (this.gone || generation !== this.generation) return
                loading.setText(
                    `${this.language}: ${error instanceof Error ? error.message : String(error)}`
                )
                loading.addClass('mn-error-message')
            })
    }

    override onunload(): void {
        this.live.delete(this)
        this.free()
    }

    /** Stops and frees the score (the plugin unloads, or Obsidian dropped the block). */
    free(): void {
        this.gone = true
        this.result?.destroy()
        this.result = null
        this.loading?.remove()
        this.loading = null
    }
}

/** What the notation blocks need from the plugin. */
export type NotationHost = Pick<Plugin, 'registerMarkdownCodeBlockProcessor'> & {
    app: { workspace: Pick<Workspace, 'getLeavesOfType'> }
}

/** What an empty block in a note draws from: the note's properties, their names, its instrument. */
export type NoteContext = Pick<RenderOptions, 'properties' | 'propertyNames' | 'instrument'>

/** Where each block language stands: rendered by us, turned off, or handled by another plugin. */
export type NotationStatus = 'on' | 'off' | 'taken'

/**
 * A rendered block, removed when Obsidian re-renders or closes the note. Known while loaded, so a
 * layout change redraws it in place wherever it shows (reading view, live preview, embeds, canvas).
 */
class NotationChild extends MarkdownRenderChild {
    private result: RenderResult | null = null
    /** What it drew from the note's properties last time, to skip redraws that change nothing. */
    private drawnFrom: string | null = null

    constructor(
        readonly el: HTMLElement,
        private readonly draw: (sourcePath: string) => RenderResult,
        private readonly live: Set<NotationChild>,
        /** The note it's in (follows renames), and whether it draws from the note's properties. */
        public sourcePath: string,
        readonly fromProperties: boolean,
        /** The block those properties make, for the current note; null without one. */
        private readonly propertiesKey: (sourcePath: string) => string | null
    ) {
        super(el)
        this.redraw()
    }

    override onload(): void {
        this.live.add(this)
        // Moved to another window: Obsidian draws a note's blocks before it moves them into a
        // popout. Drawn again there, so its playback goes through that window's player.
        this.register(this.el.onWindowMigrated(() => this.redraw()))
    }

    override onunload(): void {
        this.live.delete(this)
        this.free()
    }

    /** Stops its playback and removes the drawing. */
    free(): void {
        this.result?.destroy()
        this.result = null
    }

    redraw(): void {
        this.result?.destroy()
        this.drawnFrom = this.fromProperties ? this.propertiesKey(this.sourcePath) : null
        this.result = this.draw(this.sourcePath)
    }

    /** Redraw after the note changed, only when its properties make a different block. */
    refresh(): void {
        if (this.propertiesKey(this.sourcePath) !== this.drawnFrom) this.redraw()
    }
}

/**
 * Whether a code block language already has a processor, from Obsidian's registry (not part of
 * the public API: null when it can't be read).
 */
export function processorExists(language: string): boolean | null {
    const registry: unknown = Reflect.get(MarkdownPreviewRenderer, 'codeBlockPostProcessors')
    if (typeof registry !== 'object' || registry === null) return null
    return Object.prototype.hasOwnProperty.call(registry, language)
}

/**
 * Registers the notation code block processors (chord, chords, keyboard, fretboard), drawn by the
 * music notation library.
 *
 * A language another plugin already handles is left alone, checked before registering: Obsidian
 * adds a generic post-processor before it refuses a duplicate, and that one is never removed, so a
 * refused registration must happen at most once (and never when the registry can be read).
 * A language turned off after registration renders as plain code until the plugin reloads
 * (Obsidian can't unregister a processor), which frees it for another plugin.
 */
export class NotationBlocks {
    private readonly registered = new Set<BlockLanguage>()
    private readonly taken = new Set<BlockLanguage>()
    private readonly live = new Set<NotationChild>()
    private readonly liveTabs = new Set<TabChild>()

    constructor(
        private readonly plugin: NotationHost,
        private readonly toggles: () => NotationToggles,
        private readonly layout: () => LayoutDefaults = () => ({}),
        private readonly exists: (language: string) => boolean | null = processorExists,
        private readonly render: typeof renderBlock = renderBlock,
        private readonly note: (sourcePath: string) => NoteContext | null = () => null,
        /** Playback on diagrams (#31): its options, or false when it's off. */
        private readonly play: () => PlayOptions | false = () => false,
        /** Tabs and scores; null leaves those languages alone. */
        private readonly tabs: TabHost | null = null
    ) {}

    /** Register every language turned on, not registered yet and not taken. */
    sync(): void {
        for (const language of BLOCK_LANGUAGES) {
            if (!this.toggles()[language]) continue
            if (language === 'tab' || language === 'score') {
                this.syncTab(language)
                continue
            }
            if (this.registered.has(language) || this.taken.has(language)) continue
            if (this.exists(language) === true) {
                this.taken.add(language)
                continue
            }
            try {
                this.plugin.registerMarkdownCodeBlockProcessor(language, (source, el, ctx) => {
                    if (!this.toggles()[language]) {
                        asCode(el, language, source)
                        return
                    }
                    // An empty block draws from the note's properties, read at each draw.
                    const empty = !source.trim()
                    const draw = (path: string) =>
                        this.render(language, source, el, {
                            ...this.layout(),
                            ...(empty ? this.note(path) : null),
                            voicings: lookupGuitarVoicing,
                            ...playOf(this.play())
                        })
                    const key = (path: string) => {
                        const note = this.note(path)
                        const properties = note?.properties
                        if (!properties || typeof properties !== 'object') return null
                        return blockFromProperties(language, properties, {
                            ...(note.propertyNames ? { names: note.propertyNames } : {}),
                            ...(note.instrument ? { instrument: note.instrument } : {})
                        })
                    }
                    ctx.addChild(new NotationChild(el, draw, this.live, ctx.sourcePath, empty, key))
                })
                this.registered.add(language)
            } catch {
                // Registry unreadable and another plugin was first: never try this one again.
                this.taken.add(language)
            }
        }
    }

    /** Registers a tab language (alphaTab draws it), unless another plugin has it. */
    private syncTab(language: TabLanguage): void {
        const tabs = this.tabs
        if (!tabs || this.registered.has(language) || this.taken.has(language)) return
        if (this.exists(language) === true) {
            this.taken.add(language)
            return
        }
        try {
            this.plugin.registerMarkdownCodeBlockProcessor(language, (source, el, ctx) => {
                // A plain-text tab stays text, as it was before tabs were drawn.
                if (!this.toggles()[language] || isTextTab(source)) {
                    asCode(el, language, source)
                    return
                }
                ctx.addChild(
                    new TabChild(el, language, source, tabs, ctx.sourcePath, this.liveTabs)
                )
            })
            this.registered.add(language)
        } catch {
            this.taken.add(language)
        }
    }

    status(language: BlockLanguage): NotationStatus {
        if (this.taken.has(language)) return 'taken'
        return this.toggles()[language] && this.registered.has(language) ? 'on' : 'off'
    }

    /** Redraw the blocks that draw from a note's properties, after the note changed. */
    redrawNote(path: string): void {
        for (const child of this.current()) {
            if (child.fromProperties && child.sourcePath === path) child.refresh()
        }
    }

    /** A note was renamed or moved: its blocks follow it. */
    renamed(oldPath: string, newPath: string): void {
        for (const child of this.live) if (child.sourcePath === oldPath) child.sourcePath = newPath
    }

    /** The blocks still on screen; those Obsidian dropped without unloading are forgotten. */
    private current(): NotationChild[] {
        for (const child of [...this.live])
            if (child.el.isConnected === false) this.live.delete(child)
        return [...this.live]
    }

    /** Redraw every block on screen with the current layout settings, wherever it shows. */
    redrawLayout(): void {
        for (const child of this.current()) child.redraw()
    }

    /**
     * The plugin unloads: stop and free every drawing still on screen (Obsidian keeps blocks
     * rendered by a disabled plugin, with their players and loops).
     */
    unload(): void {
        for (const child of this.liveTabs) child.free()
        for (const child of this.live) child.free()
        this.liveTabs.clear()
        this.live.clear()
    }

    /** Redraw open notes in reading view, after a block was turned on or off. */
    refreshOpenNotes(): void {
        for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
            if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true)
        }
    }
}

/** The `play` render option, when playback is on. */
const playOf = (play: PlayOptions | false): { play?: PlayOptions } => (play ? { play } : {})
