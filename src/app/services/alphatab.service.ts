import { t } from '../i18n/i18n'
import script from 'virtual:alphatab-script'
import font from 'virtual:alphatab-font'
import soundfont from 'virtual:alphatab-soundfont'
import {
    ALPHATAB_VERSION,
    createSoundfontPlayer,
    engineAssets
} from '@dsebastien/music-notation/tab'
import type { AlphaTabModule, SoundfontPlayer, TabAssets } from '@dsebastien/music-notation/tab'
import { lightPlayer } from '@dsebastien/music-notation'
import type { InstrumentSource, NotePlayer } from '@dsebastien/music-notation'

export type AlphaTabWindow = Window & { alphaTab?: AlphaTabModule }

/**
 * The recorded sounds a window plays through alphaTab (the library's engine names): the sound
 * pack's instrument files (`generaluser`, #100) or the built-in soundfont (`sonivox`).
 */
export type SampleEngine = 'generaluser' | 'sonivox'

/** A window's own URL and Blob (popouts have theirs). */
const webOf = (win: Window) => win as Window & { URL: typeof URL; Blob: typeof Blob }

/** The alphaTab release a module is (its `meta.version`); null when it doesn't say. */
export const versionOf = (module: AlphaTabModule): string | null => {
    const meta: unknown = Reflect.get(module, 'meta')
    const version: unknown =
        typeof meta === 'object' && meta !== null ? Reflect.get(meta, 'version') : null
    return typeof version === 'string' ? version : null
}

/** What the runtime made in one window, to free it when the window closes or the plugin unloads. */
interface WindowState {
    module?: Promise<AlphaTabModule>
    /** The script tag this plugin added (absent when alphaTab was already there). */
    tag?: HTMLScriptElement
    /** The alphaTab our script set as `window.alphaTab` (only that one is removed again). */
    ours?: AlphaTabModule
    url?: string
    /** The players handed out, by engine. */
    players?: Partial<Record<SampleEngine, NotePlayer>>
    /** The hidden alphaTab players made at a first play, by the sounds they hold. */
    soundfonts?: Partial<Record<SampleEngine, SoundfontPlayer>>
}

/** How the runtime loads scripts and makes the soundfont player; replaced in tests. */
export interface RuntimeDeps {
    script: string
    font: string
    soundfont: string
    makePlayer: typeof createSoundfontPlayer
    fallback: (win: Window) => NotePlayer
}

const DEFAULT_DEPS: RuntimeDeps = {
    script,
    font,
    soundfont,
    makePlayer: createSoundfontPlayer,
    fallback: (win) => lightPlayer(win)
}

/**
 * alphaTab, embedded in the plugin (#15): loaded into a window the first time it draws a tab or
 * plays through the soundfont, from a blob URL (which also starts its workers). Popout windows
 * get their own copy, freed when they close. Nothing is fetched from the network.
 */
export class AlphaTabRuntime {
    private readonly windows = new Map<AlphaTabWindow, WindowState>()
    private soundFont: Uint8Array | null = null
    /** The sound pack's files (#100); null while the pack isn't on this device. */
    private instruments: InstrumentSource | null = null

    constructor(private readonly deps: RuntimeDeps = DEFAULT_DEPS) {}

    /** Windows freed (closed popouts, or all of them once the plugin unloaded). */
    private readonly released = new WeakSet<AlphaTabWindow>()
    private unloaded = false

    private isReleased(win: AlphaTabWindow): boolean {
        return this.unloaded || this.released.has(win)
    }

    private state(win: AlphaTabWindow): WindowState {
        let state = this.windows.get(win)
        if (!state) {
            state = {}
            // A freed window is never tracked again (that would keep a closed popout alive).
            if (!this.isReleased(win)) this.windows.set(win, state)
        }
        return state
    }

    /**
     * alphaTab in this window, loaded once. Another plugin's alphaTab is used only when it's the
     * same release (both can't share the window's `alphaTab`): tabs then say so instead of
     * breaking.
     */
    module(win: AlphaTabWindow): Promise<AlphaTabModule> {
        if (this.isReleased(win))
            return Promise.reject(new Error(t('texttab.alphatab.windowClosed')))
        const state = this.state(win)
        if (state.module) return state.module
        const loading = new Promise<AlphaTabModule>((resolve, reject) => {
            if (win.alphaTab) {
                const version = versionOf(win.alphaTab)
                if (version === ALPHATAB_VERSION) resolve(win.alphaTab)
                else
                    reject(
                        new Error(
                            t('texttab.alphatab.otherPlugin', {
                                version: version ?? t('texttab.alphatab.unknownRelease'),
                                needed: ALPHATAB_VERSION
                            })
                        )
                    )
                return
            }
            const tag = win.document.head.createEl('script')
            state.tag = tag
            // alphaTab's UMD registers with an AMD loader instead of `window.alphaTab` when one is
            // on the page (Monaco-based plugins): hidden while our script runs.
            const amd = win as AlphaTabWindow & { define?: { amd?: unknown } }
            const define = amd.define?.amd ? amd.define : undefined
            if (define) amd.define = undefined
            const restore = () => {
                if (define && amd.define === undefined) amd.define = define
            }
            const failed = (message: string) => {
                restore()
                tag.remove()
                if (state.tag === tag) delete state.tag
                reject(new Error(message))
            }
            tag.onload = () => {
                restore()
                const loaded = win.alphaTab
                if (!loaded) {
                    failed(t('texttab.alphatab.notLoaded'))
                    return
                }
                // Freed while loading: the script still ran; take its alphaTab away again.
                if (this.isReleased(win) || this.windows.get(win) !== state) {
                    delete win.alphaTab
                    failed(t('texttab.alphatab.windowClosed'))
                    return
                }
                // Our own script: the release this plugin embeds, no check needed.
                state.ours = loaded
                resolve(loaded)
            }
            tag.onerror = () => failed(t('texttab.alphatab.notLoaded'))
            tag.src = this.scriptUrl(win)
        })
        state.module = loading
        // A failed load can be tried again later.
        loading.catch(() => {
            if (state.module === loading) delete state.module
        })
        return loading
    }

