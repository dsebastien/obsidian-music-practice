/**
 * Where a fenced block goes in a note: at the cursor, but never inside the properties, a code
 * block, a math block or an HTML block. Obsidian's section map (the metadata cache's `sections`)
 * says where those are; a line scan of the fences stands in when the map is behind the editor.
 */

/** A location in a note, as the metadata cache gives it (0-based line and column, offset). */
export interface SectionLoc {
    line: number
    col: number
    offset: number
}

/** A top-level section of a note, as the metadata cache gives it (`SectionCache`). */
export interface NoteSection {
    type: string
    position: { start: SectionLoc; end: SectionLoc }
}

/**
 * A block's text for a cursor between `before` and `after` (the rest of their lines): a fence
 * must start its own line at the margin and end its own line, so text around the cursor (even
 * indentation) moves to its own lines.
 */
export function blockInsertion(before: string, after: string, block: string): string {
    return `${before.length ? '\n' : ''}${block}\n${after.trim() ? '\n' : ''}`
}

/**
 * A line without the container markers in front of it (callouts and quotes `> `, list items
 * `- `, `1. `), where fences may sit too.
 */
const unquoted = (line: string) =>
    line.replace(/^(?:\s*(?:>|[-*+](?=\s)|\d{1,9}[.)](?=\s)))+ ?/, '')

/**
 * A code fence that opens a block: three backticks or tildes, at any indentation (lists, callouts);
 * a backtick fence's info string has no backtick (else it's inline code).
 */
export const openingFence = (line: string): string | null => {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(unquoted(line))
    if (!m) return null
    return m[1]![0] === '`' && m[2]!.includes('`') ? null : m[1]!
}

/** Whether a line closes a block opened with `fence` (same character, at least as long). */
export const closes = (line: string, fence: string): boolean => {
    const m = /^\s*([`~]{3,})\s*$/.exec(unquoted(line))
    return !!m && m[1]!.length >= fence.length && [...m[1]!].every((c) => c === fence[0])
}

/**
 * The fenced code blocks of `lines` (from `start` on): for a cursor on `line` inside one, fences
 * included, the line after which the block goes instead (the block's last line; for a fence never
 * closed, the line before it); else null.
 */
function fenceRegionEnd(lines: string[], line: number, start: number): number | null {
    let open: { line: number; fence: string } | null = null
    for (let i = start; i < lines.length; i++) {
        if (!open) {
            const fence = openingFence(lines[i]!)
            if (fence) open = { line: i, fence }
        } else if (closes(lines[i]!, open.fence)) {
            if (line >= open.line && line <= i) return i
            open = null
        }
        if (i > line && !open) break
    }
    // A fence never closed runs to the end of the note: the block goes before it.
    return open && line >= open.line ? open.line - 1 : null
}

/**
 * The line scan: where a block can't go are the properties (frontmatter) and fenced code blocks,
 * fences included. For a cursor on `line` inside one, the line after which the block goes instead
 * (the region's last line; for a fence never closed, the line before it, -1 for the top of the
 * note); else null.
 */
export function regionEnd(lines: string[], line: number): number | null {
    const properties = propertiesEnd(lines)
    if (properties !== null && line <= properties) return properties
    return fenceRegionEnd(lines, line, properties === null ? 0 : properties + 1)
}

/** The last line of the properties (frontmatter), null without them. */
function propertiesEnd(lines: string[]): number | null {
    if (lines[0]?.trim() !== '---') return null
    const close = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l))
    return close > 0 ? close : null
}

/** Sections a block never goes into: the properties, code, math and HTML. */
const SEALED = new Set(['yaml', 'code', 'math', 'html'])

/** Sections whose lines may hold fenced code blocks of their own (read with the line scan). */
const CONTAINERS = new Set(['list', 'callout', 'blockquote', 'footnoteDefinition'])

/**
 * Whether the section map describes `text`: every section starts and ends where its offsets say,
 * in order, and nothing but blank lines follows the last one. When the editor has changes the
 * cache hasn't read yet, the map is behind and the line scan is used instead.
 */
export function sectionsMatch(text: string, sections: readonly NoteSection[]): boolean {
    if (!sections.length) return !text.trim()
    const starts = [0]
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
    const at = (loc: SectionLoc) => {
        const lineStart = starts[loc.line]
        return lineStart !== undefined && lineStart + loc.col === loc.offset
    }
    let previous = 0
    for (const { position } of sections) {
        const { start, end } = position
        if (start.offset < previous || end.offset < start.offset || end.offset > text.length)
            return false
        if (!at(start) || !at(end)) return false
        previous = end.offset
    }
    return !text.slice(previous).trim()
}

/**
 * The section map's answer for a cursor on `line`: inside the properties, code, math or HTML, the
 * line after which the block goes instead (a code fence never closed: the line before it, -1 for
 * the top of the note); inside a list, callout or quote, the same for the fenced code in it (line
 * scan of that section only); else null.
 */
export function sectionRegionEnd(
    lines: string[],
    sections: readonly NoteSection[],
    line: number
): number | null {
    // The properties, whether or not the map lists them.
    const properties = propertiesEnd(lines)
    if (properties !== null && line <= properties) return properties
    const section = sections.find(
        (s) => s.position.start.line <= line && line <= s.position.end.line
    )
    if (!section) return null
    const { start, end } = section.position
    if (SEALED.has(section.type)) {
        if (section.type === 'code') {
            // A fence never closed runs to the end of the note: the block goes before it.
            const fence = openingFence(lines[start.line] ?? '')
            if (fence && (end.line === start.line || !closes(lines[end.line] ?? '', fence)))
                return start.line - 1
        }
        return end.line
    }
    if (!CONTAINERS.has(section.type)) return null
    const inner = fenceRegionEnd(lines.slice(start.line, end.line + 1), line - start.line, 0)
    return inner === null ? null : inner + start.line
}

/**
 * Where a block goes for a selection from line `from` to line `to` of `text`: null at the cursor,
 * else the line after which it goes (-1: the top of the note). The section map when it describes
 * the text, else the line scan.
 */
export function blockTarget(
    text: string,
    from: number,
    to: number,
    sections?: readonly NoteSection[] | null
): number | null {
    const lines = text.split('\n')
    const end =
        sections && sectionsMatch(text, sections)
            ? (line: number) => sectionRegionEnd(lines, sections, line)
            : (line: number) => regionEnd(lines, line)
    return end(from) ?? end(to)
}
