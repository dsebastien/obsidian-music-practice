import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BuildMetafile } from 'bun'
import {
    bundledInputs,
    collectNotices,
    findLicenseFiles,
    formatNotices,
    namedInNoticesFile,
    packageOfInput,
    type NoticesConfig
} from './third-party-notices'

/** A metafile whose single output holds these inputs (byte counts as given). */
function metafileOf(inputs: Record<string, number>): BuildMetafile {
    return {
        inputs: {},
        outputs: {
            './main.js': {
                bytes: 1,
                inputs: Object.fromEntries(
                    Object.entries(inputs).map(([p, n]) => [p, { bytesInOutput: n }])
                ),
                imports: [],
                exports: []
            }
        }
    }
}

describe('packageOfInput', () => {
    test('names a package after the last node_modules, scoped or not', () => {
        expect(packageOfInput('../repo/node_modules/tonal/dist/index.js')).toEqual({
            name: 'tonal',
            dir: '../repo/node_modules/tonal'
        })
        expect(packageOfInput('node_modules/@tonaljs/core/dist/index.js')).toEqual({
            name: '@tonaljs/core',
            dir: 'node_modules/@tonaljs/core'
        })
    })

    test('a nested copy is its own package', () => {
        expect(packageOfInput('node_modules/lib/node_modules/a/index.js')).toEqual({
            name: 'a',
            dir: 'node_modules/lib/node_modules/a'
        })
    })

    test('reads Windows paths', () => {
        expect(packageOfInput('node_modules\\@scope\\pkg\\index.js')?.name).toBe('@scope/pkg')
    })

    test("the plugin's own files are no package", () => {
        expect(packageOfInput('src/main.ts')).toBeNull()
        expect(packageOfInput('manifest.json')).toBeNull()
    })
})

describe('bundledInputs', () => {
    test('every input that put bytes into an output, once', () => {
        const meta = metafileOf({ 'src/a.ts': 10, 'node_modules/x/i.js': 0 })
        meta.outputs['./chunk.js'] = {
            bytes: 1,
            inputs: {
                'src/a.ts': { bytesInOutput: 3 },
                'node_modules/y/i.js': { bytesInOutput: 4 }
            },
            imports: [],
            exports: []
        }
        expect(bundledInputs(meta)).toEqual(['src/a.ts', 'node_modules/y/i.js'])
    })
})

