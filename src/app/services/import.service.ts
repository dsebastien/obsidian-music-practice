import { MarkdownView, normalizePath } from 'obsidian'
import type { App, Editor, TFile } from 'obsidian'
import { chordSheetToChordPro, readChord } from '@dsebastien/music-notation'
import { scoreToAlphaTex } from '@dsebastien/music-notation/tab'
import type { FieldNames } from '../domain/fields'
import { insertUnderTitle } from '../domain/notation-note'
import type { AlphaTabRuntime } from './alphatab.service'

/** Score files alphaTab reads; ChordPro files become chord charts. */
export const SCORE_EXTENSIONS = [
    'gp',
    'gp3',
    'gp4',
    'gp5',
    'gpx',
    'gp7',
    'musicxml',
    'xml',
    'mxl',
    'cap',
    'capx'
]
export const CHORDPRO_EXTENSIONS = ['cho', 'chopro', 'chordpro', 'crd', 'pro']

const extensionOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

/** The starter block of Insert a tab block. */
export const TAB_STARTER = '\\title "Title"\n\\tempo 90\n.\n:4 0.6 2.5 2.4 1.3 | 3.6 2.5 0.4 0.3'

/**
 * A block's text for a cursor between `before` and `after` (the rest of their lines): a fence
 * must start its own line at the margin and end its own line, so text around the cursor (even
 * indentation) moves to its own lines.
 */
export function blockInsertion(before: string, after: string, block: string): string {
    return `${before.length ? '\n' : ''}${block}\n${after.trim() ? '\n' : ''}`
}

/** Insert a tab block's text for a cursor between `before` and `after`. */
export const tabBlockInsertion = (before: string, after: string): string =>
    blockInsertion(before, after, fenced('tab', TAB_STARTER))

/**
 * Where a block can't go: the properties (frontmatter) and fenced code blocks, fences included.
 * For a cursor on `line`, the last line of the region it's in, else null.
 */
