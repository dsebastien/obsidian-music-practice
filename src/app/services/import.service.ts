import { MarkdownView, normalizePath } from 'obsidian'
import type { App, Editor, TFile } from 'obsidian'
import { chordSheetToChordPro, readChord } from '@dsebastien/music-notation'
import { scoreToAlphaTex } from '@dsebastien/music-notation/tab'
import type { FieldNames } from '../domain/fields'
import { insertUnderTitle } from '../domain/notation-note'
import { blockInsertion, blockTarget } from '../domain/block-placement'
import type { NoteSection } from '../domain/block-placement'
import { safeTitle } from '../domain/chord'
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

/** Insert a tab block's text for a cursor between `before` and `after`. */
export const tabBlockInsertion = (before: string, after: string): string =>
    blockInsertion(before, after, fenced('tab', TAB_STARTER))

/**
 * Puts a block at the cursor of `editor`, on its own lines; after the properties, the code, math
 * or HTML block the cursor is in, rather than inside them. `sections` is the note's section map
 * (the metadata cache's); the line scan stands in when it's missing or behind the editor.
 */
export function insertBlock(
    editor: Editor,
    block: string,
    sections?: readonly NoteSection[] | null
): void {
    const from = editor.getCursor('from')
    const to = editor.getCursor('to')
    const text = editor.getValue()
    const end = blockTarget(text, from.line, to.line, sections)
    if (end === -1) {
        editor.setCursor({ line: 0, ch: 0 })
        editor.replaceSelection(`${block}\n`)
        return
    }
    if (end !== null) {
        const line = editor.getLine(end)
        editor.setCursor({ line: end, ch: line.length })
        editor.replaceSelection(blockInsertion(line, '', block))
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

/** Characters text doesn't hold: controls (but tabs and line breaks), unassigned, private use. */
const UNREADABLE = /(?![\t\n\r\f])[\p{Cc}\p{Cn}\p{Co}\p{Cs}\uFFFD]/gu

/**
 * ASCII text and spaces: chord names, brackets, spaces and line breaks, which UTF-16 chord files
 * hold in any script. Bytes read as UTF-16 by mistake (or in the wrong byte order) rarely do:
 * every one of them needs a NUL byte in the right place.
 */
const ASCII = /[\t\n\r\u0020-\u007e\u3000]/g

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0

/** Whether decoded text reads as text: at most 1% of unreadable characters (one in a short text). */
const readable = (text: string) => count(text, UNREADABLE) <= Math.max(1, text.length / 100)

const decodeStrict = (encoding: string, bytes: Uint8Array): string | null => {
    try {
        return new TextDecoder(encoding, { fatal: true }).decode(bytes)
    } catch {
        return null
    }
}

/**
 * A text file's characters whatever its encoding and script: UTF-8 (BOM or not); UTF-16 with a
 * BOM; UTF-16 without one (little- or big-endian, whichever reads as text with ASCII in it: chord
 * files in Cyrillic, Greek or CJK too); else Windows-1252 (older ChordPro files from Windows).
 * Throws when none of them reads as text.
 */
export function decodeText(bytes: Uint8Array): string {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
    const utf8 = decodeStrict('utf-8', bytes)
    // UTF-16 read as UTF-8 is full of NULs and other controls.
    if (utf8 !== null && readable(utf8)) return utf8
    const utf16 = (['utf-16le', 'utf-16be'] as const)
        .map((encoding) => decodeStrict(encoding, bytes))
        .filter((text): text is string => text !== null && readable(text) && count(text, ASCII) > 0)
        .map((text) => ({ text, unreadable: count(text, UNREADABLE), ascii: count(text, ASCII) }))
        .sort((a, b) => a.unreadable - b.unreadable || b.ascii - a.ascii)[0]
    if (utf16) return utf16.text
    const windows = new TextDecoder('windows-1252').decode(bytes)
    if (readable(windows)) return windows
    throw new Error("its text can't be read (it isn't UTF-8, UTF-16 or Windows-1252 text).")
}

/**
 * Whether a song's text is ChordPro (directives, or chords in brackets) rather than a chord sheet.
 * Bracketed words that aren't chords (`[Verse 1]`, `[Chorus]`), and a bracket alone on its line
 * (`[A]`), are a chord sheet's section labels.
 */
export const isChordPro = (text: string): boolean =>
    /^\s*\{[a-z_]+[:}]/im.test(text) ||
    text.split('\n').some((line) => {
        const brackets = [...line.matchAll(/\[([^\]\n]{1,16})\]/g)]
        // A bracket alone on its line is a section label ([A], [Verse 1]), not a chord.
        if (!line.replace(/\[[^\]\n]*\]/g, '').trim() && brackets.length < 2) return false
        return brackets.some((m) => readChord(m[1]!.trim()) !== null)
    })

/**
 * A file name a wikilink can point to: the name without `#`, `|`, `^`, brackets or path
 * characters (they cut the link), "Score" when nothing is left; the extension kept.
 */
export const linkableName = (name: string): string => {
    const dot = name.lastIndexOf('.')
    const base = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    return `${safeTitle(base) || 'Score'}${ext}`
}

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
        const { editor, file } = view
        return {
            file,
            insert: (text) =>
                insertBlock(editor, text, this.app.metadataCache.getFileCache(file)?.sections)
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
