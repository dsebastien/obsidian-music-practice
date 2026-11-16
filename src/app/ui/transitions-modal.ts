import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import {
    fingerVoicing,
    generateVoicings,
    renderBlock,
    smoothProgression,
    transition
} from '@dsebastien/music-notation'
import type { GeneratedVoicing, RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { formatFingers, formatFrets } from '../domain/notation-note'
import { sameFrets } from '../domain/voicings'
import { titleShown } from '../domain/note-names'
import { alignGrid, selectCell, voicingCell } from './voicing-cell'
import { t, tn } from '../i18n/i18n'

/** A chord note as a transition sees it. */
export interface HeldChord {
    name: string
    symbol: string
    /** Its voicing; null when the note has no frets (its easiest voicing is used). */
    frets: (number | null)[] | null
}

/** Guitarist string numbers (1 = the highest) for a block's `anchors:` / `guides:`. */
const numbers = (strings: number[], count: number) => strings.map((s) => count - s).join(' ')

/** A diagram source with its anchors and guides marked. */
function source(
    symbol: string,
    title: string,
    voicing: { frets: (number | null)[]; fingers: (string | null)[] },
    anchors: number[] = [],
    guides: number[] = []
): string {
    const count = voicing.frets.length
    return [
        `symbol: ${symbol}`,
        `title: ${title}`,
        `frets: ${formatFrets(voicing.frets)}`,
        `fingers: ${formatFingers(voicing)}`,
        ...(anchors.length ? [`anchors: ${numbers(anchors, count)}`] : []),
        ...(guides.length ? [`guides: ${numbers(guides, count)}`] : [])
    ].join('\n')
}

/**
 * The easiest way from one chord to the next (#57): the next chord's voicings that move the hand
 * least from the one held, fingers that stay (ring) or slide (dashed ring) marked, with tips. A
 * voicing can be added as its own chord note.
 */
export class TransitionModal extends Modal {
    private diagrams: RenderResult[] = []
    private selected: GeneratedVoicing | null = null
    private busy = false

    constructor(
        app: App,
        private from: HeldChord,
        private to: HeldChord,
        private readonly options: {
            renderOptions: () => RenderOptions
            add?: (voicing: GeneratedVoicing, symbol: string) => Promise<void>
        }
    ) {
        super(app)
    }

    override onOpen(): void {
        this.modalEl.addClass('mp-voicings-modal')
        this.contentEl.addClass('mp-modal')
        this.render()
    }

    private render(): void {
        for (const d of this.diagrams) d.destroy()
        this.diagrams = []
        this.selected = null
        const el = this.contentEl
        el.empty()
        this.setTitle(t('tools.transition.title', { from: this.from.name, to: this.to.name }))
        // A note without frets starts from the chord's easiest voicing.
        const heldFrets = this.from.frets ?? generateVoicings(this.from.symbol)[0]?.frets ?? null
        const steps = heldFrets ? transition(heldFrets, this.to.symbol) : []
        const top = steps.slice(0, 4)
        // The next note's own voicing, when it isn't among the easiest.
        const own = this.to.frets
        const ownStep = own ? steps.find((s) => sameFrets(s.voicing.frets, own)) : undefined
        if (ownStep && !top.includes(ownStep)) top.push(ownStep)
        el.createDiv({
            cls: 'mp-muted',
            text: heldFrets
                ? t('tools.transition.help')
                : t('tools.transition.noFrets', { name: this.from.name })
        })
        const grid = el.createDiv({ cls: 'mp-voicing-row mp-voicing-grid mp-transition-grid' })
        if (heldFrets) {
            const held = grid.createDiv({ cls: 'mp-voicing is-current' })
            this.diagrams.push(
                renderBlock(
                    'chord',
                    source(
                        this.from.symbol,
                        titleShown(
                            t('tools.transition.held', { symbol: this.from.symbol }),
                            this.options.renderOptions().naming
                        ),
                        {
                            frets: heldFrets,
                            fingers: fingerVoicing(heldFrets) ?? heldFrets.map(() => null)
                        }
                    ),
                    held,
                    this.options.renderOptions()
                )
            )
        }
        top.forEach((step, i) => {
            const isOwn = own !== null && sameFrets(step.voicing.frets, own)
            const title = isOwn
                ? t('tools.transition.thisNote', { symbol: this.to.symbol })
                : `${this.to.symbol}, ${i + 1}`
            const cell = voicingCell(
                grid,
                isOwn ? 'is-current' : '',
                `${title}: ${formatFrets(step.voicing.frets)}`,
                false,
                (c) => {
                    this.selected = step.voicing
                    selectCell(grid, c)
                    this.renderActions(actions)
                }
            )
            this.diagrams.push(
                renderBlock(
                    'chord',
                    source(
                        this.to.symbol,
                        titleShown(title, this.options.renderOptions().naming),
                        step.voicing,
                        step.anchors,
                        step.guides
                    ),
                    cell,
                    this.options.renderOptions()
                )
            )
            const tips = cell.createEl('ul', { cls: 'mp-tips' })
            for (const tip of step.tips) tips.createEl('li', { text: tip })
        })
        alignGrid(grid)
        const actions = el.createDiv({ cls: 'mp-actions' })
        this.renderActions(actions)
    }

    private renderActions(el: HTMLElement): void {
        el.empty()
        el.createEl('button', { text: t('common.close') }).addEventListener('click', () =>
            this.close()
        )
        el.createEl('button', { text: t('tools.transition.reverse') }).addEventListener(
            'click',
            () => {
                ;[this.from, this.to] = [this.to, this.from]
                this.render()
            }
        )
        if (!this.options.add) return
        const own = this.to.frets
        const voicing = this.selected
        const add = el.createEl('button', { text: t('tools.transition.addAsNote'), cls: 'mod-cta' })
        add.disabled = !voicing || this.busy || (own !== null && sameFrets(voicing.frets, own))
        add.addEventListener('click', () => {
            if (!voicing) return
            this.busy = true
            add.disabled = true
            this.options.add!(voicing, this.to.symbol)
                .then(() => this.close())
                .catch((error: unknown) => {
                    console.error('Music Practice: adding a voicing failed', error)
                    this.busy = false
                    add.disabled = false
                })
        })
    }

    override onClose(): void {
        for (const d of this.diagrams) d.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}

/**
 * Smooth this progression (#57): the voicing of each chord that makes the whole progression
 * easiest, the moves marked and explained; the voicings no chord note plays yet can be added.
 */
export class ProgressionModal extends Modal {
    private diagrams: RenderResult[] = []

    constructor(
        app: App,
        private readonly chords: string[],
        private readonly options: {
            renderOptions: () => RenderOptions
            /** The note that already plays a voicing of a chord, if any. */
            existing: (voicing: GeneratedVoicing, symbol: string) => string | null
            add?: (voicing: GeneratedVoicing, symbol: string) => Promise<void>
        }
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle(t('tools.progression.title'))
        this.modalEl.addClass('mp-voicings-modal')
        const el = this.contentEl
        el.addClass('mp-modal')
        const steps = smoothProgression(this.chords)
        if (!steps.length) {
            el.createDiv({ cls: 'mp-muted', text: t('tools.progression.none') })
            return
        }
        el.createDiv({
            cls: 'mp-muted',
            text: t('tools.progression.help', { chords: this.chords.join(' → ') })
        })
        const grid = el.createDiv({ cls: 'mp-voicing-row mp-voicing-grid mp-transition-grid' })
        const missing: { voicing: GeneratedVoicing; symbol: string }[] = []
        for (const step of steps) {
            const note = this.options.existing(step.voicing, step.chord)
            if (
                !note &&
                !missing.some(
                    (m) => m.symbol === step.chord && sameFrets(m.voicing.frets, step.voicing.frets)
                )
            )
                missing.push({ voicing: step.voicing, symbol: step.chord })
            const cell = grid.createDiv({ cls: `mp-voicing${note ? ' is-current' : ''}` })
            this.diagrams.push(
                renderBlock(
                    'chord',
                    source(
                        step.chord,
                        titleShown(step.chord, this.options.renderOptions().naming),
                        step.voicing,
                        step.anchors,
                        step.guides
                    ),
                    cell,
                    this.options.renderOptions()
                )
            )
            cell.createDiv({
                cls: 'mp-muted mp-tip-note',
                text: note
                    ? t('tools.progression.inNotes', { note })
                    : t('tools.progression.notYet')
            })
            const tips = cell.createEl('ul', { cls: 'mp-tips' })
            for (const tip of step.tips ?? []) tips.createEl('li', { text: tip })
        }
        alignGrid(grid)
        const actions = el.createDiv({ cls: 'mp-actions' })
        actions
            .createEl('button', { text: t('common.close') })
            .addEventListener('click', () => this.close())
        if (this.options.add && missing.length) {
            const add = actions.createEl('button', {
                cls: 'mod-cta',
                text: tn('tools.progression.addMissing', missing.length)
            })
            add.addEventListener('click', () => {
                add.disabled = true
                void (async () => {
                    for (const m of missing) await this.options.add!(m.voicing, m.symbol)
                })()
                    .then(() => this.close())
                    .catch((error: unknown) => {
                        console.error('Music Practice: adding voicings failed', error)
                        add.disabled = false
                    })
            })
        }
    }

    override onClose(): void {
        for (const d of this.diagrams) d.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}
