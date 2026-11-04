/**
 * Test support, never imported by the plugin: an in-memory vault for service specs. Notes hold
 * their frontmatter as an object; Obsidian's link index (`resolvedLinks`, `frontmatterLinks`) is
 * computed from the wikilinks in the frontmatter at each read, so it is always up to date.
 */
import type { App, TFile } from 'obsidian'

export interface TestNote {
    fm: Record<string, unknown>
    /** The body under the frontmatter. */
    body: string
    ctime: number
    mtime: number
}

/** A test double typed as what the code under test expects. */
const as = <T>(value: unknown): T => value as T

const nameOf = (path: string) => path.substring(path.lastIndexOf('/') + 1).replace(/\.md$/, '')

/** Every wikilink in a frontmatter value, with its key (`practiced.1`). */
function linksIn(fm: Record<string, unknown>): { key: string; link: string }[] {
    const out: { key: string; link: string }[] = []
    const walk = (value: unknown, key: string) => {
        if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}.${i}`))
        else if (typeof value === 'string')
            for (const m of value.matchAll(/\[\[([^\]|#]+)/g)) out.push({ key, link: m[1]!.trim() })
    }
    for (const [key, value] of Object.entries(fm)) walk(value, key)
    return out
}

export interface TestVault {
    app: App
    notes: Map<string, TestNote>
    /** Paths in the order they were created or had their frontmatter written. */
    writes: string[]
    file: (path: string) => TFile
}

/** A vault of these notes (path → frontmatter); `plugins` stands for `app.plugins.plugins`. */
export function testVault(
    initial: Record<string, Record<string, unknown>>,
    plugins: Record<string, unknown> = {}
): TestVault {
    let now = 1_000
    const notes = new Map<string, TestNote>()
    for (const [path, fm] of Object.entries(initial))
        notes.set(path, { fm: { ...fm }, body: '', ctime: 1, mtime: 1 })
    const folders = new Set<string>()
    const writes: string[] = []
    const file = (path: string): TFile =>
        as<TFile>({
            path,
            name: path.substring(path.lastIndexOf('/') + 1),
            basename: nameOf(path),
            extension: 'md',
            get stat() {
                const n = notes.get(path)
                return { ctime: n?.ctime ?? 0, mtime: n?.mtime ?? 0, size: 0 }
            }
        })
    const dest = (link: string): string | null => {
        const clean = link.replace(/\.md$/, '')
        if (notes.has(`${clean}.md`)) return `${clean}.md`
        return [...notes.keys()].find((p) => nameOf(p) === clean) ?? null
    }
    const metadataCache = {
        get resolvedLinks(): Record<string, Record<string, number>> {
            const out: Record<string, Record<string, number>> = {}
            for (const [path, note] of notes) {
                const targets: Record<string, number> = {}
                for (const { link } of linksIn(note.fm)) {
                    const d = dest(link)
                    if (d) targets[d] = (targets[d] ?? 0) + 1
                }
                out[path] = targets
            }
            return out
        },
        getFileCache: (f: TFile) => {
            const note = notes.get(f.path)
            return note ? { frontmatter: note.fm, frontmatterLinks: linksIn(note.fm) } : null
        },
        getFirstLinkpathDest: (link: string) => {
            const d = dest(link)
            return d ? file(d) : null
        }
    }
    const listeners: ((f: TFile) => void)[] = []
    const vault = {
        getMarkdownFiles: () => [...notes.keys()].map(file),
        getFileByPath: (p: string) => (notes.has(p) ? file(p) : null),
        getAbstractFileByPath: (p: string) =>
            notes.has(p)
                ? file(p)
                : folders.has(p) || [...notes.keys()].some((n) => n.startsWith(`${p}/`))
                  ? as<TFile>({ path: p })
                  : null,
        createFolder: (p: string) => {
            folders.add(p)
            return Promise.resolve()
        },
        create: (path: string, content: string) => {
            if (notes.has(path)) return Promise.reject(new Error(`exists: ${path}`))
            const body = content.replace(/^---\n(?:[\s\S]*?\n)?---\n?/, '')
            now++
            notes.set(path, { fm: {}, body, ctime: now, mtime: now })
            writes.push(path)
            const f = file(path)
            for (const l of listeners) l(f)
            return Promise.resolve(f)
        },
        read: (f: TFile) => {
            const note = notes.get(f.path)
            // JSON is YAML: the spec's parseYaml reads it back.
            return Promise.resolve(note ? `---\n${JSON.stringify(note.fm)}\n---\n${note.body}` : '')
        },
        on: (_name: string, cb: (f: TFile) => void) => {
            listeners.push(cb)
            return cb
        },
        offref: (ref: (f: TFile) => void) => {
            listeners.splice(listeners.indexOf(ref), 1)
        }
    }
    const fileManager = {
        processFrontMatter: (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
            const note = notes.get(f.path)
            if (!note) return Promise.reject(new Error(`missing: ${f.path}`))
            fn(note.fm)
            note.mtime = ++now
            writes.push(f.path)
            return Promise.resolve()
        },
        trashFile: (f: TFile) => {
            notes.delete(f.path)
            return Promise.resolve()
        }
    }
    const app = as<App>({
        vault,
        metadataCache,
        fileManager,
        plugins: { plugins },
        commands: { executeCommandById: () => false }
    })
    return { app, notes, writes, file }
}
