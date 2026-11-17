import { describe, expect, it } from 'bun:test'
import { PackError, SoundPackService } from './sound-pack.service'
import type { PackStore } from './sound-pack.service'
import { PACK_MARKER, markerOf } from '../domain/sound-pack'
import type { SoundPack } from '../domain/sound-pack'

/** The plugin's folder in a vault whose configuration folder is named `config`. */
const PLUGIN = 'config/plugins/music-practice'
const FOLDER = `${PLUGIN}/sounds/generaluser`
const URL = 'https://example.test/pack/'

const bytesOf = (text: string): ArrayBuffer => {
    const bytes = new TextEncoder().encode(text)
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return buffer
}
const textOf = (bytes: ArrayBuffer): string => new TextDecoder().decode(bytes)
/** A stand-in for SHA-256 (the service is given its hash): different bytes, different text. */
const sha256 = (bytes: ArrayBuffer): string =>
    new Uint8Array(bytes).reduce((sum, byte) => (sum * 31 + byte) >>> 0, 7).toString(16)

/** A pack of three small files, with their content. */
const CONTENT: Record<string, string> = {
    'index.json': '{"programs":{}}',
    'p000.sf3': 'piano',
    'p025.sf3': 'steel guitar'
}
const packOf = (version = '1.0.0'): SoundPack => ({
    name: 'Test pack',
    version,
    url: URL,
    license: 'Test license',
    files: Object.entries(CONTENT).map(([name, text]) => ({
        name,
        size: bytesOf(text).byteLength,
        sha256: sha256(bytesOf(text))
    }))
})

/** A vault's files in memory: paths to bytes, and the folders made. */
function fakeStore() {
    const files = new Map<string, ArrayBuffer>()
    const folders = new Set<string>()
    const under = (path: string, of: string) => path.startsWith(`${of}/`)
    const store: PackStore = {
        exists: (path) => Promise.resolve(files.has(path) || folders.has(path)),
        mkdir: (path) => {
            folders.add(path)
            return Promise.resolve()
        },
        read: (path) => {
            const data = files.get(path)
            return data ? Promise.resolve(textOf(data)) : Promise.reject(new Error('ENOENT'))
        },
        write: (path, data) => {
            files.set(path, bytesOf(data))
            return Promise.resolve()
        },
        readBinary: (path) => {
            const data = files.get(path)
            return data ? Promise.resolve(data) : Promise.reject(new Error('ENOENT'))
        },
        writeBinary: (path, data) => {
            files.set(path, data)
            return Promise.resolve()
        },
        list: (path) =>
            Promise.resolve({
                files: [...files.keys()].filter(
                    (file) => under(file, path) && !file.slice(path.length + 1).includes('/')
                ),
                folders: [...folders].filter(
                    (folder) => under(folder, path) && !folder.slice(path.length + 1).includes('/')
                )
            }),
        remove: (path) => {
            files.delete(path)
            return Promise.resolve()
        },
        rmdir: (path, recursive) => {
            // As Obsidian's adapter on desktop: without `recursive`, a folder is refused.
            if (!recursive) return Promise.reject(new Error('rm returned EISDIR (is a directory)'))
            if (recursive) {
                for (const file of [...files.keys()]) if (under(file, path)) files.delete(file)
                for (const folder of [...folders]) if (under(folder, path)) folders.delete(folder)
            }
            folders.delete(path)
            return Promise.resolve()
        }
    }
    return { store, files, folders }
}

/** A network that serves the pack's files; `served` overrides one, `fail` rejects one. */
function fakeNetwork(served: Record<string, string> = {}, fail: string[] = []) {
    const asked: string[] = []
    const fetch = (url: string): Promise<ArrayBuffer> => {
        const name = url.slice(URL.length)
        asked.push(name)
        if (fail.includes(name)) return Promise.reject(new Error('offline'))
        return Promise.resolve(bytesOf(served[name] ?? CONTENT[name] ?? ''))
    }
    return { fetch, asked }
}

function serviceOf(
    options: {
        store?: ReturnType<typeof fakeStore>
        network?: ReturnType<typeof fakeNetwork>
        pack?: SoundPack
        parallel?: number
    } = {}
) {
    const vault = options.store ?? fakeStore()
    const network = options.network ?? fakeNetwork()
    const service = new SoundPackService({
        store: vault.store,
        folder: FOLDER,
        fetch: network.fetch,
        hash: (bytes) => Promise.resolve(sha256(bytes)),
        pack: options.pack ?? packOf(),
        parallel: options.parallel ?? 2
    })
    return { service, vault, network }
}

