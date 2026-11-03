import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import type { RankedChange } from '../domain/chart-changes'

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
        this.setTitle(`Chord changes: ${this.deps.name}`)
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        contentEl.createDiv({
            cls: 'mp-item-meta',
            text: 'Hardest first: how much the hand moves between the two chords, then how often the song plays the change.'
        })
        const list = contentEl.createDiv({ cls: 'mp-list' })
        for (const row of this.deps.rows) {
            const card = list.createDiv({ cls: 'mp-item' })
            const head = card.createDiv({ cls: 'mp-item-head' })
            head.createSpan({ cls: 'mp-item-name', text: `${row.a} ↔ ${row.b}` })
            const facts = [
                `${row.count} ${row.count === 1 ? 'time' : 'times'}`,
                row.effort === null ? 'effort unknown' : `effort ${row.effort}`,
                ...(row.best !== null ? [`best ${row.best} a minute`] : [])
            ]
            card.createDiv({ cls: 'mp-item-meta', text: facts.join(' · ') })
            const missing = [...(row.noteA ? [] : [row.a]), ...(row.noteB ? [] : [row.b])]
            if (missing.length) {
                card.createDiv({
                    cls: 'mp-item-meta',
                    text: `No chord note for ${missing.join(' and ')}: add one to drill this change.`
                })
                continue
            }
            const button = card.createEl('button', { text: 'Drill' })
            button.addEventListener('click', () => {
                this.close()
                this.deps.drill(row.noteA!, row.noteB!)
            })
        }
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close())
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
