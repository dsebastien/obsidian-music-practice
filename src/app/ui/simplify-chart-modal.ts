import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { renderBlock } from '@dsebastien/music-notation'
import type { Naming, RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { chordShown } from '../domain/note-names'
import { offersSomething, withOptionsOn } from '../domain/simpler-chart'
import type { SimplerChart } from '../domain/simpler-chart'
import { t } from '../i18n/i18n'

/** A chart of the note that has chords, with what Simplify this chart offers for it. */
export interface SimplifyChartEntry {
    /** Its title, else its place in the note ("Chart 2"). */
    label: string
    body: string
    chart: SimplerChart
}

export interface SimplifyChartDeps {
    /** The note's name, for the title. */
    name: string
    charts: SimplifyChartEntry[]
    /** Whether Music Practice draws chord charts. */
    drawn: boolean
    renderOptions: () => RenderOptions
    /** The naming charts are drawn in when they have none of their own (the Note names setting). */
    naming: () => Naming
    /** Writes `{simplify}` and `{capo: auto}` into the chart; rejects when it can't. */
    switchOn: (entry: SimplifyChartEntry) => Promise<void>
    /** Adds a simpler copy below the chart; rejects when it can't. */
    insertCopy: (entry: SimplifyChartEntry) => Promise<void>
}

/** Simplify this chart (#68): the easier chords and the best capo of a piece's chord chart. */
export class SimplifyChartModal extends Modal {
    private preview: RenderResult | null = null
    private entry: SimplifyChartEntry

    constructor(
        app: App,
        private readonly deps: SimplifyChartDeps
    ) {
        super(app)
        // The first chart that has something to offer, else the first one.
        this.entry = deps.charts.find((c) => offersSomething(c.chart)) ?? deps.charts[0]!
    }

    override onOpen(): void {
        this.setTitle(t('tools.simplify.title', { name: this.deps.name }))
        this.contentEl.addClass('mp-modal')
        this.draw()
    }

    private draw(): void {
        this.preview?.destroy()
        this.preview = null
        const { contentEl } = this
        contentEl.empty()
        const { charts } = this.deps
        if (charts.length > 1) {
            const pick = contentEl.createEl('select', {
                cls: 'dropdown',
                attr: { 'aria-label': t('tools.simplify.chart') }
            })
            charts.forEach((c, i) => {
                const option = pick.createEl('option', { text: c.label, value: String(i) })
                option.selected = c === this.entry
            })
            pick.addEventListener('change', () => {
                this.entry = charts[Number(pick.value)] ?? this.entry
                this.draw()
            })
        }
        const { chart, body } = this.entry
        // Chords are named as the chart draws them: its own naming, else the setting's.
        const naming = chart.naming ?? this.deps.naming()
        const named = (symbol: string) => chordShown(symbol, naming)
        const line = (text: string) => contentEl.createDiv({ cls: 'mp-item-meta', text })
        if (chart.piano) line(t('tools.simplify.piano'))
        else {
            line(
                chart.easier.length
                    ? t('tools.simplify.easier', {
                          chords: chart.easier
                              .map((c) => `${named(c.from)} → ${named(c.to)}`)
                              .join(', ')
                      })
                    : t('tools.simplify.noEasier')
            )
            line(
                chart.capo
                    ? t('tools.simplify.capo', {
                          capo: chart.capo.capo,
                          shapes: chart.capo.shapes.map((s) => named(s.shape)).join(', '),
                          open: chart.capo.open,
                          total: chart.capo.shapes.length
                      })
                    : chart.ownCapo !== null
                      ? t('tools.simplify.ownCapo', { capo: chart.ownCapo })
                      : t('tools.simplify.noCapo')
            )
        }
        const offers = offersSomething(chart)
        // The chart as it will be drawn with its options on.
        if (offers && this.deps.drawn)
            this.preview = renderBlock(
                'chords',
                withOptionsOn(body, chart),
                contentEl.createDiv({ cls: 'mp-notation-preview' }),
                this.deps.renderOptions()
            )

        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions
            .createEl('button', { text: t('common.close') })
            .addEventListener('click', () => this.close())
        if (!offers) return
        const run = (button: HTMLButtonElement, work: () => Promise<void>, done: string) =>
            button.addEventListener('click', () => {
                button.disabled = true
                void work()
                    .then(() => {
                        new Notice(done)
                        this.close()
                    })
                    .catch((error: unknown) => {
                        // Nothing written: the window stays open and says why.
                        button.disabled = false
                        new Notice(error instanceof Error ? error.message : String(error))
                    })
            })
        run(
            actions.createEl('button', { text: t('tools.simplify.insertCopy') }),
            () => this.deps.insertCopy(this.entry),
            t('tools.simplify.inserted')
        )
        // On already: the chart asks for everything this would add.
        const on = (!chart.easier.length || chart.simplifyOn) && (!chart.capo || chart.capoAutoOn)
        const switchOn = actions.createEl('button', {
            cls: on ? '' : 'mod-cta',
            text: t(on ? 'tools.simplify.alreadyOn' : 'tools.simplify.switchOn')
        })
        switchOn.disabled = on
        if (!on) run(switchOn, () => this.deps.switchOn(this.entry), t('tools.simplify.switched'))
    }

    override onClose(): void {
        this.preview?.destroy()
        this.preview = null
        this.contentEl.empty()
    }
}
