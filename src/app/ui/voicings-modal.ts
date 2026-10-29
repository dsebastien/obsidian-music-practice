import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import { generateVoicings, readChord, renderBlock } from '@dsebastien/music-notation'
import type { GeneratedVoicing, RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { formatFingers, formatFrets } from '../domain/notation-note'
import { selectCell, voicingCell } from './voicing-cell'
import {
    DEFAULT_VOICING_FILTER,
    VOICING_AREAS,
    sameFrets,
    voicingLabel,
    voicingOptions,
    type VoicingArea,
    type VoicingFilter
} from '../domain/voicings'

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

    constructor(
        app: App,
        private readonly options: VoicingsModalOptions
    ) {
        super(app)
        this.symbol = options.symbol
    }

    override onOpen(): void {
        this.contentEl.addClass('mp-modal')
        this.modalEl.addClass('mp-voicings-modal')
        this.setTitle(this.symbol ? `Voicings of ${this.symbol}` : 'Voicings of a chord')
        const el = this.contentEl
        if (!this.options.symbol) {
            const field = el.createEl('label', { cls: 'mp-field', text: 'Chord' })
            const input = field.createEl('input', { type: 'text', attr: { placeholder: 'Am7' } })
            input.addEventListener('input', () => {
                this.symbol = readChord(input.value.trim())?.symbol ?? null
                this.selected = null
                this.setTitle(this.symbol ? `Voicings of ${this.symbol}` : 'Voicings of a chord')
                this.refresh()
            })
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
        select<VoicingArea>('Neck', VOICING_AREAS, this.filter.area, (v) => (this.filter.area = v))
        select(
            'Root on',
            [
                { value: '0', label: 'Any string' },
                { value: '6', label: '6th string' },
                { value: '5', label: '5th string' },
                { value: '4', label: '4th string' }
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
        toggle('Inversions', (on) => (this.filter.inversions = on))
        toggle('Stretch', (on) => (this.filter.stretch = on))
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
            info.setText('Type a chord to see every way to play it.')
            this.renderActions()
            return
        }
        const all = generateVoicings(symbol, voicingOptions(this.filter))
        const shown = all.slice(0, SHOWN)
        info.setText(
            all.length === 0
                ? 'No voicing fits: widen the neck area, allow inversions or a stretch.'
                : all.length > SHOWN
                  ? `The ${SHOWN} easiest of ${all.length}, easiest first.`
                  : `${all.length} voicing${all.length === 1 ? '' : 's'}, easiest first.`
        )
        const current = this.options.current ?? null
        if (current && shown.some((v) => sameFrets(v.frets, current)))
            info.appendText(" Dashed: this note's voicing.")
        shown.forEach((voicing, i) => {
            const isCurrent = current !== null && sameFrets(voicing.frets, current)
            const isSelected =
                this.selected !== null && sameFrets(voicing.frets, this.selected.frets)
            const label = voicingLabel(voicing, i + 1)
            const button = voicingCell(
                list,
                isCurrent ? 'is-current' : '',
                `${label}${isCurrent ? ' (this note)' : ''}: ${formatFrets(voicing.frets)}`,
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
        this.renderActions()
    }

    private renderActions(): void {
        const el = this.actionsEl
        const note = this.noteEl
        if (!el || !note) return
        el.empty()
        note.empty()
        el.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close())
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
            action('Use this voicing', () => this.options.pick!(voicing!, symbol!), true)
        if (this.options.use)
            action(
                'Use for this note',
                () => this.options.use!(voicing!, symbol!),
                false,
                isCurrent ? "This is this note's voicing." : blocked
            )
        if (this.options.add)
            action(
                'Add as note',
                () => this.options.add!(voicing!, symbol!),
                !this.options.pick || blocked !== null,
                isCurrent ? "This is this note's voicing." : null
            )
        if (blocked && !isCurrent) note.setText(blocked)
    }

    override onClose(): void {
        for (const diagram of this.diagrams) diagram.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}
