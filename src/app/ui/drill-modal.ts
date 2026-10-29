import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { renderBlock } from '@dsebastien/music-notation'
import type { RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { countOf, type DrillPair } from '../domain/drill'
import type { LearningItem } from '../domain/practice'
import { ItemSuggestModal } from './practice-panel-view'

export interface DrillDeps {
    /** Pairs to suggest, slowest first. */
    suggestions: () => DrillPair[]
    chords: () => LearningItem[]
    nameOf: (path: string) => string
    /** A chord note's ```chord block source from its properties; null when it has none. */
    chordSource: (path: string) => string | null
    renderOptions: () => RenderOptions
    seconds: () => number
    save: (
        pair: DrillPair,
        count: number
    ) => Promise<{ path: string; best: number; improved: boolean }>
    /** Open Log practice for the drill. */
    log: (path: string, minutes: number, note: string) => void
    /** Show the easiest way between the pair's chords (#57). */
    easiestWay?: (pair: DrillPair) => void
}

/** One chord change drill: pick a pair, count the changes in a minute, save, log (#40). */
export class DrillModal extends Modal {
    private pair: DrillPair | null
    private count = 0
    private remaining = 0
    private running = false
    private timer: number | null = null
    private diagram: RenderResult | null = null

    constructor(
        app: App,
        private readonly deps: DrillDeps,
        pair: DrillPair | null = null
    ) {
        super(app)
        this.pair = pair
    }

    override onOpen(): void {
        this.setTitle('Chord change drill')
        this.contentEl.addClass('mp-modal')
        // Space counts a change while the drill runs.
        this.scope.register([], ' ', (event) => {
            if (!this.running) return true
            event.preventDefault()
            this.bump()
            return false
        })
        if (this.pair) this.renderDrill()
        else this.renderPick()
    }

    override onClose(): void {
        this.stop()
        this.diagram?.destroy()
        this.contentEl.empty()
    }

    private renderPick(): void {
        const el = this.contentEl
        el.empty()
        const pairs = this.deps.suggestions()
        el.createEl('p', {
            cls: 'mp-muted',
            text: pairs.length
                ? 'Pairs among your current chords, the slowest first.'
                : 'Add chord notes to drill changes between them.'
        })
        const list = el.createDiv({ cls: 'mp-list' })
        for (const pair of pairs.slice(0, 12)) {
            const row = list.createEl('button', { cls: 'mp-drill-pair' })
            row.createSpan({ text: `${this.deps.nameOf(pair.a)} ↔ ${this.deps.nameOf(pair.b)}` })
            row.createSpan({
                cls: 'mp-muted',
                text:
                    pair.best === null
                        ? 'never drilled'
                        : `best ${pair.best}, last ${pair.last ?? '?'}`
            })
            row.addEventListener('click', () => {
                this.pair = pair
                this.renderDrill()
            })
        }
        el.createDiv({ cls: 'mp-actions' })
            .createEl('button', { text: 'Pick two chords' })
            .addEventListener('click', () => this.pickTwo())
    }

    private pickTwo(): void {
        const chords = this.deps.chords()
        new ItemSuggestModal(this.app, chords, (a) => {
            new ItemSuggestModal(
                this.app,
                chords.filter((c) => c.path !== a.path),
                (b) => {
                    const existing = this.deps
                        .suggestions()
                        .find(
                            (p) =>
                                (p.a === a.path && p.b === b.path) ||
                                (p.a === b.path && p.b === a.path)
                        )
                    this.pair = existing ?? {
                        a: a.path,
                        b: b.path,
                        note: null,
                        best: null,
                        last: null
                    }
                    this.renderDrill()
                }
            ).open()
        }).open()
    }

    private renderDrill(): void {
        const pair = this.pair
        if (!pair) return
        const el = this.contentEl
        el.empty()
        this.count = 0
        this.remaining = this.deps.seconds()
        el.createDiv({
            cls: 'mp-drill-title',
            text: `${this.deps.nameOf(pair.a)} ↔ ${this.deps.nameOf(pair.b)}`
        })
        if (pair.best !== null)
            el.createDiv({
                cls: 'mp-muted',
                text: `Best ${pair.best} changes, last ${pair.last ?? '?'}`
            })
        // Both chords side by side, as their notes draw them.
        const sources = [pair.a, pair.b].map((p) => this.deps.chordSource(p))
        this.diagram?.destroy()
        if (sources.every((s) => s !== null))
            this.diagram = renderBlock(
                'chord',
                sources.join('\n---\n'),
                el.createDiv({ cls: 'mp-notation-preview' }),
                this.deps.renderOptions()
            )

        const clock = el.createDiv({ cls: 'mp-drill-clock' })
        const counter = el.createEl('button', {
            cls: 'mp-drill-count mod-cta',
            attr: { 'aria-label': 'Count a change (space bar)' }
        })
        const actions = el.createDiv({ cls: 'mp-actions' })
        const start = actions.createEl('button', { text: 'Start' })
        if (this.deps.easiestWay)
            actions
                .createEl('button', { text: 'Easiest way' })
                .addEventListener('click', () => this.deps.easiestWay?.(pair))
        const result = el.createDiv({ cls: 'mp-drill-result' })
        const show = () => {
            clock.setText(`${this.remaining} s`)
            counter.setText(`+1 · ${this.count}`)
            counter.disabled = !this.running
        }
        counter.addEventListener('click', () => {
            this.bump()
            show()
        })
        this.onTick = show
        start.addEventListener('click', () => {
            start.disabled = true
            this.run(() => this.renderResult(result))
        })
        show()
    }

    private onTick: () => void = () => {}

    private bump(): void {
        if (!this.running) return
        this.count++
        this.onTick()
    }

    private run(done: () => void): void {
        this.running = true
        this.onTick()
        this.timer = window.setInterval(() => {
            this.remaining--
            this.onTick()
            if (this.remaining <= 0) {
                this.stop()
                this.onTick()
                done()
            }
        }, 1000)
    }

    private stop(): void {
        if (this.timer !== null) window.clearInterval(this.timer)
        this.timer = null
        this.running = false
    }

    private renderResult(el: HTMLElement): void {
        const pair = this.pair!
        el.empty()
        const field = el.createEl('label', { cls: 'mp-field', text: 'Changes' })
        const input = field.createEl('input', { type: 'number', attr: { min: '0' } })
        input.value = String(this.count)
        const actions = el.createDiv({ cls: 'mp-actions' })
        const save = actions.createEl('button', { cls: 'mod-cta', text: 'Save' })
        save.addEventListener('click', () => {
            const count = countOf(input.value)
            if (count === null) {
                new Notice('Enter the number of changes, from 0.')
                return
            }
            save.disabled = true
            void this.deps
                .save(pair, count)
                .then((saved) => {
                    new Notice(
                        saved.improved
                            ? `New best: ${count} changes.`
                            : `${count} changes (best ${saved.best}).`
                    )
                    const minutes = Math.max(1, Math.round(this.deps.seconds() / 60))
                    const note = `${this.deps.nameOf(pair.a)} ↔ ${this.deps.nameOf(pair.b)}: ${count} changes`
                    el.empty()
                    const next = el.createDiv({ cls: 'mp-actions' })
                    next.createEl('button', {
                        cls: 'mod-cta',
                        text: 'Log this drill'
                    }).addEventListener('click', () => {
                        this.close()
                        this.deps.log(saved.path, minutes, note)
                    })
                    next.createEl('button', { text: 'Again' }).addEventListener('click', () => {
                        this.pair = { ...pair, note: saved.path, best: saved.best, last: count }
                        this.renderDrill()
                    })
                    next.createEl('button', { text: 'Another pair' }).addEventListener(
                        'click',
                        () => {
                            this.pair = null
                            this.renderPick()
                        }
                    )
                })
                .catch((error: unknown) => {
                    save.disabled = false
                    new Notice(error instanceof Error ? error.message : String(error))
                })
        })
    }
}