describe('notices from a package tree', () => {
    let root = ''
    let nm = ''
    const config = (over: Partial<NoticesConfig> = {}): NoticesConfig => ({
        virtualInputs: {},
        descriptions: {},
        extraLicenseFiles: {},
        nodeModules: nm,
        ...over
    })
    const pkg = async (dir: string, json: object, files: Record<string, string> = {}) => {
        await Bun.write(join(dir, 'package.json'), JSON.stringify(json))
        await Bun.write(join(dir, 'index.js'), '')
        for (const [name, text] of Object.entries(files)) await Bun.write(join(dir, name), text)
    }

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'notices-spec-'))
        nm = join(root, 'node_modules')
        await pkg(join(nm, 'a'), { version: '1.0.0', license: 'MIT' }, { LICENSE: 'A license\n' })
        await pkg(join(nm, 'same'), { version: '2.0.0', license: 'MIT' }, { LICENSE: 'A license' })
        await pkg(
            join(nm, 'lib'),
            { version: '3.0.0', license: 'MIT' },
            {
                'LICENSE.md': 'Lib license',
                'dist/THIRD_PARTY_LICENSES.md': '# Third-party licenses\n\n## b\n\nB text\n'
            }
        )
        await pkg(join(nm, 'lib', 'node_modules', 'a'), { version: '0.9.0' }, { COPYING: 'Old A' })
        await pkg(join(nm, 'b'), { version: '4.0.0', license: 'ISC' })
        await pkg(join(nm, 'c'), { version: '5.0.0', license: 'MIT' })
        await pkg(
            join(nm, 'dual'),
            { version: '1.0.0', license: 'MIT OR Apache-2.0' },
            {
                'LICENSE-APACHE': 'Apache text',
                'LICENSE-MIT': 'MIT text',
                'LICENSE.header': 'not a license'
            }
        )
        await pkg(
            join(nm, '@s', 'virt'),
            { version: '6.0.0', license: 'MPL-2.0' },
            {
                LICENSE: 'Virt license'
            }
        )
        await Bun.write(join(root, 'font.txt'), 'Font license')
        await Bun.write(join(root, 'extra.txt'), 'Extra license for c')
    })

    afterAll(async () => {
        await rm(root, { recursive: true, force: true })
    })

    const input = (p: string): string => join(nm, p, 'index.js')

    test('license files: plain names first, else the suffixed ones (never a .header)', () => {
        expect(findLicenseFiles(join(nm, 'lib'))).toEqual([join(nm, 'lib') + '/LICENSE.md'])
        expect(findLicenseFiles(join(nm, 'dual'))).toEqual([
            join(nm, 'dual') + '/LICENSE-APACHE',
            join(nm, 'dual') + '/LICENSE-MIT'
        ])
        expect(findLicenseFiles(join(nm, 'b'))).toEqual([])
        expect(findLicenseFiles(join(nm, 'missing'))).toEqual([])
    })

    test('a notices file names its packages by their headings', () => {
        expect(namedInNoticesFile('# Third-party licenses\n\n## tonal\n\n## @x/y \n')).toEqual([
            'tonal',
            '@x/y'
        ])
    })

    test('each bundled package gets its own license text, with its version and license', async () => {
        const notices = await collectNotices(
            metafileOf({ [input('a')]: 5, 'src/main.ts': 9 }),
            config()
        )
        expect(notices).toEqual([{ title: 'a 1.0.0 (MIT)', texts: ['A license'] }])
    })

    test("a library's notices file follows its license, and covers a package it names", async () => {
        const notices = await collectNotices(
            metafileOf({ [input('lib')]: 5, [input('b')]: 5 }),
            config({ descriptions: { lib: { title: 'Lib', what: 'does things' } } })
        )
        expect(notices).toEqual([
            {
                title: 'Lib (lib 3.0.0, MIT): does things',
                texts: ['Lib license', '# Third-party licenses\n\n## b\n\nB text']
            },
            { title: 'b 4.0.0 (ISC)', texts: ['License text: in the notices of lib.'] }
        ])
    })

    test('a package named by no notices file and without a license fails the build, by name', async () => {
        const run = collectNotices(
            metafileOf({ [input('a')]: 5, [input('c')]: 5, [input('b')]: 5 }),
            config()
        )
        await expect(run).rejects.toThrow(/no license found/)
        await expect(run).rejects.toThrow(`c (bundled from ${input('c')})`)
        // b is named only by lib's notices file, and lib isn't in this bundle.
        await expect(run).rejects.toThrow(`b (bundled from ${input('b')})`)
    })

    test('a package without a license file can be given one', async () => {
        const notices = await collectNotices(
            metafileOf({ [input('c')]: 5 }),
            config({ extraLicenseFiles: { c: [join(root, 'extra.txt')] } })
        )
        expect(notices).toEqual([{ title: 'c 5.0.0 (MIT)', texts: ['Extra license for c'] }])
    })

    test('packages with the same license text share one entry; a nested copy has its own', async () => {
        const notices = await collectNotices(
            metafileOf({
                [input('same')]: 5,
                [input('a')]: 5,
                [join(nm, 'lib', 'node_modules', 'a', 'index.js')]: 5
            }),
            config()
        )
        expect(notices).toEqual([
            { title: 'a 0.9.0 (see license text)', texts: ['Old A'] },
            { title: 'a 1.0.0, same 2.0.0 (MIT)', texts: ['A license'] }
        ])
    })

    test('virtual inputs come first, with their package and fixed notices', async () => {
        const font = {
            name: 'Font',
            license: 'OFL',
            what: 'glyphs',
            files: [join(root, 'font.txt')]
        }
        const notices = await collectNotices(
            metafileOf({
                [input('a')]: 5,
                'virt:font': 3,
                'virt:script': 3
            }),
            config({
                virtualInputs: {
                    'virt:script': { package: '@s/virt' },
                    'virt:font': { notices: [font] },
                    'virt:unused': { notices: [{ ...font, name: 'Unused' }] }
                },
                descriptions: { '@s/virt': { title: 'Virt', what: 'plays' } }
            })
        )
        expect(notices.map((n) => n.title)).toEqual([
            'Virt (@s/virt 6.0.0, MPL-2.0): plays',
            'Font (OFL): glyphs',
            'a 1.0.0 (MIT)'
        ])
        expect(notices[1]?.texts).toEqual(['Font license'])
    })

    test('a virtual input with no declared notice fails the build', async () => {
        await expect(collectNotices(metafileOf({ 'virt:new': 3 }), config())).rejects.toThrow(
            'virt:new: a virtual module with no declared notice'
        )
    })
})

describe('formatNotices', () => {
    test('one block comment that a license text cannot close', () => {
        const text = formatNotices(
            [
                { title: 'x (MIT)', texts: ['a */ b'] },
                { title: 'y (ISC)', texts: ['c', 'd'] }
            ],
            'Music Practice'
        )
        expect(text.startsWith('\n/*! Third-party notices: Music Practice embeds')).toBe(true)
        expect(text.endsWith('\n*/\n')).toBe(true)
        expect(text.match(/\*\//g)?.length).toBe(1)
        expect(text).toContain(`x (MIT)\n\na * / b\n\n${'-'.repeat(72)}\n\ny (ISC)\n\nc\n\nd`)
    })
})
