import { MarkdownView, normalizePath } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { chordSheetToChordPro } from '@dsebastien/music-notation'
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
 * Insert a tab block's text for a cursor between `before` and `after` (the rest of their lines):
 * a fence must start and end its own line, so text around the cursor moves to its own lines.
 */
export function tabBlockInsertion(before: string, after: string): string {
    return `${before.trim() ? '\n' : ''}${fenced('tab', TAB_STARTER)}\n${after.trim() ? '\n' : ''}`
}

/**
 * A text file's characters whatever its encoding: UTF-8 (BOM or not), UTF-16 with a BOM, else
 * Windows-1252 (older ChordPro files from Windows).
 */
export function decodeText(bytes: Uint8Array): string {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        return new TextDecoder('windows-1252').decode(bytes)
    }
}

/** Whether a song's text is ChordPro (chords in brackets, or directives) rather than a chord sheet. */
export const isChordPro = (text: string): boolean =>
    /\[[^\]\n]+\]/.test(text) || /^\s*\{[a-z_]+[:}]/im.test(text)

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
            insert: (text) => editor.replaceSelection(`\n${text}\n`)
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
        const path = normalizePath(
            await this.app.fileManager.getAvailablePathForAttachment(score.file.name, note.path)
        )
        const copy = await this.app.vault.createBinary(path, score.bytes.slice().buffer)
        const link = `[[${this.app.metadataCache.fileToLinktext(copy, note.path, true)}]]`
        try {
            await this.addSource(note, link)
        } catch (error) {
            await this.app.fileManager.trashFile(copy).catch(() => {})
            throw error
        }
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
