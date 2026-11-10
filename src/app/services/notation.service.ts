import { MarkdownPreviewRenderer, MarkdownRenderChild, MarkdownView } from 'obsidian'
import type { MarkdownSectionInformation, Plugin, Workspace } from 'obsidian'
import {
    LANGUAGES,
    blockFromProperties,
    renderBlock,
    textTabToAlphaTex
} from '@dsebastien/music-notation'
import type { NotationLanguage, RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'
import { renderTab } from '@dsebastien/music-notation/tab'
import type { Staves, TabResult } from '@dsebastien/music-notation/tab'
import type { PlayOptions } from '@dsebastien/music-notation'
import type { AlphaTabRuntime, AlphaTabWindow } from './alphatab.service'
import type { RenderDefaults } from '../domain/notation-layout'
import { textTabView } from '../ui/text-tab-view'
import type { TextTabView } from '../ui/text-tab-view'

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
    /** Converts a plain-text tab block into alphaTex in its note (#60); no button without it. */
    convert?: (request: ConvertRequest) => void
    /** Writes `staves:` in a block of a note (Keep this view, #83); no such button without it. */
    keepView?: (request: ConvertRequest, staves: Staves) => void
    /**
     * Settings → Playback → Volume (0 to 1), read at each Play: the tab and score bar has no
     * volume of its own since music-notation 0.18 (#82); a change is heard at once (#85).
     */
    volume?: () => number
}

/** What a block's actions (Edit as alphaTex, Keep this view) know about it. */
export interface ConvertRequest {
    el: HTMLElement
    language: TabLanguage
    source: string
    sourcePath: string
    /** Where Obsidian drew the block from, read when the button is selected. */
    section: () => Pick<MarkdownSectionInformation, 'lineStart' | 'lineEnd'> | null
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
    if (textTabOf(source) !== null) return true
    return source.replace(COMMENTS, '').split('\n').filter(isStaffLine).length >= 2
}

