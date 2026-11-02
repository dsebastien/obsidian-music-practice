import { describe, expect, it } from 'bun:test'
import { AlphaTabRuntime, versionOf } from './alphatab.service'
import type { AlphaTabWindow, RuntimeDeps } from './alphatab.service'
import type { AlphaTabModule } from '@dsebastien/music-notation/tab'
import type { NoteEvent, NotePlayer } from '@dsebastien/music-notation'

/** A test double typed as what it stands in for (it only has what the code under test reads). */
const fake = <T>(value: unknown): T => value as T

const moduleOf = (version: string | null) =>
    fake<AlphaTabModule>(version ? { meta: { version } } : {})

/**
 * A window whose script tags "load" at once: `loads` is what the script sets as `alphaTab`
 * (undefined: the script fails).
 */
function fakeWindow(loads: AlphaTabModule | undefined) {
    const revoked: string[] = []
    const tags: { removed: boolean }[] = []
    let made = 0
    const win = fake<AlphaTabWindow>({
        URL: {
            createObjectURL: () => `blob:${++made}`,
            revokeObjectURL: (url: string) => revoked.push(url)
        },
        Blob: class {
            constructor(_parts: unknown[], _options: unknown) {}
        },
        document: {
            head: {
                createEl: () => {
                    const tag = {
                        removed: false,
                        onload: null as (() => void) | null,
                        onerror: null as (() => void) | null,
                        remove() {
                            tag.removed = true
                        },
                        set src(_url: string) {
                            queueMicrotask(() => {
                                if (loads) {
                                    win.alphaTab = loads
                                    tag.onload?.()
                                } else tag.onerror?.()
                            })
                        }
                    }
                    tags.push(tag)
                    return tag
                }
            }
        }
    })
    return { win, revoked, tags }
}

/** Runtime dependencies that record the soundfont players made and destroyed. */
function fakeDeps() {
    const played: string[] = []
    let destroyed = 0
    const recorder = (name: string): NotePlayer => ({
        play: (events: NoteEvent[]) => {
            played.push(`${name}:${events.length}`)
            return { stop() {} }
        }
    })
    const deps: RuntimeDeps = {
        script: 'script',
        font: 'data:font/woff2;base64,',
        soundfont: '',
        makePlayer: () => ({
            ...recorder('soundfont'),
            destroy: () => {
                destroyed++
            }
        }),
        fallback: () => recorder('light')
    }
    return { deps, played, destroyed: () => destroyed }
}

/** Lets queued microtasks (script loads, promise chains) run. */
const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}
const events: NoteEvent[] = [{ midi: 60, time: 0, duration: 1 }]

describe('versionOf', () => {
    it("reads alphaTab's meta.version", () => {
        expect(versionOf(moduleOf('1.8.4'))).toBe('1.8.4')
        expect(versionOf(moduleOf(null))).toBeNull()
    })
})

describe('AlphaTabRuntime', () => {
    it('loads alphaTab once per window, from a blob URL', async () => {
        const { win, tags } = fakeWindow(moduleOf('1.8.4'))
        const runtime = new AlphaTabRuntime(fakeDeps().deps)
        const [a, b] = await Promise.all([runtime.module(win), runtime.module(win)])
        expect(a).toBe(b)
        expect(tags).toHaveLength(1)
        expect(runtime.assets(win).scriptFile).toBe('blob:1')
    })

    it("uses another plugin's alphaTab of the same release, and refuses another release", async () => {
        const same = fakeWindow(undefined)
        same.win.alphaTab = moduleOf('1.8.4')
        const runtime = new AlphaTabRuntime(fakeDeps().deps)
        expect(await runtime.module(same.win)).toBe(same.win.alphaTab)
        expect(same.tags).toHaveLength(0)

        const other = fakeWindow(undefined)
        other.win.alphaTab = moduleOf('1.6.0')
        let message = ''
        await runtime.module(other.win).catch((e: Error) => (message = e.message))
        expect(message).toContain('alphaTab 1.6.0')
    })

    it('tries a failed load again', async () => {
        const { win, tags } = fakeWindow(undefined)
        const runtime = new AlphaTabRuntime(fakeDeps().deps)
        await runtime.module(win).catch(() => {})
        await runtime.module(win).catch(() => {})
        expect(tags).toHaveLength(2)
    })

    it('plays through the soundfont, or the light synthesizer when alphaTab is missing', async () => {
        const fake = fakeDeps()
        const runtime = new AlphaTabRuntime(fake.deps)
        runtime
            .player(fakeWindow(moduleOf('1.8.4')).win)
            .play(events, { sound: 'guitar', volume: 1 })
        runtime.player(fakeWindow(undefined).win).play(events, { sound: 'guitar', volume: 1 })
        await flush()
        expect(fake.played.sort()).toEqual(['light:1', 'soundfont:1'])
    })

    it('frees a closed window: its player, its blob URL, the script and alphaTab it loaded', async () => {
        const fake = fakeDeps()
        const { win, revoked, tags } = fakeWindow(moduleOf('1.8.4'))
        const runtime = new AlphaTabRuntime(fake.deps)
        runtime.player(win).play(events, { sound: 'piano', volume: 1 })
        await flush()
        runtime.release(win)
        expect(fake.destroyed()).toBe(1)
        expect(revoked).toEqual(['blob:1'])
        expect(tags[0]!.removed).toBe(true)
        expect(win.alphaTab).toBeUndefined()
        expect(runtime.loadedWindows()).toEqual([])
    })

    it("leaves another plugin's alphaTab in place when it frees a window", async () => {
        const { win } = fakeWindow(undefined)
        const theirs = moduleOf('1.8.4')
        win.alphaTab = theirs
        const runtime = new AlphaTabRuntime(fakeDeps().deps)
        await runtime.module(win)
        runtime.unload()
        expect(win.alphaTab).toBe(theirs)
    })
})
