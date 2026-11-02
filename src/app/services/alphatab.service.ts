import script from 'virtual:alphatab-script'
import font from 'virtual:alphatab-font'
import soundfont from 'virtual:alphatab-soundfont'
import { ALPHATAB_VERSION, createSoundfontPlayer } from '@dsebastien/music-notation/tab'
import type { AlphaTabModule, SoundfontPlayer, TabAssets } from '@dsebastien/music-notation/tab'
import { lightPlayer } from '@dsebastien/music-notation'
import type { NotePlayer } from '@dsebastien/music-notation'

export type AlphaTabWindow = Window & { alphaTab?: AlphaTabModule }

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
    url?: string
    player?: NotePlayer
    soundfont?: SoundfontPlayer
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

    constructor(private readonly deps: RuntimeDeps = DEFAULT_DEPS) {}

    private state(win: AlphaTabWindow): WindowState {
        let state = this.windows.get(win)
        if (!state) {
            state = {}
            this.windows.set(win, state)
        }
        return state
    }

    /**
     * alphaTab in this window, loaded once. Another plugin's alphaTab of another release is left
     * alone (both can't share the window's `alphaTab`): tabs then say so instead of breaking.
     */
    module(win: AlphaTabWindow): Promise<AlphaTabModule> {
        const state = this.state(win)
        if (state.module) return state.module
        const loading = new Promise<AlphaTabModule>((resolve, reject) => {
            const check = (module: AlphaTabModule) => {
                const version = versionOf(module)
                if (version && version !== ALPHATAB_VERSION)
                    reject(
                        new Error(
                            `another plugin loaded alphaTab ${version}; Music Practice needs ${ALPHATAB_VERSION}`
                        )
                    )
                else resolve(module)
            }
            if (win.alphaTab) {
                check(win.alphaTab)
                return
            }
            const tag = win.document.head.createEl('script')
            state.tag = tag
            tag.onload = () =>
                win.alphaTab ? check(win.alphaTab) : reject(new Error('alphaTab did not load'))
            tag.onerror = () => reject(new Error('alphaTab did not load'))
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

    /** The font, soundfont and worker script alphaTab needs, for this window. */
    assets(win: AlphaTabWindow): TabAssets {
        this.soundFont ??= Uint8Array.from(atob(this.deps.soundfont), (c) => c.charCodeAt(0))
        return { scriptFile: this.scriptUrl(win), font: this.deps.font, soundFont: this.soundFont }
    }

    /**
     * The diagrams' realistic sound in this window: alphaTab's synthesizer with the soundfont,
     * started on the first play (the first notes wait for it); the light synthesizer when alphaTab
     * or the soundfont can't load.
     */
    player(win: AlphaTabWindow): NotePlayer {
        const state = this.state(win)
        if (state.player) return state.player
        const fallback = this.deps.fallback(win)
        const player: NotePlayer = {
            play: (events, options) => {
                let handle: { stop(): void } | null = null
                let stopped = false
                this.module(win)
                    .then((alphaTab) => {
                        if (stopped || this.windows.get(win) !== state) return
                        state.soundfont ??= this.deps.makePlayer(
                            alphaTab,
                            this.assets(win),
                            win.document,
                            fallback
                        )
                        handle = state.soundfont.play(events, options)
                    })
                    .catch(() => {
                        if (!stopped) handle = fallback.play(events, options)
                    })
                return {
                    stop() {
                        stopped = true
                        handle?.stop()
                    }
                }
            }
        }
        state.player = player
        return player
    }

    /** Frees what this window holds: the hidden player, the blob URL, the alphaTab it loaded. */
    release(win: AlphaTabWindow): void {
        const state = this.windows.get(win)
        if (!state) return
        this.windows.delete(win)
        try {
            state.soundfont?.destroy()
        } catch {
            // The window is already gone.
        }
        if (state.url) webOf(win).URL.revokeObjectURL(state.url)
        if (state.tag) {
            state.tag.remove()
            // Only the alphaTab this plugin loaded, so a new version of the plugin loads its own.
            if (win.alphaTab) delete win.alphaTab
        }
    }

    /** The windows it loaded into (for tests and checks). */
    loadedWindows(): AlphaTabWindow[] {
        return [...this.windows.keys()]
    }

    /** The plugin unloads: every window is freed. */
    unload(): void {
        for (const win of [...this.windows.keys()]) this.release(win)
    }
}
