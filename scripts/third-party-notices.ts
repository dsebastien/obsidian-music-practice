import { existsSync, readdirSync } from 'node:fs'
import type { BuildMetafile } from 'bun'

/**
 * Third-party notices built from what the bundle really holds: every input of the Bun.build
 * metafile that comes from node_modules is a package whose license must ship in main.js, so a new
 * transitive dependency can't ship without its notice. A package without a license file of its own
 * is accepted only when another bundled package's THIRD_PARTY_LICENSES.md names it; anything else
 * fails the build.
 */

/** A notice written as given: a name, a license and the files holding its text. */
export interface FixedNotice {
    name: string
    license: string
    what: string
    files: string[]
}

/** What a virtual (plugin-made, namespaced) input embeds: a package, fixed notices, or both. */
export interface VirtualInput {
    package?: string
    notices?: FixedNotice[]
}

export interface NoticesConfig {
    /** Virtual inputs by their metafile path (`<namespace>:<path>`). Any other one fails. */
    virtualInputs: Record<string, VirtualInput>
    /** A title and a description for packages worth one; the others are grouped by license text. */
    descriptions: Record<string, { title: string; what: string }>
    /** License files for a package that ships none (paths from the repository root). */
    extraLicenseFiles: Record<string, string[]>
    /** Where packages named by a virtual input are found. */
    nodeModules: string
}

/** One entry of the notices: a title line and the license texts under it. */
export interface Notice {
    title: string
    texts: string[]
}

/** A package of the bundle: its name and folder, and an input path that brought it in. */
export interface BundledPackage {
    name: string
    dir: string
    input: string
}

/** Where a notices file of a package can be (the libraries it bundles, with their licenses). */
export const THIRD_PARTY_FILES = ['dist/THIRD_PARTY_LICENSES.md', 'THIRD_PARTY_LICENSES.md']

const SEPARATOR = `\n\n${'-'.repeat(72)}\n\n`

/** `<namespace>:<path>` (a plugin's virtual module), not a Windows drive letter. */
const NAMESPACED = /^[\w-]{2,}:/

/**
 * The package an input path belongs to: the segment after its LAST `node_modules/` (a nested
 * copy is its own package), `@scope/name` for scoped ones. Null for the plugin's own files.
 */
export function packageOfInput(input: string): { name: string; dir: string } | null {
    const path = input.replaceAll('\\', '/')
    const at = path.lastIndexOf('node_modules/')
    if (at < 0) return null
    const rest = path.slice(at + 'node_modules/'.length).split('/')
    const [first, second] = rest
    if (!first) return null
    const name = first.startsWith('@') && second ? `${first}/${second}` : first
    return { name, dir: path.slice(0, at + 'node_modules/'.length + name.length) }
}

/** Every input that put bytes into an output of the build, in metafile order. */
export function bundledInputs(metafile: BuildMetafile): string[] {
    const inputs = new Set<string>()
    for (const output of Object.values(metafile.outputs))
        for (const [path, info] of Object.entries(output.inputs))
            if (info.bytesInOutput > 0) inputs.add(path)
    return [...inputs]
}

/**
 * License files at the root of a package folder: LICENSE, LICENCE, COPYING (with .md or .txt),
 * else the suffixed ones (LICENSE-MIT, LICENSE.APACHE…), sorted.
 */
export function findLicenseFiles(dir: string): string[] {
    if (!existsSync(dir)) return []
    const names = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .sort()
    const plain = names.filter((n) => /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i.test(n))
    const found = plain.length
        ? plain
        : names.filter((n) => /^(licen[cs]e|copying)[-._]/i.test(n) && !/\.header$/i.test(n))
    return found.map((n) => `${dir}/${n}`)
}