export function regionEnd(lines: string[], line: number): number | null {
    let start = 0
    if (lines[0]?.trim() === '---') {
        const close = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l))
        if (close > 0) {
            if (line <= close) return close
            start = close + 1
        }
    }
    let open: { line: number; fence: string } | null = null
    for (let i = start; i < lines.length; i++) {
        const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]!)?.[1]
        if (!open) {
            if (fence) open = { line: i, fence }
        } else if (
            fence &&
            fence[0] === open.fence[0] &&
            fence.length >= open.fence.length &&
            /^\s{0,3}[`~]+\s*$/.test(lines[i]!)
        ) {
            if (line >= open.line && line <= i) return i
            open = null
        }
        if (i > line && !open) break
    }
    // An unclosed fence runs to the end of the note.
    return open && line >= open.line ? lines.length - 1 : null
}

/**
 * Puts a block at the cursor of `editor`, on its own lines; after the properties or the code
 * block the cursor is in, rather than inside them.
 */
export function insertBlock(editor: Editor, block: string): void {
    const from = editor.getCursor('from')
    const to = editor.getCursor('to')
    const lines = editor.getValue().split('\n')
    const end = regionEnd(lines, from.line) ?? regionEnd(lines, to.line)
    if (end !== null) {
        const ch = lines[end]!.length
        editor.setCursor({ line: end, ch })
        editor.replaceSelection(blockInsertion(lines[end]!, '', block))
        return
    }
    editor.replaceSelection(
        blockInsertion(
            editor.getLine(from.line).slice(0, from.ch),
            editor.getLine(to.line).slice(to.ch),
            block
        )
    )
}

/**
 * A text file's characters whatever its encoding: UTF-8 (BOM or not), UTF-16 (with a BOM, or
 * without one when NUL bytes fill every other byte, as in mostly-ASCII text), else Windows-1252
 * (older ChordPro files from Windows).
 */
export function decodeText(bytes: Uint8Array): string {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
    const sample = bytes.subarray(0, 4096)
    const pairs = Math.floor(sample.length / 2)
    if (pairs >= 2) {
        let even = 0
        let odd = 0
        for (let i = 0; i < pairs * 2; i += 2) {
            if (sample[i] === 0) even++
            if (sample[i + 1] === 0) odd++
        }
        if (odd > pairs * 0.4 && even < pairs * 0.1)
            return new TextDecoder('utf-16le').decode(bytes)
        if (even > pairs * 0.4 && odd < pairs * 0.1)
            return new TextDecoder('utf-16be').decode(bytes)
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        return new TextDecoder('windows-1252').decode(bytes)
    }
}

/**
 * Whether a song's text is ChordPro (directives, or chords in brackets) rather than a chord sheet.
 * Bracketed words that aren't chords (`[Verse 1]`, `[Chorus]`) are a chord sheet's section labels.
 */
export const isChordPro = (text: string): boolean =>
    /^\s*\{[a-z_]+[:}]/im.test(text) ||
    [...text.matchAll(/\[([^\]\n]{1,16})\]/g)].some((m) => readChord(m[1]!.trim()) !== null)

/** A file name a wikilink can point to: no `#`, `|`, `^` or brackets (they cut the link). */
export const linkableName = (name: string): string =>
    name
        .replace(/[#|^[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Score'

/** A song file's chord chart: ChordPro as it is, a chord sheet (chords over lyrics) converted. */
export function chordChartOf(text: string): string {
    const song = text.replace(/\r\n?/g, '\n')
    return fenced('chords', isChordPro(song) ? song : chordSheetToChordPro(song))
}

/** A score file read and checked, before any note or attachment is made for it. */
export interface PreparedScore {
    file: File
    bytes: Uint8Array
    language: 'tab' | 'score'
    /** The block's settings line ("staves: both\n" for guitar files). */
    staves: string
    /** The inline alphaTex. */
    tex: () => string
    /** The copy linkBlock made in the vault, removed again when the import fails. */
    copy?: TFile
}

/** A fenced block, with a longer fence when the content holds one. */
export function fenced(language: string, body: string): string {
    const longest = Math.max(2, ...[...body.matchAll(/`{3,}/g)].map((m) => m[0].length))
    const fence = '`'.repeat(longest + 1)
    return `${fence}${language}\n${body.trim()}\n${fence}`
}

/**
 * Imports (#19): blocks go at the cursor of the note being edited; score files are linked (copied
 * to the attachments folder, added to the note's sources) or written inline as alphaTex.
 */
export class ImportService {
    constructor(
        private readonly app: App,
        private readonly runtime: AlphaTabRuntime,
        private readonly fields: () => FieldNames
    ) {}

    /** The note being edited, with its editor; null when none is. */
    editing(): { file: TFile; insert: (text: string) => void } | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (!view?.file || view.getMode() !== 'source') return null
        const editor = view.editor
        return {
            file: view.file,
            insert: (text) => insertBlock(editor, text)
        }
    }

    /**
     * Puts a block at the cursor, else under the title of `fallback` (a new note, opened by the
     * caller once the import worked). `block` may need the note (a linked score file); a new note
     * is trashed when that fails, so a failed import leaves nothing behind.
     */
    async place(
        block: string | ((note: TFile) => Promise<string>),
        fallback: () => Promise<TFile>
    ): Promise<{ file: TFile; created: boolean }> {
        const editing = this.editing()
        if (editing) {
            editing.insert(typeof block === 'string' ? block : await block(editing.file))
            return { file: editing.file, created: false }
        }
        const file = await fallback()
        try {
            const text = typeof block === 'string' ? block : await block(file)
            await this.app.vault.process(file, (content) => insertUnderTitle(content, text))
        } catch (error) {
            await this.app.fileManager.trashFile(file).catch(() => {})
            throw error
        }
        return { file, created: true }
    }

    /** Asks for a file to import (score files and ChordPro). */
    pickFile(): Promise<File | null> {
        return new Promise((resolve) => {
            const input = activeDocument.body.createEl('input', {
                type: 'file',
                attr: {
                    accept: [...SCORE_EXTENSIONS, ...CHORDPRO_EXTENSIONS]
                        .map((e) => `.${e}`)
                        .join(',')
                }
            })
            input.hide()
            input.addEventListener('change', () => {
                resolve(input.files?.[0] ?? null)
                input.remove()
            })
            input.addEventListener('cancel', () => {
                resolve(null)
                input.remove()
            })
            input.click()
        })
    }

    isChordPro(file: File): boolean {
        return CHORDPRO_EXTENSIONS.includes(extensionOf(file.name))
    }

    /** A ChordPro or chord sheet file's chord chart block, in any usual encoding. */
    async chordProBlock(file: File): Promise<string> {
        return chordChartOf(decodeText(new Uint8Array(await file.arrayBuffer())))
    }

    /**
     * Reads and checks a score file (nothing is written yet). Guitar-like files draw tablature
     * with notation, others notation. Imports run in the main window, where the file's bytes are.
     */
    async prepareScore(file: File): Promise<PreparedScore> {
        if (!SCORE_EXTENSIONS.includes(extensionOf(file.name)))
            throw new Error(`"${file.name}" isn't a score file this can read.`)
        const bytes = new Uint8Array(await file.arrayBuffer())
        const alphaTab = await this.runtime.module(window)
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes)
        const fretted = score.tracks.some((t) => t.staves.some((s) => s.tuning.length > 0))
        return {
            file,
            bytes,
            language: fretted ? 'tab' : 'score',
            staves: fretted ? 'staves: both\n' : '',
            tex: () => scoreToAlphaTex(alphaTab, bytes)
        }
    }

    /** The inline block of a prepared score (its alphaTex). */
    inlineBlock(score: PreparedScore): string {
        return fenced(score.language, `${score.staves}${score.tex()}`)
    }

    /**
     * The block linking a prepared score from `note`: the file copied to the attachments folder
     * and added to the note's sources.
     */
    async linkBlock(score: PreparedScore, note: TFile): Promise<string> {
        // A retry (another mode, another note) makes its own copy.
        delete score.copy
        const path = normalizePath(
            await this.app.fileManager.getAvailablePathForAttachment(
                linkableName(score.file.name),
                note.path
            )
        )
        const copy = await this.app.vault.createBinary(path, score.bytes.slice().buffer)
        score.copy = copy
        const link = `[[${this.app.metadataCache.fileToLinktext(copy, note.path, true)}]]`
        await this.addSource(note, link)
        return fenced(score.language, `${score.staves}file: ${link}`)
    }

    /** Adds a link to the note's sources property, when it has one (or its type is unknown). */
    private async addSource(note: TFile, link: string): Promise<void> {
        const name = this.fields().sources
        await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
            if (!(name in fm)) return
            const current = fm[name]
            const list = Array.isArray(current)
                ? current.filter((v) => v !== null && v !== undefined).map(String)
                : typeof current === 'string' && current.trim()
                  ? [current]
                  : []
            if (!list.includes(link)) fm[name] = [...list, link]
        })
    }
}
