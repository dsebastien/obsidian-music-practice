import { MarkdownView, Notice, TFile } from 'obsidian'
import type { App, Editor, MarkdownSectionInformation } from 'obsidian'
import { closes, openingFence, unquoted } from '../domain/block-placement'
import { TAB_LANGUAGES, textTabOf } from './notation.service'
import type { ConvertRequest, TabLanguage } from './notation.service'

/**
 * Converting a plain-text tab block into a playable one (#60): the block's text becomes the
 * library's alphaTex, with the text tab kept in a comment at its end, so nothing is lost.
 */

/** A fenced code block of a note, by line (0-based, fences included). */
export interface CodeBlock {
    /** The info string's first word, lowercased (`tab`, `score`). */
    language: string
    open: number
    close: number
    /** What each body line starts with: the callout markers and the fence's indentation. */
    prefix: string
    /** The lines between the fences, without their prefix. */
    body: string[]
}

/** Lines `from` to `to` (excluded) replaced by `lines`. */
export interface LineChange {
    from: number
    to: number
    lines: string[]
}

/** Where a block was drawn from (Obsidian's section), when it can tell. */
export type Section = Pick<MarkdownSectionInformation, 'lineStart' | 'lineEnd'>

/** The note's fenced code blocks; a fence never closed isn't a block. Properties are skipped. */
export function codeBlocks(lines: string[]): CodeBlock[] {
    let i = 0
    if (lines[0]?.trim() === '---') {
        const close = lines.findIndex((l, n) => n > 0 && /^(---|\.\.\.)\s*$/.test(l))
        if (close > 0) i = close + 1
    }
    const blocks: CodeBlock[] = []
    for (; i < lines.length; i++) {
        const line = lines[i]!
        const fence = openingFence(line)
        if (!fence) continue
        const close = lines.findIndex((l, n) => n > i && closes(l, fence))
        if (close < 0) break
        const quote = /^(\s*>)+ ?/.exec(line)?.[0] ?? ''
        const inner = unquoted(line)
        const indent = inner.indexOf(fence)
        const info = inner.slice(indent + fence.length).trim()
        const strip = (l: string) => unquoted(l).replace(new RegExp(`^ {0,${indent}}`), '')
        blocks.push({
            language: (info.split(/\s/)[0] ?? '').toLowerCase(),
            open: i,
            close,
            prefix: quote + ' '.repeat(indent),
            body: lines.slice(i + 1, close).map(strip)
        })
        i = close
    }
    return blocks
}

/** The code block whose fences or body hold `line`; null when it's in none. */
export const blockAt = (lines: string[], line: number): CodeBlock | null =>
    codeBlocks(lines).find((b) => line >= b.open && line <= b.close) ?? null

/** Lines compared without the spaces around them, and without blank lines at the end. */
const comparable = (lines: string[]): string =>
    lines
        .join('\n')
        .trimEnd()
        .split('\n')
        .map((l) => l.trim())
        .join('\n')

/**
 * The `language` block of a note whose text is `source`: the one in `section` (where Obsidian
 * drew it), else the only one in the note; null when there's none, or several and no section.
 */
export function findBlock(
    lines: string[],
    language: string,
    source: string,
    section: Section | null
): CodeBlock | null {
    const wanted = comparable(source.split('\n'))
    const same = codeBlocks(lines).filter(
        (b) => b.language === language && comparable(b.body) === wanted
    )
    const inSection = section
        ? same.find((b) => b.close >= section.lineStart && b.open <= section.lineEnd)
        : undefined
    return inSection ?? (same.length === 1 ? same[0]! : null)
}

/** A block's new text, each line with the block's prefix (callouts, lists). */
export const replaceBody = (block: CodeBlock, text: string): LineChange => ({
    from: block.open + 1,
    to: block.close,
    lines: text.split('\n').map((l) => block.prefix + l)
})

export function applyChange(lines: string[], change: LineChange): string[] {
    return [...lines.slice(0, change.from), ...change.lines, ...lines.slice(change.to)]
}

/**
 * A text tab block's new text: the library's alphaTex, then the text tab in a comment (a block
 * comment, or line comments when the tab holds one); null when the library can't read the tab.
 */