const failureOf = async (run: Promise<unknown>): Promise<PackError | null> => {
    try {
        await run
        return null
    } catch (error) {
        return error instanceof PackError ? error : null
    }
}

describe('SoundPackService (#100)', () => {
    it('finds nothing on a device that never had the pack, and reads none of its files', async () => {
        const { service, network } = serviceOf()
        expect(await service.refresh()).toBe('absent')
        expect(service.instruments()).toBeNull()
        expect(await service.source('index.json')).toBeNull()
        expect(network.asked).toEqual([])
    })

    it('downloads every file, then marks the folder as whole', async () => {
        const { service, vault, network } = serviceOf()
        await service.download()
        expect(network.asked.sort()).toEqual(Object.keys(CONTENT).sort())
        for (const [name, text] of Object.entries(CONTENT))
            expect(textOf(vault.files.get(`${FOLDER}/${name}`)!)).toBe(text)
        expect(textOf(vault.files.get(`${FOLDER}/${PACK_MARKER}`)!)).toBe(markerOf(packOf()))
        expect(service.state).toBe('installed')
        expect(service.downloading).toBe(false)
        expect(service.progress).toBeNull()
        // Every folder above was made, the plugin's `sounds` folder too.
        expect(vault.folders.has(`${PLUGIN}/sounds`)).toBe(true)
    })

    it('reads a file of a whole pack for the library, and nothing outside its folder', async () => {
        const { service, vault } = serviceOf()
        await service.download()
        const source = service.instruments()
        expect(source).not.toBeNull()
        expect(new TextDecoder().decode((await source!('p025.sf3'))!)).toBe('steel guitar')
        expect(await source!('p099.sf3')).toBeNull()
        vault.files.set(`${PLUGIN}/data.json`, bytesOf('secret'))
        expect(await source!('../../data.json')).toBeNull()
    })

    it('says how far it is while it runs, and tells its listeners', async () => {
        const { service } = serviceOf({ parallel: 1 })
        const seen: number[] = []
        const stop = service.onChange(() => {
            if (service.progress) seen.push(service.progress.done)
        })
        await service.download()
        const total = packOf().files.reduce((sum, file) => sum + file.size, 0)
        expect(seen[0]).toBe(0)
        expect(seen[seen.length - 1]).toBe(total)
        expect([...seen].sort((a, b) => a - b)).toEqual(seen)
        stop()
    })

    it('refuses a file whose bytes are not the ones expected, and writes nothing of it', async () => {
        const network = fakeNetwork({ 'p025.sf3': 'something else' })
        const { service, vault } = serviceOf({ network, parallel: 1 })
        const failure = await failureOf(service.download())
        expect(failure?.failure).toBe('checksum')
        expect(failure?.file).toBe('p025.sf3')
        expect(vault.files.has(`${FOLDER}/p025.sf3`)).toBe(false)
        expect(vault.files.has(`${FOLDER}/${PACK_MARKER}`)).toBe(false)
        expect(service.state).toBe('partial')
        // A pack that isn't whole plays nothing: the built-in soundfont stays.
        expect(service.instruments()).toBeNull()
        expect(await service.source('index.json')).toBeNull()
    })

    it('refuses a file of the right size and other bytes', async () => {
        const network = fakeNetwork({ 'p000.sf3': 'PIANO' })
        const failure = await failureOf(serviceOf({ network, parallel: 1 }).service.download())
        expect(failure?.failure).toBe('checksum')
        expect(failure?.file).toBe('p000.sf3')
    })

    it('names the file a failed request was for, and goes on from there the next time', async () => {
        const vault = fakeStore()
        const offline = fakeNetwork({}, ['p025.sf3'])
        const first = serviceOf({ store: vault, network: offline, parallel: 1 })
        const failure = await failureOf(first.service.download())
        expect(failure?.failure).toBe('network')
        expect(failure?.file).toBe('p025.sf3')
        expect(first.service.state).toBe('partial')

        const online = fakeNetwork()
        const second = serviceOf({ store: vault, network: online, parallel: 1 })
        expect(await second.service.refresh()).toBe('partial')
        await second.service.download()
        // Only what was missing is asked for again.
        expect(online.asked).toEqual(['p025.sf3'])
        expect(second.service.state).toBe('installed')
    })

    it('downloads a file again when the one in the folder is damaged', async () => {
        const vault = fakeStore()
        await serviceOf({ store: vault }).service.download()
        vault.files.set(`${FOLDER}/p000.sf3`, bytesOf('broken'))
        const network = fakeNetwork()
        const { service } = serviceOf({ store: vault, network })
        await service.download()
        expect(network.asked).toEqual(['p000.sf3'])
        expect(textOf(vault.files.get(`${FOLDER}/p000.sf3`)!)).toBe('piano')
    })

    it('stops when cancelled, keeps the files it got, and is not whole', async () => {
        const { service, vault, network } = serviceOf({ parallel: 1 })
        const stop = service.onChange(() => {
            if (service.progress && service.progress.done > 0) service.cancel()
        })
        const failure = await failureOf(service.download())
        stop()
        expect(failure?.failure).toBe('cancelled')
        expect(network.asked).toHaveLength(1)
        expect(vault.files.has(`${FOLDER}/${network.asked[0]!}`)).toBe(true)
        expect(service.state).toBe('partial')
    })

    it('joins the download that runs when asked again', async () => {
        const { service, network } = serviceOf()
        const first = service.download()
        expect(service.downloading).toBe(true)
        expect(service.download()).toBe(first)
        await first
        expect(network.asked).toHaveLength(3)
    })

    it('plays the pack of an older release, and takes the marker away while it updates', async () => {
        const vault = fakeStore()
        await serviceOf({ store: vault, pack: packOf('0.9.0') }).service.download()

        const offline = fakeNetwork({}, ['p000.sf3'])
        // The new release changed one file.
        const next = packOf('1.0.0')
        const changed: SoundPack = {
            ...next,
            files: next.files.map((file) =>
                file.name === 'p000.sf3'
                    ? {
                          ...file,
                          size: bytesOf('grand').byteLength,
                          sha256: sha256(bytesOf('grand'))
                      }
                    : file
            )
        }
        const { service } = serviceOf({ store: vault, network: offline, pack: changed })
        expect(await service.refresh()).toBe('outdated')
        expect(service.instruments()).not.toBeNull()

        expect((await failureOf(service.download()))?.failure).toBe('network')
        expect(vault.files.has(`${FOLDER}/${PACK_MARKER}`)).toBe(false)
        expect(service.state).toBe('partial')

        const online = fakeNetwork({ 'p000.sf3': 'grand' })
        const again = serviceOf({ store: vault, network: online, pack: changed })
        await again.service.download()
        expect(online.asked).toEqual(['p000.sf3'])
        expect(again.service.state).toBe('installed')
    })

    it('removes the pack, and the folder above it when that left it empty', async () => {
        const { service, vault } = serviceOf()
        await service.download()
        await service.remove()
        expect([...vault.files.keys()]).toEqual([])
        expect(vault.folders.has(FOLDER)).toBe(false)
        expect(vault.folders.has(`${PLUGIN}/sounds`)).toBe(false)
        expect(vault.folders.has(PLUGIN)).toBe(true)
        expect(service.state).toBe('absent')
        expect(service.instruments()).toBeNull()
    })

    it('leaves the folder above when it holds something else', async () => {
        const { service, vault } = serviceOf()
        await service.download()
        vault.files.set(`${PLUGIN}/sounds/mine.sf2`, bytesOf('mine'))
        await service.remove()
        expect(vault.folders.has(`${PLUGIN}/sounds`)).toBe(true)
        expect(vault.files.has(`${PLUGIN}/sounds/mine.sf2`)).toBe(true)
    })

    it('still removes the pack when the folder above it cannot go', async () => {
        const vault = fakeStore()
        const { service } = serviceOf({ store: vault })
        await service.download()
        const rmdir = vault.store.rmdir
        vault.store.rmdir = (path, recursive) =>
            path === FOLDER ? rmdir(path, recursive) : Promise.reject(new Error('busy'))
        await service.remove()
        expect(service.state).toBe('absent')
        expect(vault.folders.has(FOLDER)).toBe(false)
        expect(vault.folders.has(`${PLUGIN}/sounds`)).toBe(true)
    })

    it('stops a running download before it removes the pack', async () => {
        const { service, vault } = serviceOf({ parallel: 1 })
        const running = failureOf(service.download())
        await service.remove()
        expect((await running)?.failure).toBe('cancelled')
        expect([...vault.files.keys()]).toEqual([])
        expect(service.state).toBe('absent')
    })

    it('says when the folder cannot be written', async () => {
        const vault = fakeStore()
        vault.store.writeBinary = () => Promise.reject(new Error('disk full'))
        const failure = await failureOf(serviceOf({ store: vault, parallel: 1 }).service.download())
        expect(failure?.failure).toBe('storage')
    })
})
