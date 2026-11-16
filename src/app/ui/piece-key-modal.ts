import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { renderBlock } from '@dsebastien/music-notation'
import type { RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { fitBlock, sameKey } from '../domain/piece-key'
import type { PieceKey } from '../domain/piece-key'
import { t } from '../i18n/i18n'

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
        this.setTitle(t('tools.pieceKey.title', { name: this.deps.name }))
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        contentEl.createDiv({
            cls: 'mp-item-meta',
            text: t('tools.pieceKey.chords', { chords: result.chords.join(' ') })
        })
        const key = result.key
        const head = contentEl.createDiv({ cls: 'mp-item-head' })
        head.createEl('strong', {
            text: key
                ? t(result.blues ? 'tools.pieceKey.keyBlues' : 'tools.pieceKey.key', { key })
                : t('tools.pieceKey.noKey')
        })
        if (result.alternatives.length)
            contentEl.createDiv({
                cls: 'mp-item-meta',
                text: t('tools.pieceKey.notClear', {
                    keys: [key, ...result.alternatives].join(t('tools.pieceKey.or'))
                })
            })
        if (result.outside.length)
            contentEl.createDiv({
                cls: 'mp-item-meta',
                text: t('tools.pieceKey.outside', { chords: result.outside.join(' ') })
            })

        if (result.scales.length) {
            contentEl.createEl('h3', { text: t('tools.pieceKey.scales') })
            const list = contentEl.createEl('ol', { cls: 'mp-list' })
            for (const scale of result.scales)
                list.createEl('li', {
                    text: scale.outside.length
                        ? t('tools.pieceKey.scaleOutside', {
                              name: scale.name,
                              chords: scale.outside.join(' ')
                          })
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
        actions
            .createEl('button', { text: t('common.close') })
            .addEventListener('click', () => this.close())
        if (key && setKey) {
            const done = sameKey(this.deps.currentKey, key)
            const button = actions.createEl('button', {
                cls: done ? '' : 'mod-cta',
                text: done
                    ? t('tools.pieceKey.isKey', { key })
                    : t('tools.pieceKey.setKey', { key })
            })
            button.disabled = done
            button.addEventListener('click', () => {
                void setKey(key)
                    .then(() => {
                        new Notice(t('tools.pieceKey.keySet', { key }))
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
