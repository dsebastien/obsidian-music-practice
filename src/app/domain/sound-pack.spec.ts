import { describe, expect, it } from 'bun:test'
import {
    PACK_MARKER,
    SOUND_PACK,
    hexOf,
    isPackFileName,
    markerOf,
    megabytes,
    packBytes,
    packFileUrl,
    packPlays,
    packRowOf,
    packStateOf,
    percentOf,
    readMarker
} from './sound-pack'
import { SOUND_PACK_FILES, SOUND_PACK_VERSION } from './sound-pack.manifest'
import { manifestSource } from '../../../scripts/sound-pack-manifest'

describe('the sound pack (#100)', () => {
    it('is GeneralUser GS from a fixed release of the sounds package on jsDelivr', () => {
        expect(SOUND_PACK.name).toBe('GeneralUser GS')
        expect(SOUND_PACK.version).toMatch(/^\d+\.\d+\.\d+$/)
        expect(SOUND_PACK.url).toBe(
            `https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@${SOUND_PACK_VERSION}/generaluser/`
        )
        const first = SOUND_PACK.files[0]!
        expect(packFileUrl(SOUND_PACK, first)).toBe(SOUND_PACK.url + first.name)
    })

    it('has the index, the license, the click, the kit and the 128 General MIDI programs', () => {
        const names = SOUND_PACK.files.map((file) => file.name)
        expect(new Set(names).size).toBe(names.length)
        for (const name of ['index.json', 'LICENSE.txt', 'click.sf3', 'drums.sf3'])
            expect(names).toContain(name)
        for (let program = 0; program < 128; program++)
            expect(names).toContain(`p${String(program).padStart(3, '0')}.sf3`)
        expect(names).toHaveLength(132)
        // The maintainers' loudness report plays nothing: not downloaded.
        expect(names).not.toContain('report.json')
        expect(names).not.toContain(PACK_MARKER)
    })

    it('gives each file a name of one path segment, a size and a SHA-256', () => {
        for (const file of SOUND_PACK.files) {
            expect(isPackFileName(file.name)).toBe(true)
            expect(file.size).toBeGreaterThan(0)
            expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
        }
        expect(megabytes(packBytes())).toBe('14.9 MB')
    })

    it('ships the list its script writes, in the order it writes it', () => {
        const files = SOUND_PACK_FILES.map(([name, size, sha256]) => ({ name, size, sha256 }))
        const written = manifestSource(SOUND_PACK_VERSION, [...files].reverse())
        const rows = [...written.matchAll(/\['([^']+)', (\d+), '([0-9a-f]{64})'\]/g)]
        expect(rows.map((row) => [row[1], Number(row[2]), row[3]])).toEqual(
            SOUND_PACK_FILES.map((row) => [...row])
        )
        expect(written).toContain(`export const SOUND_PACK_VERSION = '${SOUND_PACK_VERSION}'`)
    })

    it('refuses names that leave the folder', () => {
        for (const name of ['../data.json', 'a/b.sf3', '/etc/passwd', '..', '', '.hidden', 'a\\b'])
            expect(isPackFileName(name)).toBe(false)
        for (const name of ['index.json', 'p000.sf3', 'LICENSE.txt'])
            expect(isPackFileName(name)).toBe(true)
    })
})

describe('the state of the pack on a device', () => {
    it('reads it from the marker file and the folder', () => {
        expect(packStateOf(null, false)).toBe('absent')
        expect(packStateOf(null, true)).toBe('partial')
        expect(packStateOf(markerOf(), true)).toBe('installed')
        expect(packStateOf(JSON.stringify({ version: '0.0.9', files: 132 }), true)).toBe('outdated')
        expect(packStateOf(JSON.stringify({ version: SOUND_PACK_VERSION, files: 3 }), true)).toBe(
            'outdated'
        )
    })

    it('takes a marker it cannot read for none', () => {
        for (const text of ['', 'not json', '[]', 'null', '{"version":1,"files":"x"}']) {
            expect(readMarker(text)).toBeNull()
            expect(packStateOf(text, true)).toBe('partial')
        }
        expect(readMarker(markerOf())).toEqual({
            version: SOUND_PACK_VERSION,
            files: SOUND_PACK.files.length
        })
    })

    it('plays a whole pack, of this release or an older one', () => {
        expect(packPlays('installed')).toBe(true)
        expect(packPlays('outdated')).toBe(true)
        expect(packPlays('partial')).toBe(false)
        expect(packPlays('absent')).toBe(false)
    })

    it('shows the buttons that fit the state', () => {
        expect(packRowOf('absent', false)).toEqual({
            status: 'absent',
            primary: 'download',
            cancel: false,
            remove: false
        })
        expect(packRowOf('partial', false)).toMatchObject({ primary: 'resume', remove: true })
        expect(packRowOf('outdated', false)).toMatchObject({ primary: 'update', remove: true })
        expect(packRowOf('installed', false)).toMatchObject({ primary: null, remove: true })
        // While a download runs: Cancel only, whatever the folder held before.
        for (const state of ['absent', 'partial', 'outdated', 'installed'] as const)
            expect(packRowOf(state, true)).toEqual({
                status: 'downloading',
                primary: null,
                cancel: true,
                remove: false
            })
    })
})

describe('numbers for the settings row', () => {
    it('writes a whole percent, 100 only at the end', () => {
        expect(percentOf({ done: 0, total: 200 })).toBe(0)
        expect(percentOf({ done: 99, total: 200 })).toBe(49)
        expect(percentOf({ done: 199, total: 200 })).toBe(99)
        expect(percentOf({ done: 1999, total: 2000 })).toBe(99)
        expect(percentOf({ done: 200, total: 200 })).toBe(100)
        expect(percentOf({ done: 5, total: 0 })).toBe(0)
    })

    it('writes megabytes with one decimal', () => {
        expect(megabytes(14_897_592)).toBe('14.9 MB')
        expect(megabytes(401_638)).toBe('0.4 MB')
    })

    it('writes a hash as lowercase hex', () => {
        expect(hexOf(new Uint8Array([0, 1, 15, 16, 255]).buffer)).toBe('00010f10ff')
    })
})
