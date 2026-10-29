import script from 'virtual:alphatab-script'
import font from 'virtual:alphatab-font'
import soundfont from 'virtual:alphatab-soundfont'
import { createSoundfontPlayer } from '@dsebastien/music-notation/tab'
import type { AlphaTabModule, TabAssets } from '@dsebastien/music-notation/tab'
import type { NotePlayer } from '@dsebastien/music-notation'

export type AlphaTabWindow = Window & { alphaTab?: AlphaTabModule }

/** A window's own URL and Blob (popouts have theirs). */
const webOf = (win: Window) => win as Window & { URL: typeof URL; Blob: typeof Blob }

/**
 * alphaTab, embedded in the plugin (#15): loaded into a window the first time it draws a tab or
 * plays through the soundfont, from a blob URL (which also starts its workers). Popout windows
 * get their own copy. Nothing is fetched from the network.
 */
export class AlphaTabRuntime {
    private readonly modules = new Map<AlphaTabWindow, Promise<AlphaTabModule>>()
    private readonly urls = new Map<AlphaTabWindow, string>()
    private readonly players = new Map<AlphaTabWindow, NotePlayer>()
    private soundFont: Uint8Array | null = null

    /** alphaTab in this window, loaded once. */
    module(win: AlphaTabWindow): Promise<AlphaTabModule> {
        const existing = this.modules.get(win)
        if (existing) return existing
        const loading = new Promise<AlphaTabModule>((resolve, reject) => {
            if (win.alphaTab) {
                resolve(win.alphaTab)
                return
            }
            const tag = win.document.head.createEl('script')
            tag.onload = () =>
                win.alphaTab ? resolve(win.alphaTab) : reject(new Error('alphaTab did not load'))
            tag.onerror = () => reject(new Error('alphaTab did not load'))
            tag.src = this.scriptUrl(win)
        })
        this.modules.set(win, loading)
        // A failed load can be tried again later.
        loading.catch(() => this.modules.delete(win))
        return loading
    }

    private scriptUrl(win: AlphaTabWindow): string {
        let url = this.urls.get(win)
        if (!url) {
            const web = webOf(win)
            url = web.URL.createObjectURL(new web.Blob([script], { type: 'text/javascript' }))
            this.urls.set(win, url)
        }
        return url
    }

    /** The font, soundfont and worker script alphaTab needs, for this window. */
    assets(win: AlphaTabWindow): TabAssets {
        this.soundFont ??= Uint8Array.from(atob(soundfont), (c) => c.charCodeAt(0))
        return { scriptFile: this.scriptUrl(win), font, soundFont: this.soundFont }
    }

    /**
     * The diagrams' realistic sound in this window: alphaTab's synthesizer with the soundfont,
     * started on the first play (the first notes wait for it).
     */
    player(win: AlphaTabWindow): NotePlayer {
        const existing = this.players.get(win)
        if (existing) return existing
        let inner: NotePlayer | null = null
        const player: NotePlayer = {
            play: (events, options) => {
                let handle: { stop(): void } | null = null
                let stopped = false
                void this.module(win).then((alphaTab) => {
                    inner ??= createSoundfontPlayer(alphaTab, this.assets(win), win.document)
                    if (!stopped) handle = inner.play(events, options)
                })
                return {
                    stop() {
                        stopped = true
                        handle?.stop()
                    }
                }
            }
        }
        this.players.set(win, player)
        return player
    }

    /** Frees the blob URLs and the hidden players (the plugin unloads). */
    unload(): void {
        for (const [win, url] of this.urls) webOf(win).URL.revokeObjectURL(url)
        for (const win of this.players.keys())
            win.document.querySelectorAll('.mn-tab-hidden').forEach((el) => el.remove())
        this.urls.clear()
        this.players.clear()
        this.modules.clear()
    }
}
