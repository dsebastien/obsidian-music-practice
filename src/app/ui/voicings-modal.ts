import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import { generateVoicings, readChord, renderBlock } from '@dsebastien/music-notation'
import type {
    GeneratedVoicing,
    PlayOptions,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import { readValue, valueOfText } from '../domain/click-input'
import { ClickInput, renderNearMatches, type ClickLayout } from './click-input'
import { formatFingers, formatFrets } from '../domain/notation-note'
import { alignGrid, selectCell, voicingCell } from './voicing-cell'
import {
    DEFAULT_VOICING_FILTER,
    voicingAreas,
    sameFrets,
    voicingLabel,
    voicingOptions,
    type VoicingArea,
    type VoicingFilter
} from '../domain/voicings'
import { t, tn } from '../i18n/i18n'

/** At most this many voicings drawn at once: the easiest of the filtered list. */
const SHOWN = 24

export interface VoicingsModalOptions {
    /** The chord; null asks for one. */
    symbol: string | null
    /** The note's own frets, marked in the list. */
    current?: (number | null)[] | null
    renderOptions: () => RenderOptions
    /** Add a learning note: the voicing picked goes back to the form. */
    pick?: (voicing: GeneratedVoicing, symbol: string) => void
    /** Create a chord note of the voicing. */
    add?: (voicing: GeneratedVoicing, symbol: string) => Promise<void>
    /** Make it the current note's voicing. */
    use?: (voicing: GeneratedVoicing, symbol: string) => Promise<void>
    /** Why this voicing can't be the note's (another shape: its own note); null when it can. */
    cantUse?: (voicing: GeneratedVoicing, symbol: string) => string | null
    /** No chord given: a fretboard to click the chord's frets on (#76). */
    click?: {
        layout: () => ClickLayout
        play: () => PlayOptions | false
    }
}

/** Every playable voicing of a chord, easiest first, filtered by neck area and root string (#54). */
export class VoicingsModal extends Modal {
    private symbol: string | null
    private filter: VoicingFilter = { ...DEFAULT_VOICING_FILTER }
    private selected: GeneratedVoicing | null = null
    private diagrams: RenderResult[] = []
    private listEl: HTMLElement | null = null
    private actionsEl: HTMLElement | null = null
    private infoEl: HTMLElement | null = null
    /** Under the list: why an action is off. */
    private noteEl: HTMLElement | null = null
    /** An action is running. */
    private busy = false
    /** The fretboard to click a chord on, when none is given (#76). */
    private clicks: ClickInput | null = null
    /** Its near matches. */
    private nearEl: HTMLElement | null = null

    constructor(
        app: App,
        private readonly options: VoicingsModalOptions
    ) {
        super(app)
        this.symbol = options.symbol
    }

    private titleText(): string {
        return this.symbol
            ? t('tools.voicings.title', { symbol: this.symbol })
            : t('tools.voicings.titleChord')
    }

    override onOpen(): void {
        this.contentEl.addClass('mp-modal')
        this.modalEl.addClass('mp-voicings-modal')
        this.setTitle(this.titleText())
        const el = this.contentEl
        if (!this.options.symbol) {
            const field = el.createEl('label', { cls: 'mp-field', text: t('tools.voicings.chord') })
            const input = field.createEl('input', {
                type: 'text',
                attr: { placeholder: t('tools.voicings.chordPlaceholder') }
            })
            const typed = () => {
                this.symbol = readChord(input.value.trim())?.symbol ?? null
                this.selected = null
                this.setTitle(this.titleText())
                this.refresh()
            }
            input.addEventListener('input', () => {
                typed()
                // A chord typed replaces the frets clicked.
                this.clicks?.set(valueOfText('', 'guitar'))
                if (this.nearEl) this.nearEl.empty()
            })
            // Or click the frets: the chord they make fills the field; when they make none, the
            // chords that hold them, to pick one (#76).
            const click = this.options.click
            if (click) {
                el.createDiv({ cls: 'mp-muted', text: t('tools.voicings.orClick') })
                const host = el.createDiv()
                const near = el.createDiv({ cls: 'mp-click-near-box' })
                this.nearEl = near
                this.clicks = new ClickInput(host, {
                    instrument: 'guitar',
                    layout: click.layout,
                    play: click.play,
                    value: valueOfText('', 'guitar'),
                    onChange: (value) => {
                        const read = readValue(value)
                        // The field follows the frets: their chord, or nothing when they make none.
                        input.value = read.detected?.symbol ?? ''
                        typed()
                        renderNearMatches(near, read.near, {
                            mark: (m) => this.clicks?.showNear(m),
                            pick: (symbol) => {
                                // The chord replaces the frets clicked.
                                input.value = symbol
                                typed()
                                this.clicks?.set(valueOfText('', 'guitar'))
                                near.empty()
                                // The list is gone: the focus goes to the field.
                                input.focus()
                            }
                        })
                    }
                })
            }
            window.setTimeout(() => input.focus(), 0)
        }
        const filters = el.createDiv({ cls: 'mp-form-row' })
        const select = <T extends string>(
            label: string,
            values: { value: T; label: string }[],
            current: T,
            set: (value: T) => void
        ) => {
            const field = filters.createEl('label', { cls: 'mp-field', text: label })
            const s = field.createEl('select', { cls: 'dropdown' })
            for (const v of values)
                s.createEl('option', { text: v.label, value: v.value }).selected =
                    v.value === current
            s.addEventListener('change', () => {
                set(s.value as T)
                this.selected = null
                this.refresh()
            })
        }
        select<VoicingArea>(
            t('tools.voicings.neck'),
            voicingAreas(),
            this.filter.area,
            (v) => (this.filter.area = v)
        )
        select(
            t('tools.voicings.rootOn'),
            [
                { value: '0', label: t('tools.voicings.anyString') },
                { value: '6', label: t('tools.voicings.string6') },
                { value: '5', label: t('tools.voicings.string5') },
                { value: '4', label: t('tools.voicings.string4') }
            ],
            '0',
            (v) => (this.filter.rootString = Number(v))
        )
        const toggle = (label: string, set: (on: boolean) => void) => {
            const field = filters.createEl('label', { cls: 'mp-check' })
            const box = field.createEl('input', { type: 'checkbox' })
            field.appendText(` ${label}`)
            box.addEventListener('change', () => {
                set(box.checked)
                this.selected = null
                this.refresh()
            })
        }
        toggle(t('tools.voicings.inversions'), (on) => (this.filter.inversions = on))
        toggle(t('tools.voicings.stretch'), (on) => (this.filter.stretch = on))
        this.infoEl = el.createDiv({ cls: 'mp-muted' })
        this.listEl = el.createDiv({ cls: 'mp-voicing-row mp-voicing-grid' })
        this.noteEl = el.createDiv({ cls: 'mp-muted' })
        this.actionsEl = el.createDiv({ cls: 'mp-actions' })
        this.refresh()
    }

    private refresh(): void {
        for (const diagram of this.diagrams) diagram.destroy()
        this.diagrams = []
        const list = this.listEl
        const info = this.infoEl
        if (!list || !info) return
        list.empty()
        const symbol = this.symbol
        if (!symbol) {
            info.setText(t('tools.voicings.typeChord'))
            this.renderActions()
            return
        }
        const all = generateVoicings(symbol, voicingOptions(this.filter))
        const shown = all.slice(0, SHOWN)
        info.setText(
            all.length === 0
                ? t('tools.voicings.none')
                : all.length > SHOWN
                  ? t('tools.voicings.easiest', { shown: SHOWN, total: all.length })
                  : tn('tools.voicings.count', all.length)
        )
        const current = this.options.current ?? null
        if (current && shown.some((v) => sameFrets(v.frets, current)))
            info.appendText(` ${t('tools.voicings.dashed')}`)
        shown.forEach((voicing, i) => {
            const isCurrent = current !== null && sameFrets(voicing.frets, current)
            const isSelected =
                this.selected !== null && sameFrets(voicing.frets, this.selected.frets)
            const label = voicingLabel(voicing, i + 1)
            const button = voicingCell(
                list,
                isCurrent ? 'is-current' : '',
                `${isCurrent ? t('tools.voicings.labelCurrent', { label }) : label}: ${formatFrets(voicing.frets)}`,
                isSelected,
                (cell) => {
                    this.selected = voicing
                    selectCell(list, cell)
                    this.renderActions()
                }
            )
            const source = [
                `symbol: ${symbol}`,
                `frets: ${formatFrets(voicing.frets)}`,
                `fingers: ${formatFingers(voicing)}`,
                `title: ${label}`
            ].join('\n')
            this.diagrams.push(renderBlock('chord', source, button, this.options.renderOptions()))
            // Picking from Add a learning note: a double click is enough.
            if (this.options.pick)
                button.addEventListener('dblclick', () => {
                    this.options.pick?.(voicing, symbol)
                    this.close()
                })
        })
        alignGrid(list)
        this.renderActions()
    }

    private renderActions(): void {
        const el = this.actionsEl
        const note = this.noteEl
        if (!el || !note) return
        el.empty()
        note.empty()
        el.createEl('button', { text: t('common.close') }).addEventListener('click', () =>
            this.close()
        )
        const voicing = this.selected
        const symbol = this.symbol
        const ready = voicing !== null && symbol !== null && !this.busy
        const current = this.options.current ?? null
        const isCurrent = voicing !== null && current !== null && sameFrets(voicing.frets, current)
        const action = (
            text: string,
            run: () => Promise<void> | void,
            cta = false,
            blocked: string | null = null
        ) => {
            const button = el.createEl('button', { text, ...(cta ? { cls: 'mod-cta' } : {}) })
            button.disabled = !ready || blocked !== null
            if (blocked) button.setAttr('title', blocked)
            button.addEventListener('click', () => {
                // One action at a time: picking another voicing meanwhile doesn't re-enable them.
                this.busy = true
                this.renderActions()
                Promise.resolve()
                    .then(run)
                    .then(() => this.close())
                    .catch((error: unknown) => {
                        // The action already told the user; keep the details for the console.
                        console.error('Music Practice: voicing action failed', error)
                        this.busy = false
                        this.renderActions()
                    })
            })
        }
        // Another shape is another thing to learn: its own note, with its own mastery.
        const blocked =
            voicing && symbol && this.options.cantUse ? this.options.cantUse(voicing, symbol) : null
        if (this.options.pick)
            action(t('tools.voicings.useThis'), () => this.options.pick!(voicing!, symbol!), true)
        if (this.options.use)
            action(
                t('tools.voicings.useForNote'),
                () => this.options.use!(voicing!, symbol!),
                false,
                isCurrent ? t('tools.voicings.isCurrent') : blocked
            )
        if (this.options.add)
            action(
                t('tools.voicings.addAsNote'),
                () => this.options.add!(voicing!, symbol!),
                !this.options.pick || blocked !== null,
                isCurrent ? t('tools.voicings.isCurrent') : null
            )
        if (blocked && !isCurrent) note.setText(blocked)
    }

    override onClose(): void {
        this.clicks?.destroy()
        this.clicks = null
        for (const diagram of this.diagrams) diagram.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}
