import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    NOTICES,
    ASSETS_SRC,
    BANNER,
    DIST,
    EXTERNAL_MODULES,
    PLUGIN_ID,
    SRC,
    STYLES_OUT,
    STYLES_SRC,
    bundleOptions,
    readChangelogDefine,
    sourcemapFor,
    thirdPartyNotices
} from './build'

describe('build constants', () => {
    test('SRC is set to src', () => {
        expect(SRC).toBe('src')
    })

    test('DIST is set to dist', () => {
        expect(DIST).toBe('dist')
    })

    test('ASSETS_SRC is set to src/assets', () => {
        expect(ASSETS_SRC).toBe('src/assets')
    })

    test('STYLES_SRC is set to src/styles.src.css', () => {
        expect(STYLES_SRC).toBe('src/styles.src.css')
    })

    test('STYLES_OUT is set to dist/styles.css', () => {
        expect(STYLES_OUT).toBe('dist/styles.css')
    })

    test('PLUGIN_ID matches the manifest id', async () => {
        const manifestJson = (await Bun.file('manifest.json').json()) as { id: string }
        expect(PLUGIN_ID).toBe(manifestJson.id)
    })

    test('BANNER contains expected text', () => {
        expect(BANNER).toContain('GENERATED/BUNDLED FILE BY BUN')
        expect(BANNER).toContain('github repository')
    })
})

describe('EXTERNAL_MODULES', () => {
    test('includes obsidian', () => {
        expect(EXTERNAL_MODULES).toContain('obsidian')
    })

    test('includes electron', () => {
        expect(EXTERNAL_MODULES).toContain('electron')
    })

    test('includes codemirror modules', () => {
        expect(EXTERNAL_MODULES).toContain('@codemirror/autocomplete')
        expect(EXTERNAL_MODULES).toContain('@codemirror/state')
        expect(EXTERNAL_MODULES).toContain('@codemirror/view')
    })

    test('includes lezer modules', () => {
        expect(EXTERNAL_MODULES).toContain('@lezer/common')
        expect(EXTERNAL_MODULES).toContain('@lezer/highlight')
        expect(EXTERNAL_MODULES).toContain('@lezer/lr')
    })

    test('has expected number of external modules', () => {
        expect(EXTERNAL_MODULES.length).toBe(13)
    })
})

describe('readChangelogDefine', () => {
    // Unique per process so parallel runs never share a file.
    const path = join(tmpdir(), `build-spec-changelog-${process.pid}-${Date.now()}.md`)

    afterEach(async () => {
        await rm(path, { force: true })
    })

    test('by default it reads the repository CHANGELOG.md, the one the release writes', async () => {
        // The build calls it with no argument; the What's new tab shows this.
        const changelog = await Bun.file('CHANGELOG.md').text()
        expect(changelog).not.toBe('')
        expect(await readChangelogDefine()).toEqual({
            __PLUGIN_CHANGELOG__: JSON.stringify(changelog)
        })
    })

    test('a missing changelog defines an empty string, not a build failure', async () => {
        const define = await readChangelogDefine(path)
        expect(define).toEqual({ __PLUGIN_CHANGELOG__: '""' })
    })

    test('the define is a JS string literal that round-trips the file exactly', async () => {
        const text = [
            '## [1.2.3] - 2026-09-23',
            '',
            '- quotes "double" and \'single\', a `backtick` and a ${template}',
            '- backslash \\ and a tab\there',
            '- </script> and unicode: é ✓'
        ].join('\n')
        await Bun.write(path, text)

        const literal = (await readChangelogDefine(path))['__PLUGIN_CHANGELOG__'] ?? ''
        // What the bundler substitutes must evaluate back to the file content.
        expect(JSON.parse(literal)).toBe(text)
        expect(new Function(`return ${literal}`)()).toBe(text)
    })
})

describe('sourcemapFor', () => {
    test('production uses the string form the older Bun of the catalog reviewer accepts', () => {
        // Not `false`: that fails the reviewer's archive build (see build.ts).
        expect(sourcemapFor(true)).toBe('none')
    })

    test('development keeps inline source maps', () => {
        expect(sourcemapFor(false)).toBe('inline')
    })
})

describe('third-party notices', () => {
    // The release build, to a temporary folder: the notices come from its metafile.
    const outdir = join(tmpdir(), `build-spec-bundle-${process.pid}-${Date.now()}`)

    afterAll(async () => {
        await rm(outdir, { recursive: true, force: true })
    })

    test('every package of the real bundle has a license, transitive ones included', async () => {
        const { success, metafile } = await Bun.build(await bundleOptions(true, outdir))
        expect(success).toBe(true)
        expect(metafile).toBeDefined()
        const notices = await thirdPartyNotices(metafile)
        // Direct dependencies, the virtual alphaTab modules, and what comes through the library.
        for (const expected of [
            'alphaTab (@coderline/alphatab ',
            'Bravura music font (SIL Open Font License 1.1)',
            'SONiVOX soundfont (sonivox.sf3) (Apache-2.0)',
            'Music notation (@dsebastien/music-notation ',
            'Immer (immer ',
            'tonal 6.',
            '@tonaljs/core ',
            // chords-db voicing data, embedded in the library's dist: named by its notices file.
            '## @tombatossals/chords-db',
            'Copyright (c) 2015 danigb'
        ])
            expect(notices).toContain(expected)
        // zod is a dependency the plugin doesn't import: not in the bundle, so no notice.
        expect(notices).not.toContain('zod')
        // Some bun-types say the metafile is its JSON text: read the same.
        expect(await thirdPartyNotices(JSON.stringify(metafile))).toBe(notices)
    }, 120_000)

    test('a build without a metafile fails instead of shipping without notices', async () => {
        await expect(thirdPartyNotices(undefined)).rejects.toThrow('no metafile')
    })

    test('the bundle config builds with a metafile', async () => {
        expect((await bundleOptions(true)).metafile).toBe(true)
        expect((await bundleOptions(false)).metafile).toBe(true)
    })

    test('every declared notice file exists', async () => {
        const files = [
            ...Object.values(NOTICES.virtualInputs).flatMap((v) =>
                (v.notices ?? []).flatMap((n) => n.files)
            ),
            ...Object.values(NOTICES.extraLicenseFiles).flat()
        ]
        expect(files.length).toBeGreaterThan(0)
        for (const f of files) expect(await Bun.file(f).exists()).toBe(true)
    })
})
