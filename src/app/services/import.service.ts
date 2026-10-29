import { MarkdownView, normalizePath } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { scoreToAlphaTex } from '@dsebastien/music-notation/tab'
import type { FieldNames } from '../domain/fields'
import { insertUnderTitle } from '../domain/notation-note'
import type { AlphaTabRuntime } from './alphatab.service'
import type { ScoreImportMode } from '../ui/import-modals'

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

    /** Puts a block at the cursor, else under the title of `fallback` (a new note). */
    async place(block: string, fallback: () => Promise<TFile>): Promise<TFile> {
        const editing = this.editing()
        if (editing) {
            editing.insert(block)
            return editing.file
        }
        const file = await fallback()
        await this.app.vault.process(file, (text) => insertUnderTitle(text, block))
        return file
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

    /** A ChordPro file's chord chart block. */
    async chordProBlock(file: File): Promise<string> {
        return fenced('chords', await file.text())
    }

    /**
     * A score file's block for `note`: a link to the file (copied next to the note, added to its
     * sources) or its alphaTex. Guitar-like files draw tablature with notation, others notation.
     */
    async scoreBlock(file: File, mode: ScoreImportMode, note: TFile): Promise<string> {
        if (!SCORE_EXTENSIONS.includes(extensionOf(file.name)))
            throw new Error(`"${file.name}" isn't a score file this can read.`)
        const bytes = new Uint8Array(await file.arrayBuffer())
        const alphaTab = await this.runtime.module(activeWindow)
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes)
        const fretted = score.tracks.some((t) => t.staves.some((s) => s.tuning.length > 0))
        const language = fretted ? 'tab' : 'score'
        const staves = fretted ? 'staves: both\n' : ''
        if (mode === 'inline')
            return fenced(language, `${staves}${scoreToAlphaTex(alphaTab, bytes)}`)
        const path = normalizePath(
            await this.app.fileManager.getAvailablePathForAttachment(file.name, note.path)
        )
        const copy = await this.app.vault.createBinary(path, bytes.slice().buffer)
        await this.addSource(note, `[[${copy.name}]]`)
        return fenced(language, `${staves}file: [[${copy.name}]]`)
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
