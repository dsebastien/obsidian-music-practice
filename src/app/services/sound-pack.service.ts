import {
    PACK_MARKER,
    SOUND_PACK,
    isPackFileName,
    markerOf,
    packBytes,
    packFileUrl,
    packPlays,
    packStateOf
} from '../domain/sound-pack'
import type { PackFile, PackProgress, PackState, SoundPack } from '../domain/sound-pack'

/** The part of Obsidian's `DataAdapter` the pack needs (paths from the vault's root). */
export interface PackStore {
    exists(path: string): Promise<boolean>
    mkdir(path: string): Promise<void>
    read(path: string): Promise<string>
    write(path: string, data: string): Promise<void>
    readBinary(path: string): Promise<ArrayBuffer>
    writeBinary(path: string, data: ArrayBuffer): Promise<void>
    list(path: string): Promise<{ files: string[]; folders: string[] }>
    remove(path: string): Promise<void>
    rmdir(path: string, recursive: boolean): Promise<void>
}

export interface PackDeps {
    store: PackStore
    /** The pack's folder, from the vault's root, without a slash at the end. */
    folder: string
    /** The bytes at an address; rejects when the request fails. */
    fetch: (url: string) => Promise<ArrayBuffer>
    /** SHA-256 of bytes, in hex. */
    hash: (bytes: ArrayBuffer) => Promise<string>
    pack?: SoundPack
    /** Files asked for at the same time (4 by default). */
    parallel?: number
}

/** Why a download stopped; `file` is the one it stopped on. */
export type PackFailure = 'network' | 'checksum' | 'storage' | 'cancelled'

export class PackError extends Error {
    constructor(
        readonly failure: PackFailure,
        readonly file?: string,
        options?: ErrorOptions
    ) {
        super(file ? `sound pack: ${failure} (${file})` : `sound pack: ${failure}`, options)
        this.name = 'PackError'
    }
}

/**
 * The sound pack on this device (#100): downloads it on request, says what state it is in, reads
 * its files for the notation library, and removes it. The files live in the plugin's own folder,
 * so the state is read from that folder and never from the settings: another device of the same
 * vault may not have them.
 *
 * Every file is checked against the size and SHA-256 the plugin ships before it is written. A
 * download that stops keeps its good files, and the next one goes on from there.
 */
export class SoundPackService {
    private readonly pack: SoundPack
    private current: PackState = 'absent'
    private running: Promise<void> | null = null
    private cancelled = false
    private progressNow: PackProgress | null = null
    private readonly listeners = new Set<() => void>()

    constructor(private readonly deps: PackDeps) {
        this.pack = deps.pack ?? SOUND_PACK
    }

    /** The state last read from the folder (`refresh` reads it). */
    get state(): PackState {
        return this.current
    }

    /** How far the running download is; null when none runs. */
    get progress(): PackProgress | null {
        return this.progressNow
    }

    get downloading(): boolean {
        return this.running !== null
    }

    /** The pack's folder, from the vault's root. */
    get folder(): string {
        return this.deps.folder
    }

