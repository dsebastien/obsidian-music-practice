/**
 * Save a diagram, or a whole block, as a PNG or SVG file (#51): file names, the folder setting,
 * and the link put after the block. Pure: the service does the vault work.
 */

export type ImageFormat = 'png' | 'svg'

/** The longest name part, so a path stays well under every system's limit. */
const MAX_NAME = 120

/** What a file name can't hold on some system (and `#`, `^`, `[`, `]`, which break links). */
const UNSAFE = /[\\/:*?"<>|#^[\]\p{Cc}]/gu

/**
 * A name part safe in a file name on every system: a sharp or flat after a note letter spelled
 * out (" Sharp", " Flat", as drill note names spell sharps), anything a file name refuses as a
 * space, spaces collapsed, at most 120 characters, never empty ("Diagram").
 */
export function safeName(text: string): string {
    const name = text
        .replace(/([A-G])[#♯]/g, '$1 Sharp ')
        .replace(/([A-G])♭/g, '$1 Flat ')
        .replace(UNSAFE, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NAME)
        .trim()
    return name || 'Diagram'
}

/** `<note name> - <what>.<format>`; just `<what>.<format>` without a note name. */
export function imageFileName(noteName: string, what: string, format: ImageFormat): string {
    const note = noteName.trim()
    const shown = safeName(what)
    return `${note ? `${note} - ` : ''}${shown}.${format}`
}

/** A block's name: the titles of its diagrams (3 at most, then "…"), else its language. */
export function blockImageName(titles: readonly string[], language: string): string {
    const named = titles.map((t) => t.trim()).filter((t) => t.length > 0)
    if (!named.length) return `${language} block`
    return named.slice(0, 3).join(', ') + (named.length > 3 ? '…' : '')
}

export type FolderParse = { ok: true; value: string } | { ok: false; error: string }

/** Characters a folder name can't hold on some system. */
const UNSAFE_SEGMENT = /[*?"<>|:]/

/**
 * The folder setting in normal form: empty for Obsidian's attachment location, else a vault
 * folder (backslashes read as `/`, no leading, trailing or doubled slashes). Refuses `.` and `..`
 * segments, a drive, and characters some systems refuse.
 */
export function parseImageFolder(raw: string): FolderParse {
    const parts = raw
        .trim()
        .replace(/\\/g, '/')
        .split('/')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    if (!parts.length) return { ok: true, value: '' }
    if (/^[A-Za-z]:$/.test(parts[0]!))
        return { ok: false, error: 'Enter a folder of the vault, such as Music/Images (no drive).' }
    if (parts.some((p) => p === '.' || p === '..'))
        return {
            ok: false,
            error: 'Enter a folder of the vault, such as Music/Images (no . or ..).'
        }
    if (parts.some((p) => UNSAFE_SEGMENT.test(p)))
        return {
            ok: false,
            error: 'Folder names can\'t hold * ? " < > | or :. Enter a folder such as Music/Images.'
        }
    return { ok: true, value: parts.join('/') }
}

/**
 * A free path for `<name>.<format>` in `folder` (the vault root when empty), numbered as Obsidian
 * numbers attachments when taken: `name.png`, `name 1.png`, `name 2.png`, …
 */
export function numberedPath(
    folder: string,
    name: string,
    format: ImageFormat,
    exists: (path: string) => boolean
): string {
    const base = folder ? `${folder}/${name}` : name
    let path = `${base}.${format}`
    for (let n = 1; exists(path); n++) path = `${base} ${n}.${format}`
    return path
}

/** Where a block was drawn: Obsidian's section info. */
export interface BlockSection {
    text: string
    lineStart: number
    lineEnd: number
}

const isFence = (line: string): boolean => /^\s*(```|~~~)/.test(line)

/**
 * The note's text with `link` on its own line right after the block's closing fence; null when
 * the block isn't where it was drawn (its lines differ from the section's) or doesn't end with a
 * fence. The section's text is the whole note when Obsidian gives it so, else the section alone.
 */
export function withEmbedAfter(text: string, section: BlockSection, link: string): string | null {
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const lines = text.split(/\r?\n/)
    const drawn = section.text.split(/\r?\n/)
    const count = section.lineEnd - section.lineStart + 1
    if (count < 2 || section.lineStart < 0) return null
    const block =
        drawn.length > section.lineEnd
            ? drawn.slice(section.lineStart, section.lineEnd + 1)
            : drawn.slice(0, count)
    if (block.length !== count || !isFence(block[count - 1]!)) return null
    const now = lines.slice(section.lineStart, section.lineEnd + 1)
    if (now.length !== count || now.some((line, i) => line !== block[i])) return null
    lines.splice(section.lineEnd + 1, 0, link)
    return lines.join(eol)
}