/** Staff lines with no note on them: a blank stave, a template to fill in by hand. */
const isBlankStaff = (source: string): boolean => {
    const staves = source.split('\n').filter(isStaffLine)
    return (
        staves.length > 0 &&
        staves.every((line) => !/[^\s|:-]/.test(line.replace(/^\s*[A-Za-z0-9#-]{0,8}\s*[|:]/, '')))
    )
}

/**
 * The alphaTex of a block holding a plain-text tab the library reads (comments left out); else
 * null. Blank staves stay text: the library reads them as empty bars, but they are templates.
 */
export const textTabOf = (source: string): string | null => {
    const text = source.replace(COMMENTS, '')
    return isBlankStaff(text) ? null : textTabToAlphaTex(text)
}

/** A block shown as Obsidian shows code (a language turned off, a plain-text tab). */
const asCode = (el: HTMLElement, language: string, source: string) =>
    el.createEl('pre').createEl('code', { cls: `language-${language}`, text: source })

/** A tab block's setting line, as the library reads them at the top of the block. */
const SETTING = /^\s*(staves|file|tracks?)\s*:/i

/**
 * A tab block's settings (`staves:`, `file:`, `tracks:` lines at the top, with the blank lines and
 * `//` comments among them) and the text after them; no settings when it has none.
 */
export function splitSettings(source: string): { settings: string[]; rest: string } {
    const lines = source.split('\n')
    let last = -1
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (!line.trim() || /^\s*\/\//.test(line)) continue
        if (!SETTING.test(line)) break
        last = i
    }
    if (last < 0) return { settings: [], rest: source }
    return {
        settings: lines.slice(0, last + 1),
        rest: lines
            .slice(last + 1)
            .join('\n')
            .replace(/^(?:[ \t]*\n)+/, '')
    }
}

/**
 * What a plain-text tab block draws (#84): its settings lines, then the library's alphaTex of the
 * rest, made in memory at each draw (the note doesn't change); null when the library can't read
 * it or it's a blank stave (it shows as code then).
 */
export function textTabSource(source: string): string | null {
    const { settings, rest } = splitSettings(source)
    const tex = textTabOf(rest)
    return tex === null ? null : [...settings, tex].join('\n')
}

/** A plain-text tab drawn as tablature: its text, and the conversion in its note (#84). */
export interface TextTabBlock {
    text: string
    /** Edit as alphaTex; null when the block isn't in a note (a canvas card). */
    edit: (() => void) | null
}

/** The block line an alphaTab message points at (`line 3, column 5: …`, from 1); null without one. */
export const errorLineOf = (message: string | null): number | null => {
    const m = /^line (\d+), column \d+:/.exec(message ?? '')
    return m ? Number(m[1]) : null
}

/**
 * Under a tab or score error: the block's text, folded, with the line the message points at
 * marked (#61). Without it, the text stays hidden until the note is edited.
 */
export function showSource(el: HTMLElement, source: string, error: string | null): HTMLElement {
    const details = el.createEl('details', { cls: 'mp-tab-source' })
    details.createEl('summary', { text: 'Block text' })
    const code = details.createEl('pre').createEl('code')
    const marked = errorLineOf(error)
    source.split('\n').forEach((line, i) => {
        code.createSpan({
            cls: i + 1 === marked ? 'mp-tab-source-line mp-tab-source-error' : 'mp-tab-source-line',
            // A space keeps an empty line's height.
            text: line.length ? line : ' '
        })
    })
    return details
}

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

    /** A text tab's controls, and whether it shows as text (kept across redraws). */
    private textView: TextTabView | null = null
    private asText = false

    constructor(
        el: HTMLElement,
        private readonly language: TabLanguage,
        /** What it draws: the block's text, or a text tab's alphaTex (#84). */
        readonly source: string,
        private readonly host: TabHost,
        private readonly sourcePath: string,
        private readonly live: Set<TabChild>,
        /** A plain-text tab drawn as tablature (#84); null for alphaTex and files. */
        readonly textTab: TextTabBlock | null = null,
        /** Keep this view: writes `staves:` in the block (#83); null when it can't. */
        readonly keepView: ((staves: Staves) => void) | null = null
    ) {
        super(el)
    }

    /** A text tab's text, with its buttons, in place of the drawing (`el`, hidden). */
    private showText(el: HTMLElement, drawn: boolean, api: TabResult['api']): void {
        const textTab = this.textTab
        if (!textTab) return
        this.textView = textTabView(el, {
            text: textTab.text,
            language: this.language,
            edit: textTab.edit,
            drawn,
            onShow: (text) => {
                this.asText = text
                // The music stops while its text shows.
                if (text) api?.pause()
            }
        })
        if (drawn && this.asText) this.textView.show(true)
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
        this.clearText()
        const win = (this.containerEl.ownerDocument.defaultView ?? window) as AlphaTabWindow
        const loading = this.containerEl.createDiv({ cls: 'mn-tab-loading', text: 'Loading…' })
        this.loading = loading
        this.host.runtime
            .module(win)
            .then((alphaTab) => {
                if (this.gone || generation !== this.generation) return
                loading.remove()
                const keep = this.keepView
                this.result = renderTab(this.language, this.source, this.containerEl, {
                    alphaTab,
                    assets: this.host.runtime.assets(win),
                    resolveFile: (link) => this.host.resolveFile(link, this.sourcePath),
                    ...(this.host.volume ? { volume: this.host.volume } : {}),
                    // Text tabs show tablature unless a staves: line says otherwise (#84).
                    ...(this.textTab ? { defaultStaves: 'tab' as const } : {}),
                    ...(keep ? { onKeepView: (staves: Staves) => keep(staves) } : {})
                })
                const result = this.result
                void result.ready.then(({ ok, error }) => {
                    if (this.gone || result !== this.result) return
                    if (ok) this.host.decorate?.(result, this.sourcePath)
                    // A text tab alphaTab can't draw shows as code, as before (#84).
                    if (this.textTab) this.showText(result.el, ok, result.api)
                    else if (!ok) showSource(result.el, this.source, error)
                })
            })
            .catch((error: unknown) => {
                if (this.gone || generation !== this.generation) return
                if (this.textTab) {
                    this.showText(loading, false, null)
                    return
                }
                loading.setText(
                    `${this.language}: ${error instanceof Error ? error.message : String(error)}`
                )
                loading.addClass('mn-error-message')
                showSource(loading, this.source, null)
            })
    }

    override onunload(): void {
        this.live.delete(this)
        this.free()
    }

    /** Removes a text tab's text panel (the drawing goes with its result). */
    private clearText(): void {
        this.textView?.remove()
        this.textView = null
    }

    /** Stops and frees the score (the plugin unloads, or Obsidian dropped the block). */
    free(): void {
        this.gone = true
        this.result?.destroy()
        this.result = null
        this.loading?.remove()
        this.loading = null
        this.clearText()
    }
}

/** What the notation blocks need from the plugin. */
export type NotationHost = Pick<Plugin, 'registerMarkdownCodeBlockProcessor'> & {
    app: { workspace: Pick<Workspace, 'getLeavesOfType'> }
}

/** A right-click on a drawn block (#51): the block, its language, its note, where it is in it. */
export interface BlockMenuRequest {
    el: HTMLElement
    language: BlockLanguage
    sourcePath: string
    /** The block's lines in the note, read when asked; null when Obsidian can't tell. */
    section: () => MarkdownSectionInformation | null
}

/** Called on `contextmenu` of each block the library draws. */
export type BlockMenu = (event: MouseEvent, block: BlockMenuRequest) => void

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
    /** The window it was drawn in: a block moved before it was loaded is drawn again there. */
    private drawnIn: Window | null = null

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
        // Obsidian can draw a block, move it to a popout and only then load it: no migration
        // event fires for that move, so compare windows here.
        if ((this.el.ownerDocument?.defaultView ?? null) !== this.drawnIn) this.redraw()
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
        this.drawnIn = this.el.ownerDocument?.defaultView ?? null
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
        private readonly layout: () => RenderDefaults = () => ({}),
        private readonly exists: (language: string) => boolean | null = processorExists,
        private readonly render: typeof renderBlock = renderBlock,
        private readonly note: (sourcePath: string) => NoteContext | null = () => null,
        /** Playback on diagrams (#31): its options, or false when it's off. */
        private readonly play: () => PlayOptions | false = () => false,
        /** Tabs and scores; null leaves those languages alone. */
        private readonly tabs: TabHost | null = null,
        /**
         * The source of an empty block that Music Practice makes from the note's properties (an
         * arpeggio, #56; a strumming pattern, #58); null leaves the block to the library's properties.
         */
        private readonly own: (sourcePath: string, language: string) => string | null = () => null,
        /**
         * The library's `play.timedBar` hook for a note's blocks (#88: Save BPM in the play bars of
         * a learning note); null for notes that get none.
         */
        private readonly timedBar: (sourcePath: string) => PlayOptions['timedBar'] | null = () =>
            null,
        /** The menu of a right-click on a drawn block (#51: save as image); null for none. */
        private readonly menu: BlockMenu | null = null
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
                    const draw = (path: string) => {
                        const own = empty ? this.own(path, language) : null
                        return this.render(language, own ?? source, el, {
                            ...this.layout(),
                            ...(empty && own === null ? this.note(path) : null),
                            voicings: lookupGuitarVoicing,
                            ...playOf(this.play(), this.timedBar(path)),
                            ...this.exerciseTabs(path)
                        })
                    }
                    const key = (path: string) => {
                        const own = this.own(path, language)
                        if (own !== null) return own
                        const note = this.note(path)
                        const properties = note?.properties
                        if (!properties || typeof properties !== 'object') return null
                        return blockFromProperties(language, properties, {
                            ...(note.propertyNames ? { names: note.propertyNames } : {}),
                            ...(note.instrument ? { instrument: note.instrument } : {})
                        })
                    }
                    const child = new NotationChild(el, draw, this.live, ctx.sourcePath, empty, key)
                    const menu = this.menu
                    if (menu) {
                        child.registerDomEvent(el, 'contextmenu', (event) =>
                            menu(event, {
                                el,
                                language,
                                sourcePath: child.sourcePath,
                                section: () => ctx.getSectionInfo(el)
                            })
                        )
                    }
                    ctx.addChild(child)
                })
                this.registered.add(language)
            } catch {
                // Registry unreadable and another plugin was first: never try this one again.
                this.taken.add(language)
            }
        }
    }

    /**
     * The `tab` render option (#70): a fretboard's `exercise:` tab drawn by alphaTab under the
     * diagram, as a tab block is (in the holder's window, once it's on the page), freed with the
     * diagram or when the plugin unloads. None without a tab host: the alphaTex shows as text.
     */
    exerciseTabs(sourcePath: string): Pick<RenderOptions, 'tab'> {
        const tabs = this.tabs
        if (!tabs) return {}
        return {
            tab: (source, holder) => {
                const child = new TabChild(holder, 'tab', source, tabs, sourcePath, this.liveTabs)
                child.load()
                return () => child.unload()
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
                if (!this.toggles()[language]) {
                    asCode(el, language, source)
                    return
                }
                const request: ConvertRequest = {
                    el,
                    language,
                    source,
                    sourcePath: ctx.sourcePath,
                    section: () => ctx.getSectionInfo(el)
                }
                // Actions that change the note, only in a note (a canvas card's text isn't one).
                const inNote = /\.md$/i.test(ctx.sourcePath)
                const { convert, keepView } = tabs
                const keep =
                    keepView && inNote ? (staves: Staves) => keepView(request, staves) : null
                // A plain-text tab draws as tablature, converted in memory at each draw (#84);
                // one the library can't read, or a blank stave (a template), stays text.
                if (isTextTab(source)) {
                    const tex = textTabSource(source)
                    if (tex === null) {
                        asCode(el, language, source)
                        return
                    }
                    const edit = convert && inNote ? () => convert(request) : null
                    ctx.addChild(
                        new TabChild(
                            el,
                            language,
                            tex,
                            tabs,
                            ctx.sourcePath,
                            this.liveTabs,
                            {
                                text: source,
                                edit
                            },
                            keep
                        )
                    )
                    return
                }
                ctx.addChild(
                    new TabChild(
                        el,
                        language,
                        source,
                        tabs,
                        ctx.sourcePath,
                        this.liveTabs,
                        null,
                        keep
                    )
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

/** The `play` render option, when playback is on, with the note's timed-bar hook when it has one. */
const playOf = (
    play: PlayOptions | false,
    timedBar: PlayOptions['timedBar'] | null = null
): { play?: PlayOptions } => (play ? { play: timedBar ? { ...play, timedBar } : play } : {})