    /** Called when the state or the progress changed; returns what stops the calls. */
    onChange(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private changed(): void {
        for (const listener of [...this.listeners]) listener()
    }

    private path(name: string): string {
        return `${this.deps.folder}/${name}`
    }

    /** Reads the folder's state. A folder that can't be read counts as absent. */
    async refresh(): Promise<PackState> {
        const before = this.current
        this.current = await this.readState()
        if (this.current !== before) this.changed()
        return this.current
    }

    private async readState(): Promise<PackState> {
        const { store, folder } = this.deps
        try {
            if (!(await store.exists(folder))) return 'absent'
            const marker = (await store.exists(this.path(PACK_MARKER)))
                ? await store.read(this.path(PACK_MARKER))
                : null
            const listed = await store.list(folder)
            return packStateOf(marker, listed.files.length > 0, this.pack)
        } catch {
            return 'absent'
        }
    }

    /**
     * What the notation library reads the pack through: one of its files by name, null when the
     * pack isn't whole on this device or doesn't have that file. Null leaves the built-in
     * soundfont playing.
     */
    readonly source = async (file: string): Promise<Uint8Array | null> => {
        if (!packPlays(this.current) || !isPackFileName(file)) return null
        try {
            return new Uint8Array(await this.deps.store.readBinary(this.path(file)))
        } catch {
            return null
        }
    }

    /** The reader above while the pack plays, else null. */
    instruments(): ((file: string) => Promise<Uint8Array | null>) | null {
        return packPlays(this.current) ? this.source : null
    }

    /**
     * Downloads the files the folder lacks, each checked before it is written, then marks the
     * folder as whole. Rejects with a `PackError`; a second call while one runs joins it.
     */
    download(): Promise<void> {
        if (this.running) return this.running
        this.cancelled = false
        this.progressNow = { done: 0, total: packBytes(this.pack) }
        const run = (async (): Promise<void> => {
            try {
                await this.run()
            } finally {
                this.running = null
                this.progressNow = null
                // Read again whatever the end was, before the caller hears of it.
                this.current = await this.readState()
                this.changed()
            }
        })()
        this.running = run
        this.changed()
        return run
    }

    /** Stops the running download after the files it is on. */
    cancel(): void {
        if (this.running) this.cancelled = true
    }

    private async run(): Promise<void> {
        const { store } = this.deps
        try {
            await this.makeFolder()
            // No marker while files change: a download that stops never looks whole.
            if (await store.exists(this.path(PACK_MARKER)))
                await store.remove(this.path(PACK_MARKER))
        } catch (error) {
            throw new PackError('storage', undefined, { cause: error })
        }
        const queue = [...this.pack.files]
        const worker = async (): Promise<void> => {
            for (;;) {
                if (this.cancelled) throw new PackError('cancelled')
                const file = queue.shift()
                if (!file) return
                await this.bring(file)
                if (this.progressNow) {
                    this.progressNow = {
                        done: this.progressNow.done + file.size,
                        total: this.progressNow.total
                    }
                    this.changed()
                }
            }
        }
        const workers = Math.max(1, Math.min(this.deps.parallel ?? 4, queue.length))
        try {
            await Promise.all(Array.from({ length: workers }, worker))
        } catch (error) {
            // The other workers stop at their next file.
            this.cancelled = true
            throw error
        }
        try {
            await store.write(this.path(PACK_MARKER), markerOf(this.pack))
        } catch (error) {
            throw new PackError('storage', PACK_MARKER, { cause: error })
        }
    }

    /** One file: kept when the folder has it right, else downloaded, checked and written. */
    private async bring(file: PackFile): Promise<void> {
        const { store, fetch } = this.deps
        const path = this.path(file.name)
        try {
            if (
                (await store.exists(path)) &&
                (await this.matches(file, await store.readBinary(path)))
            )
                return
        } catch {
            // Unreadable: downloaded again.
        }
        let bytes: ArrayBuffer
        try {
            bytes = await fetch(packFileUrl(this.pack, file))
        } catch (error) {
            throw new PackError('network', file.name, { cause: error })
        }
        if (!(await this.matches(file, bytes))) throw new PackError('checksum', file.name)
        try {
            await store.writeBinary(path, bytes)
        } catch (error) {
            throw new PackError('storage', file.name, { cause: error })
        }
    }

    private async matches(file: PackFile, bytes: ArrayBuffer): Promise<boolean> {
        return bytes.byteLength === file.size && (await this.deps.hash(bytes)) === file.sha256
    }

    /** The folder and each folder above it that doesn't exist yet. */
    private async makeFolder(): Promise<void> {
        const { store, folder } = this.deps
        const parts = folder.split('/').filter(Boolean)
        for (let depth = 1; depth <= parts.length; depth++) {
            const path = parts.slice(0, depth).join('/')
            if (!(await store.exists(path))) await store.mkdir(path)
        }
    }

    /**
     * Removes the pack from this device: a running download is stopped first, then the folder
     * goes, and the folder above it when that left it empty.
     */
    async remove(): Promise<void> {
        const { store, folder } = this.deps
        if (this.running) {
            this.cancel()
            await this.running.catch(() => undefined)
        }
        try {
            if (await store.exists(folder)) await store.rmdir(folder, true)
            const parent = folder.split('/').slice(0, -1).join('/')
            if (parent && (await store.exists(parent))) {
                const left = await store.list(parent)
                if (!left.files.length && !left.folders.length) await store.rmdir(parent, false)
            }
        } catch (error) {
            throw new PackError('storage', undefined, { cause: error })
        } finally {
            await this.refresh()
            this.changed()
        }
    }
}