    private scriptUrl(win: AlphaTabWindow): string {
        const state = this.state(win)
        if (!state.url) {
            const web = webOf(win)
            state.url = web.URL.createObjectURL(
                new web.Blob([this.deps.script], { type: 'text/javascript' })
            )
        }
        return state.url
    }

    /**
     * The sound pack came or went (#100): tabs and diagrams drawn from now on play with or
     * without its files. The hidden players that hold the pack's sounds are freed; the ones with
     * the built-in soundfont stay.
     */
    setInstruments(source: InstrumentSource | null): void {
        if (this.instruments === source) return
        this.instruments = source
        for (const state of this.windows.values()) {
            const held = state.soundfonts?.generaluser
            if (!held) continue
            delete state.soundfonts?.generaluser
            try {
                held.destroy()
            } catch {
                // Already gone with its window.
            }
        }
    }

    /** Whether the sound pack's files are at hand. */
    hasInstruments(): boolean {
        return this.instruments !== null
    }

    /**
     * The font, soundfont and worker script alphaTab needs, for this window, and the sound pack's
     * files when they are on this device: the library then plays them (its `generaluser` engine)
     * and keeps the built-in soundfont for what the pack can't give.
     */
    assets(win: AlphaTabWindow): TabAssets {
        this.soundFont ??= Uint8Array.from(atob(this.deps.soundfont), (c) => c.charCodeAt(0))
        return {
            scriptFile: this.scriptUrl(win),
            font: this.deps.font,
            soundFont: this.soundFont,
            ...(this.instruments ? { instruments: this.instruments } : {})
        }
    }

    /**
     * The diagrams' realistic sound in this window: alphaTab's synthesizer, started on the first
     * play (the first notes wait for it), with the built-in soundfont (`sonivox`) or the sound
     * pack's files (`generaluser`; the built-in soundfont while the pack isn't there); the light
     * synthesizer when alphaTab or the sounds can't load.
     */
    player(win: AlphaTabWindow, engine: SampleEngine = 'sonivox'): NotePlayer {
        const fallback = () => this.deps.fallback(win)
        if (this.isReleased(win)) return fallback()
        const state = this.state(win)
        const known = state.players?.[engine]
        if (known) return known
        const light = fallback()
        const player: NotePlayer = {
            // The soundfont player says when its notes really start (after the soundfont loads),
            // so lit notes wait for the sound (#41).
            reportsStart: true,
            play: (events, options) => {
                let handle: { stop(): void } | null = null
                let stopped = false
                this.module(win)
                    .then((alphaTab) => {
                        if (stopped || this.windows.get(win) !== state) return
                        // Read at each play: the pack may have come or gone since the bar was drawn.
                        const sounds: SampleEngine =
                            engine === 'generaluser' && this.instruments ? 'generaluser' : 'sonivox'
                        const soundfonts = (state.soundfonts ??= {})
                        soundfonts[sounds] ??= this.deps.makePlayer(
                            alphaTab,
                            engineAssets(this.assets(win), sounds),
                            win.document,
                            light
                        )
                        handle = soundfonts[sounds].play(events, options)
                    })
                    .catch(() => {
                        if (!stopped) handle = light.play(events, options)
                    })
                return {
                    stop() {
                        stopped = true
                        handle?.stop()
                    }
                }
            }
        }
        ;(state.players ??= {})[engine] = player
        return player
    }

    /** Frees what this window holds: the hidden player, the blob URL, the alphaTab it loaded. */
    release(win: AlphaTabWindow): void {
        this.released.add(win)
        const state = this.windows.get(win)
        if (!state) return
        this.windows.delete(win)
        // The window may be closing already: each step on its own.
        const attempt = (step: () => void) => {
            try {
                step()
            } catch {
                // Already gone with the window.
            }
        }
        for (const held of Object.values(state.soundfonts ?? {})) attempt(() => held.destroy())
        if (state.url) attempt(() => webOf(win).URL.revokeObjectURL(state.url!))
        if (state.tag) attempt(() => state.tag!.remove())
        // Only the alphaTab our script set, so another plugin's stays and a new version of this
        // plugin loads its own.
        if (state.ours)
            attempt(() => {
                if (win.alphaTab === state.ours) delete win.alphaTab
            })
    }

    /** The windows it loaded into (for tests and checks). */
    loadedWindows(): AlphaTabWindow[] {
        return [...this.windows.keys()]
    }

    /** The plugin unloads: every window is freed. */
    unload(): void {
        for (const win of [...this.windows.keys()]) this.release(win)
        this.unloaded = true
    }
}
