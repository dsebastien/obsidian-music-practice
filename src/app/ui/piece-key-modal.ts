import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { renderBlock } from '@dsebastien/music-notation'
import type { RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { fitBlock, sameKey } from '../domain/piece-key'
import type { PieceKey } from '../domain/piece-key'

export interface PieceKeyDeps {
    /** The piece's name, for the title. */
    name: string
    result: PieceKey
    /** Where the scale is drawn: a fretboard for guitar pieces, a keyboard for piano ones. */
    language: 'fretboard' | 'keyboard'
    /** Whether Music Practice draws that language. */
    drawn: boolean
    renderOptions: () => RenderOptions
    /** The piece's key property as it is now. */
    currentKey: unknown
    /** Writes the key property; absent when the piece's type has none. */
    setKey?: (key: string) => Promise<void>
}

/** Scales for this progression (#67): a piece's key and the scales that fit its chords. */
export class PieceKeyModal extends Modal {
    private diagram: RenderResult | null = null

    constructor(
        app: App,
        private readonly deps: PieceKeyDeps
    ) {
        super(app)
    }

    override onOpen(): void {
        const { result, setKey } = this.deps
        this.setTitle(`Key and scales: ${this.deps.name}`)
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        contentEl.createDiv({ cls: 'mp-item-meta', text: `Chords: ${result.chords.join(' ')}` })
        const key = result.key
        const head = contentEl.createDiv({ cls: 'mp-item-head' })
        head.createEl('strong', {
            text: key ? `Key: ${key}${result.blues ? ' (blues)' : ''}` : 'No key found'
        })
        if (result.alternatives.length)
            contentEl.createDiv({
                cls: 'mp-item-meta',
                text: `Not clear: ${[key, ...result.alternatives].join(' or ')} fit about as well.`
            })
        if (result.outside.length)
            contentEl.createDiv({
                cls: 'mp-item-meta',
                text: `Outside the key: ${result.outside.join(' ')}`
            })

        if (result.scales.length) {
            contentEl.createEl('h3', { text: 'Scales that fit' })
            const list = contentEl.createEl('ol', { cls: 'mp-list' })
            for (const scale of result.scales)
                list.createEl('li', {
                    text: scale.outside.length
                        ? `${scale.name} (outside: ${scale.outside.join(' ')})`
                        : scale.name
                })
        }
        if (this.deps.drawn)
            this.diagram = renderBlock(
                this.deps.language,
                fitBlock(result.chords),
                contentEl.createDiv({ cls: 'mp-notation-preview' }),
                this.deps.renderOptions()
            )

        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close())
        if (key && setKey) {
            const done = sameKey(this.deps.currentKey, key)
            const button = actions.createEl('button', {
                cls: done ? '' : 'mod-cta',
                text: done ? `Key is ${key}` : `Set the key to ${key}`
            })
            button.disabled = done
            button.addEventListener('click', () => {
                void setKey(key)
                    .then(() => {
                        new Notice(`Key set to ${key}.`)
                        this.close()
                    })
                    .catch(
                        (error: unknown) =>
                            new Notice(error instanceof Error ? error.message : String(error))
                    )
            })
        }
    }

    override onClose(): void {
        this.diagram?.destroy()
        this.diagram = null
        this.contentEl.empty()
    }
}