export function convertedTab(source: string): string | null {
    const tex = textTabOf(source)
    if (tex === null) return null
    const original = source.trimEnd()
    const comment =
        original.includes('*/') || original.includes('/*')
            ? `// Converted from this text tab:\n${original
                  .split('\n')
                  .map((l) => `// ${l}`)
                  .join('\n')}`
            : `/* Converted from this text tab:\n${original}\n*/`
    return `${tex}\n\n${comment}`
}

export const isTabLanguage = (language: string): language is TabLanguage =>
    (TAB_LANGUAGES as readonly string[]).includes(language)

/** A text tab block the library reads, in a tab or score block. */
export const convertible = (block: CodeBlock): block is CodeBlock & { language: TabLanguage } =>
    isTabLanguage(block.language) && convertedTab(block.body.join('\n')) !== null

/** A note's text to change: `edit` gets its lines and returns the change, or null to leave it. */
export interface NoteText {
    edit(change: (lines: string[]) => LineChange | null): Promise<boolean>
}

/** The note in an editor: one transaction, so Ctrl+Z (Cmd+Z) undoes it. */
export const editorText = (editor: Editor): NoteText => ({
    edit: (change) => {
        const made = change(editor.getValue().split('\n'))
        if (!made) return Promise.resolve(false)
        const last = made.to - 1
        editor.transaction({
            changes: [
                made.from <= last
                    ? {
                          from: { line: made.from, ch: 0 },
                          to: { line: last, ch: editor.getLine(last).length },
                          text: made.lines.join('\n')
                      }
                    : { from: { line: made.from, ch: 0 }, text: `${made.lines.join('\n')}\n` }
            ]
        })
        return Promise.resolve(true)
    }
})

/** The note's file, when no editor shows it (reading view, embeds): read and written at once. */
export const fileText = (app: App, file: TFile): NoteText => ({
    edit: async (change) => {
        let made = false
        await app.vault.process(file, (data) => {
            const lines = data.split('\n')
            const result = change(lines)
            if (!result) return data
            made = true
            return applyChange(lines, result).join('\n')
        })
        return made
    }
})

/**
 * Converts a text tab block in its note and offers Undo in the notice. The editor showing the
 * note does the change when it's in editing view (so Ctrl+Z undoes it too), else the file.
 */
export class TextTabConverter {
    constructor(
        private readonly app: App,
        /** A notice with an Undo button (replaced in tests). */
        private readonly noticeWithUndo: (
            message: string,
            undo: () => Promise<void>
        ) => void = undoNotice
    ) {}

    /** The note's text: its editor in editing view (the one the block is in first), else its file. */
    private textOf(sourcePath: string, el?: HTMLElement): NoteText | null {
        const views = this.app.workspace
            .getLeavesOfType('markdown')
            .map((leaf) => leaf.view)
            .filter((view): view is MarkdownView => view instanceof MarkdownView)
            .filter((view) => view.file?.path === sourcePath && view.getMode() === 'source')
        const view = views.find((v) => el && v.containerEl.contains(el)) ?? views[0]
        if (view) return editorText(view.editor)
        const file = this.app.vault.getAbstractFileByPath(sourcePath)
        return file instanceof TFile ? fileText(this.app, file) : null
    }

    /** The Convert button under a text tab block. */
    async convertBlock(request: ConvertRequest): Promise<void> {
        const text = this.textOf(request.sourcePath, request.el)
        if (!text) return
        const section = request.section()
        await this.run(text, request.sourcePath, (lines) =>
            findBlock(lines, request.language, request.source, section)
        )
    }

    /** Convert this text tab into a playable tab: the block at the cursor. */
    async convertAt(editor: Editor, sourcePath: string): Promise<void> {
        const line = editor.getCursor().line
        await this.run(editorText(editor), sourcePath, (lines) => blockAt(lines, line))
    }

    private async run(
        text: NoteText,
        sourcePath: string,
        find: (lines: string[]) => CodeBlock | null
    ): Promise<void> {
        // Set by the edit, once the block is found and converted.
        const found: { done?: { language: string; source: string; converted: string } } = {}
        try {
            const changed = await text.edit((lines) => {
                const block = find(lines)
                if (!block || !isTabLanguage(block.language)) return null
                const source = block.body.join('\n')
                const converted = convertedTab(source)
                if (converted === null) return null
                found.done = { language: block.language, source, converted }
                return replaceBody(block, converted)
            })
            if (!changed || !found.done) {
                new Notice(
                    "Couldn't find this text tab in the note: it may have changed. Try again."
                )
                return
            }
        } catch (error: unknown) {
            new Notice(
                `Couldn't convert the tab: ${error instanceof Error ? error.message : String(error)}`
            )
            return
        }
        const { language, source, converted } = found.done
        this.noticeWithUndo(
            'Converted the tab. The text tab stays in a comment at the end of the block.',
            () => this.undo(sourcePath, language, converted, source)
        )
    }

    /** Puts the text tab back, when the converted block is still as it was written. */
    private async undo(
        sourcePath: string,
        language: string,
        converted: string,
        source: string
    ): Promise<void> {
        const text = this.textOf(sourcePath)
        const undone = text
            ? await undoConversion(text, language, converted, source).catch(() => false)
            : false
        new Notice(
            undone
                ? 'The text tab is back.'
                : "Couldn't undo: the converted tab changed or isn't in the note anymore."
        )
    }
}

/** A notice with an Undo button, for ten seconds. */
function undoNotice(message: string, undo: () => Promise<void>): void {
    const fragment = createFragment((f) => {
        f.createSpan({ text: `${message} ` })
        const button = f.createEl('button', { text: 'Undo', cls: 'mp-notice-undo' })
        button.addEventListener('click', () => {
            notice.hide()
            void undo()
        })
    })
    const notice = new Notice(fragment, 10_000)
}

/** Gives a converted block its text tab back; false when the block changed or is gone. */
export const undoConversion = (
    text: NoteText,
    language: string,
    converted: string,
    source: string
): Promise<boolean> =>
    text.edit((lines) => {
        const block = findBlock(lines, language, converted, null)
        return block ? replaceBody(block, source) : null
    })
