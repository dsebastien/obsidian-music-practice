/**
 * The sound pack (#100): better instrument sounds as an optional download. The pack is the
 * GeneralUser GS folder of `@dsebastien/music-notation-sounds` (one small soundfont per General
 * MIDI instrument, the drum kit, the metronome click and their index), which the notation library
 * plays as its `generaluser` engine. Nothing here touches the network or the vault: this module
 * says what the pack is made of, and what state a folder is in.
 */
import { SOUND_PACK_FILES, SOUND_PACK_VERSION } from './sound-pack.manifest'

export interface PackFile {
    name: string
    /** In bytes. */
    size: number
    /** SHA-256 of the file's bytes, in hex. */
    sha256: string
}

export interface SoundPack {
    /** The name shown to the user. */
    name: string
    /** The release of the sounds package the files come from. */
    version: string
    /** The folder the files are downloaded from; it ends with a slash. */
    url: string
    /** The bank's license, as its own license file names it. */
    license: string
    files: readonly PackFile[]
}

/** The file that says a folder holds the whole pack: written last, read first. */
export const PACK_MARKER = 'pack.json'

/** What the marker file holds. */
export interface PackMarker {
    version: string
    files: number
}

/**
 * The pack: GeneralUser GS 2.0.3 by S. Christian Collins, cut into one file per instrument. A
 * fixed release on jsDelivr (a release of an npm package never changes), each file checked
 * against the size and hash this plugin ships.
 */
export const SOUND_PACK: SoundPack = {
    name: 'GeneralUser GS',
    version: SOUND_PACK_VERSION,
    url: `https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@${SOUND_PACK_VERSION}/generaluser/`,
    license: 'GeneralUser GS License v2.0',
    files: SOUND_PACK_FILES.map(([name, size, sha256]) => ({ name, size, sha256 }))
}

/** The pack's size in bytes. */
export const packBytes = (pack: SoundPack = SOUND_PACK): number =>
    pack.files.reduce((sum, file) => sum + file.size, 0)

/** A size for a person: megabytes with one decimal ("14.9 MB"), as file managers count them. */
export const megabytes = (bytes: number): string => `${(bytes / 1_000_000).toFixed(1)} MB`

/** The address of one of the pack's files. */
export const packFileUrl = (pack: SoundPack, file: PackFile): string => pack.url + file.name

/** A name the pack may hold: one path segment, so nothing outside its folder is ever read. */
export const isPackFileName = (name: string): boolean =>
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.includes('..')

/**
 * - `absent`: nothing on this device.
 * - `partial`: some files, no marker (a download that stopped): Download goes on from there.
 * - `outdated`: the whole pack of another release: it plays, and Download brings the new one.
 * - `installed`: the whole pack of this plugin's release.
 */
export type PackState = 'absent' | 'partial' | 'outdated' | 'installed'

/** The state of a folder, from its marker file's text (null: none) and whether it has files. */
export function packStateOf(
    marker: string | null,
    hasFiles: boolean,
    pack: SoundPack = SOUND_PACK
): PackState {
    const read = readMarker(marker)
    if (!read) return hasFiles ? 'partial' : 'absent'
    return read.version === pack.version && read.files === pack.files.length
        ? 'installed'
        : 'outdated'
}

/** The marker a file's text holds; null when it isn't one. */
export function readMarker(text: string | null): PackMarker | null {
    if (!text) return null
    try {
        const value: unknown = JSON.parse(text)
        if (typeof value !== 'object' || value === null) return null
        const version: unknown = Reflect.get(value, 'version')
        const files: unknown = Reflect.get(value, 'files')
        return typeof version === 'string' && typeof files === 'number' ? { version, files } : null
    } catch {
        return null
    }
}

/** The marker file's text for a pack. */
export const markerOf = (pack: SoundPack = SOUND_PACK): string =>
    JSON.stringify({ version: pack.version, files: pack.files.length } satisfies PackMarker)

/** Whether a state plays the pack's sounds (an older release still plays). */
export const packPlays = (state: PackState): boolean =>
    state === 'installed' || state === 'outdated'

/** Bytes as lowercase hex, the form the manifest's hashes are in. */
export const hexOf = (bytes: ArrayBuffer): string =>
    Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')

/** How far a download is, for the settings row. */
export interface PackProgress {
    /** Bytes of the files that are in the folder and right. */
    done: number
    total: number
}

/** A whole percent, never 100 before the end. */
export const percentOf = (progress: PackProgress): number =>
    progress.total <= 0
        ? 0
        : Math.min(
              progress.done >= progress.total ? 100 : 99,
              Math.floor((progress.done / progress.total) * 100)
          )

/** What the settings row shows for a state: its status line and its buttons. */
export interface PackRow {
    status: 'absent' | 'partial' | 'installed' | 'outdated' | 'downloading'
    /** The button that starts a download, by what it does; null when there is nothing to get. */
    primary: 'download' | 'resume' | 'update' | null
    cancel: boolean
    remove: boolean
}

/** The settings row of a state; while a download runs, only Cancel. */
export function packRowOf(state: PackState, downloading: boolean): PackRow {
    if (downloading) return { status: 'downloading', primary: null, cancel: true, remove: false }
    switch (state) {
        case 'absent':
            return { status: 'absent', primary: 'download', cancel: false, remove: false }
        case 'partial':
            return { status: 'partial', primary: 'resume', cancel: false, remove: true }
        case 'outdated':
            return { status: 'outdated', primary: 'update', cancel: false, remove: true }
        case 'installed':
            return { status: 'installed', primary: null, cancel: false, remove: true }
    }
}
