import { Modal, SuggestModal } from 'obsidian'
import type { App } from 'obsidian'

/**
 * Paste a text tab or a chord sheet (#19): converted to a ```tab or ```chords block, previewed as
 * text, then inserted.
 */
export class PasteImportModal extends Modal {
    constructor(
        app: App,
        private readonly kind: 'tab' | 'chords',
        /** The block for the pasted text; null when nothing in it can be converted. */
        private readonly convert: (text: string) => string | null,
        private readonly insert: (block: string) => Promise<void>
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle(this.kind === 'tab' ? 'Import a text tab' : 'Import a chord sheet')
        const el = this.contentEl
        el.addClass('mp-modal')
        el.createEl('p', {
            cls: 'mp-muted',
            text:
                this.kind === 'tab'
                    ? 'Paste a tab (lines of dashes and frets, one per string). It becomes a tab block you can play; text tabs have no rhythm, so every note is an eighth.'
                    : 'Paste a chord sheet (chords on their own line above the lyrics). It becomes a chord chart you can transpose.'
        })
        const input = el.createEl('textarea', { cls: 'mp-import-text', attr: { rows: '12' } })
        const preview = el.createEl('pre', { cls: 'mp-import-preview' })
        const actions = el.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        const go = actions.createEl('button', { cls: 'mod-cta', text: 'Insert' })
        let block: string | null = null
        const update = () => {
            block = input.value.trim() ? this.convert(input.value) : null
            preview.setText(
                block ?? (input.value.trim() ? 'Nothing in this text could be converted.' : '')
            )
            go.disabled = block === null
        }
        input.addEventListener('input', update)
        go.addEventListener('click', () => {
            if (!block) return
            go.disabled = true
            this.insert(block)
                .then(() => this.close())
                .catch((error: unknown) => {
                    console.error('Music Practice: import failed', error)
                    go.disabled = false
                })
        })
        update()
        window.setTimeout(() => input.focus(), 0)
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}

export type ScoreImportMode = 'inline' | 'link'

/** Inline alphaTex (editable) or a link to the file (keeps everything). */
export class ScoreImportModeModal extends SuggestModal<ScoreImportMode> {
    constructor(
        app: App,
        private readonly onChoose: (mode: ScoreImportMode) => void
    ) {
        super(app)
        this.setPlaceholder('How should the score go into the note?')
    }

    override getSuggestions(): ScoreImportMode[] {
        return ['link', 'inline']
    }

    override renderSuggestion(mode: ScoreImportMode, el: HTMLElement): void {
        el.createDiv({ text: mode === 'link' ? 'Link to the file' : 'Inline alphaTex' })
        el.createEl('small', {
            cls: 'mp-muted',
            text:
                mode === 'link'
                    ? 'The file goes to your attachments folder; nothing is lost.'
                    : 'The music as text in the note, which you can edit; some details of the file may be lost.'
        })
    }

    override onChooseSuggestion(mode: ScoreImportMode): void {
        this.onChoose(mode)
    }
}