/** The packages a notices file names: its `## <name>` headings. */
export function namedInNoticesFile(text: string): string[] {
    return [...text.matchAll(/^##\s+(\S.*?)\s*$/gm)].map((m) => m[1] ?? '').filter(Boolean)
}

/** The package's notices file (the libraries it bundles), when it has one. */
function noticesFileOf(dir: string): string | null {
    for (const f of THIRD_PARTY_FILES) if (existsSync(`${dir}/${f}`)) return `${dir}/${f}`
    return null
}

async function readPackageJson(dir: string): Promise<{ version?: string; license?: unknown }> {
    const file = Bun.file(`${dir}/package.json`)
    return (await file.exists())
        ? ((await file.json()) as { version?: string; license?: unknown })
        : {}
}

const readTexts = (files: string[]): Promise<string[]> =>
    Promise.all(files.map(async (f) => (await Bun.file(f).text()).trim()))

/**
 * The notices of a build, from its metafile. Throws, naming each one, when a bundled package has
 * no license text or a virtual input isn't declared.
 */
export async function collectNotices(
    metafile: BuildMetafile,
    config: NoticesConfig
): Promise<Notice[]> {
    const packages = new Map<string, BundledPackage>()
    const fixed: FixedNotice[] = []
    const problems: string[] = []
    const addPackage = (name: string, dir: string, input: string): void => {
        if (!packages.has(dir)) packages.set(dir, { name, dir, input })
    }

    for (const input of bundledInputs(metafile)) {
        if (NAMESPACED.test(input)) {
            const virtual = config.virtualInputs[input]
            if (!virtual) {
                problems.push(
                    `${input}: a virtual module with no declared notice (add it to the virtual inputs of the notices)`
                )
                continue
            }
            if (virtual.package)
                addPackage(virtual.package, `${config.nodeModules}/${virtual.package}`, input)
            for (const n of virtual.notices ?? []) if (!fixed.includes(n)) fixed.push(n)
            continue
        }
        const pkg = packageOfInput(input)
        if (pkg) addPackage(pkg.name, pkg.dir, input)
    }

    // What the bundled packages' own notices files name (the libraries they embed).
    const namedBy = new Map<string, string>()
    for (const pkg of packages.values()) {
        const file = noticesFileOf(pkg.dir)
        if (!file) continue
        for (const name of namedInNoticesFile(await Bun.file(file).text()))
            if (!namedBy.has(name)) namedBy.set(name, pkg.name)
    }

    interface Resolved {
        pkg: BundledPackage
        label: string
        license: string
        texts: string[]
    }
    const resolved: Resolved[] = []
    for (const pkg of packages.values()) {
        const json = await readPackageJson(pkg.dir)
        const license = typeof json.license === 'string' ? json.license : 'see license text'
        const label = json.version ? `${pkg.name} ${json.version}` : pkg.name
        const own = [...(config.extraLicenseFiles[pkg.name] ?? []), ...findLicenseFiles(pkg.dir)]
        const notices = noticesFileOf(pkg.dir)
        const files = notices ? [...own, notices] : own
        if (own.length === 0) {
            const by = namedBy.get(pkg.name)
            if (by && by !== pkg.name) {
                resolved.push({
                    pkg,
                    label,
                    license,
                    texts: [`License text: in the notices of ${by}.`]
                })
                continue
            }
            problems.push(
                `${pkg.name} (bundled from ${pkg.input}): no license file in ${pkg.dir}, and no bundled package's THIRD_PARTY_LICENSES.md names it`
            )
            continue
        }
        resolved.push({ pkg, label, license, texts: await readTexts(files) })
    }

    if (problems.length > 0)
        throw new Error(
            `Third-party notices: no license found for what the bundle embeds:\n${problems
                .map((p) => `  - ${p}`)
                .join(
                    '\n'
                )}\nAdd the license text (licenses/, listed in the extra license files of scripts/build.ts) or remove the dependency.`
        )

    const out: Notice[] = []
    // 1. Virtual inputs, in their declaration order (their package, then their fixed notices).
    const done = new Set<string>()
    const described = (r: Resolved): Notice => {
        const d = config.descriptions[r.pkg.name]
        const title = d
            ? `${d.title} (${r.label}, ${r.license}): ${d.what}`
            : `${r.label} (${r.license})`
        return { title, texts: r.texts }
    }
    for (const virtual of Object.values(config.virtualInputs)) {
        const r = virtual.package
            ? resolved.find((x) => x.pkg.dir === `${config.nodeModules}/${virtual.package}`)
            : undefined
        if (r && !done.has(r.pkg.dir)) {
            out.push(described(r))
            done.add(r.pkg.dir)
        }
        for (const n of virtual.notices ?? [])
            if (fixed.includes(n) && !done.has(n.name)) {
                done.add(n.name)
                out.push({
                    title: `${n.name} (${n.license}): ${n.what}`,
                    texts: await readTexts(n.files)
                })
            }
    }
    // 2. Described packages, in the descriptions' order.
    for (const name of Object.keys(config.descriptions))
        for (const r of resolved)
            if (r.pkg.name === name && !done.has(r.pkg.dir)) {
                out.push(described(r))
                done.add(r.pkg.dir)
            }
    // 3. The rest, by name, packages with the same license texts in one entry.
    const groups = new Map<string, Resolved[]>()
    for (const r of [...resolved].sort((a, b) => a.label.localeCompare(b.label))) {
        if (done.has(r.pkg.dir)) continue
        const key = r.texts.join('\n\n')
        groups.set(key, [...(groups.get(key) ?? []), r])
    }
    for (const group of groups.values()) {
        const licenses = [...new Set(group.map((r) => r.license))].join(', ')
        out.push({
            title: `${group.map((r) => r.label).join(', ')} (${licenses})`,
            texts: group[0]?.texts ?? []
        })
    }
    return out
}

/** The notices as one block comment for the end of main.js (a comment can't hold its end mark). */
export function formatNotices(notices: Notice[], product: string): string {
    const body = notices
        .map((n) => [n.title, ...n.texts].join('\n\n'))
        .join(SEPARATOR)
        .replaceAll('*/', '* /')
    return `\n/*! Third-party notices: ${product} embeds the following software.\n\n${body}\n*/\n`
}
