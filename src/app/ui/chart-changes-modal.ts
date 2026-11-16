import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import type { RankedChange } from '../domain/chart-changes'
import { t, tn } from '../i18n/i18n'

/** A ranked change with the chord notes it would drill (null when the vault has none). */
export interface ChangeRow extends RankedChange {
    noteA: string | null
    noteB: string | null
    /** The pair note's best changes in a minute, when it was drilled. */
    best: number | null
}

export interface ChartChangesDeps {
    /** The piece's name, for the title. */
    name: string
    rows: ChangeRow[]
    /** Start a chord change drill on two chord notes. */
    drill: (a: string, b: string) => void
}

/** Chord change drills from a chart (#74): the piece's changes, hardest first, to drill. */
export class ChartChangesModal extends Modal {
    constructor(
        app: App,
        private readonly deps: ChartChangesDeps
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle(t('tools.changes.title', { name: this.deps.name }))
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        contentEl.createDiv({
            cls: 'mp-item-meta',
            text: t('tools.changes.intro')
        })
        const list = contentEl.createDiv({ cls: 'mp-list' })
        for (const row of this.deps.rows) {
            const card = list.createDiv({ cls: 'mp-item' })
            const head = card.createDiv({ cls: 'mp-item-head' })
            head.createSpan({ cls: 'mp-item-name', text: `${row.a} ↔ ${row.b}` })
            const facts = [
                tn('tools.changes.times', row.count),
                row.effort === null
                    ? t('tools.changes.effortUnknown')
                    : t('tools.changes.effort', { effort: row.effort }),
                ...(row.best !== null ? [t('tools.changes.best', { best: row.best })] : [])
            ]
            card.createDiv({ cls: 'mp-item-meta', text: facts.join(' · ') })
            const missing = [...(row.noteA ? [] : [row.a]), ...(row.noteB ? [] : [row.b])]
            if (missing.length) {
                card.createDiv({
                    cls: 'mp-item-meta',
                    text: t('tools.changes.noNote', {
                        chords: missing.join(t('tools.changes.and'))
                    })
                })
                continue
            }
            const button = card.createEl('button', { text: t('tools.changes.drill') })
            button.addEventListener('click', () => {
                this.close()
                this.deps.drill(row.noteA!, row.noteB!)
            })
        }
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions
            .createEl('button', { text: t('common.close') })
            .addEventListener('click', () => this.close())
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
