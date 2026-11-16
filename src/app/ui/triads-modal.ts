import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import {
    keyTriads,
    parseKey,
    readChord,
    renderBlock,
    triadVoicings
} from '@dsebastien/music-notation'
import type { RenderOptions, RenderResult, Triad } from '@dsebastien/music-notation'
import { formatFingers, formatFrets } from '../domain/notation-note'
import { STRING_SETS, stringsOf, type StringSet } from '../domain/triads'
import { titleShown } from '../domain/note-names'
import { alignGrid, selectCell, voicingCell } from './voicing-cell'
import { t, tn } from '../i18n/i18n'

/** A triad picked in the modal. */
export interface TriadPick {
    symbol: string
    triad: Triad
    set: StringSet
}

export interface TriadsModalOptions {
    /** The chord to start from; none asks for one. */
    symbol: string | null
    renderOptions: () => RenderOptions
    /** Add a learning note: the triad goes back to the form. */
    pick?: (pick: TriadPick) => void
    /** Create a chord note of the triad. */
    add?: (pick: TriadPick) => Promise<void>
    /** Practice them with the metronome. */
    metronome?: () => void
}

/**
 * Triads on string sets (#55): a chord's triads up the neck (one inversion or all), or a key's
 * seven triads in one inversion, with interval labels and playback; pick one or add it as a note.
 */
export class TriadsModal extends Modal {
    private mode: 'chord' | 'key' = 'chord'
    private text: string
    private set: StringSet = '1-3'
    private inversion: number | 'any' = 'any'
    private selected: TriadPick | null = null
    private diagrams: RenderResult[] = []
    private gridEl: HTMLElement | null = null
    private infoEl: HTMLElement | null = null
    private actionsEl: HTMLElement | null = null
    private inversionEl: HTMLSelectElement | null = null
    private busy = false

    constructor(
        app: App,
        private readonly options: TriadsModalOptions
    ) {
        super(app)
        this.text = options.symbol ?? ''
    }

    override onOpen(): void {
        this.setTitle(t('tools.triads.title'))
        this.modalEl.addClass('mp-voicings-modal')
        const el = this.contentEl
        el.addClass('mp-modal')
        const row = el.createDiv({ cls: 'mp-form-row' })
        const select = (
            label: string,
            values: [string, string][],
            current: string,
            set: (v: string) => void
        ) => {
            const field = row.createEl('label', { cls: 'mp-field', text: label })
            const s = field.createEl('select', { cls: 'dropdown' })
            for (const [value, text] of values)
                s.createEl('option', { text, value }).selected = value === current
            s.addEventListener('change', () => {
                set(s.value)
                this.selected = null
                this.refresh()
            })
            return s
        }
        select(
            t('tools.triads.ofA'),
            [
                ['chord', t('tools.triads.chord')],
                ['key', t('tools.triads.key')]
            ],
            this.mode,
            (v) => {
                this.mode = v === 'key' ? 'key' : 'chord'
                if (this.mode === 'key' && this.inversion === 'any') this.inversion = 0
                if (this.inversionEl) this.inversionEl.value = String(this.inversion)
            }
        )
        const field = row.createEl('label', { cls: 'mp-field', text: t('tools.triads.chordOrKey') })
        const input = field.createEl('input', { type: 'text', attr: { placeholder: 'G' } })
        input.value = this.text
        input.addEventListener('input', () => {
            this.text = input.value
            this.selected = null
            this.refresh()
        })
        select(
            t('tools.triads.strings'),
            STRING_SETS.map((s) => [s, s]),
            this.set,
            (v) => (this.set = STRING_SETS.find((s) => s === v) ?? '1-3')
        )
        this.inversionEl = select(
            t('tools.triads.inversion'),
            [
                ['any', t('tools.triads.all')],
                ['0', t('tools.triads.rootPosition')],
                ['1', t('tools.triads.firstInversion')],
                ['2', t('tools.triads.secondInversion')]
            ],
            String(this.inversion),
            (v) => {
                // A key's triads come in one inversion.
                this.inversion = v === 'any' && this.mode === 'chord' ? 'any' : Number(v) || 0
            }
        )
        this.infoEl = el.createDiv({ cls: 'mp-muted' })
        this.gridEl = el.createDiv({ cls: 'mp-voicing-row mp-voicing-grid' })
        this.actionsEl = el.createDiv({ cls: 'mp-actions' })
        this.refresh()
        window.setTimeout(() => input.focus(), 0)
    }

    /** The triads to show, with the chord each one plays and its title. */
    private triads(): { symbol: string; title: string; triad: Triad }[] | string {
        const text = this.text.trim()
        if (!text) return t('tools.triads.typeChordOrKey')
        const strings = stringsOf(this.set)
        if (this.mode === 'key') {
            if (!parseKey(text)) return t('tools.triads.typeKey')
            const inversion = this.inversion === 'any' ? 0 : this.inversion
            const list = keyTriads(text, { strings, inversion })
            if (!list?.length) return t('tools.triads.noneForKey')
            return list.map((k) => ({
                symbol: k.symbol,
                title: `${k.numeral} · ${k.symbol}`,
                triad: k.triad
            }))
        }
        const chord = readChord(text)
        if (!chord) return t('tools.triads.notChord', { text })
        const list = triadVoicings(chord.symbol, { strings, inversion: this.inversion })
        if (!list.length) return t('tools.triads.noTriads', { symbol: chord.symbol })
        const names = [
            t('tools.triads.nameRoot'),
            t('tools.triads.nameFirst'),
            t('tools.triads.nameSecond')
        ]
        return list.map((triad) => ({
            symbol: chord.symbol,
            title: `${chord.symbol}, ${names[triad.inversion]}`,
            triad
        }))
    }

    private refresh(): void {
        for (const d of this.diagrams) d.destroy()
        this.diagrams = []
        const grid = this.gridEl
        const info = this.infoEl
        if (!grid || !info) return
        grid.empty()
        const triads = this.triads()
        if (typeof triads === 'string') {
            info.setText(triads)
            this.renderActions()
            return
        }
        info.setText(tn('tools.triads.count', triads.length, { set: this.set }))
        for (const item of triads) {
            const pick: TriadPick = { symbol: item.symbol, triad: item.triad, set: this.set }
            const button = voicingCell(
                grid,
                '',
                `${item.title}: ${formatFrets(item.triad.frets)}`,
                false,
                (cell) => {
                    this.selected = pick
                    selectCell(grid, cell)
                    this.renderActions()
                }
            )
            const source = [
                `symbol: ${item.symbol}`,
                `frets: ${formatFrets(item.triad.frets)}`,
                `fingers: ${formatFingers(item.triad)}`,
                'labels: intervals',
                `title: ${titleShown(item.title, this.options.renderOptions().naming)}`
            ].join('\n')
            this.diagrams.push(renderBlock('chord', source, button, this.options.renderOptions()))
        }
        alignGrid(grid)
        this.renderActions()
    }

    private renderActions(): void {
        const el = this.actionsEl
        if (!el) return
        el.empty()
        el.createEl('button', { text: t('common.close') }).addEventListener('click', () =>
            this.close()
        )
        if (this.options.metronome)
            el.createEl('button', { text: t('tools.triads.metronome') }).addEventListener(
                'click',
                () => this.options.metronome?.()
            )
        const pick = this.selected
        const action = (text: string, run: (p: TriadPick) => Promise<void> | void) => {
            const button = el.createEl('button', { text, cls: 'mod-cta' })
            button.disabled = !pick || this.busy
            button.addEventListener('click', () => {
                if (!pick) return
                this.busy = true
                this.renderActions()
                Promise.resolve()
                    .then(() => run(pick))
                    .then(() => this.close())
                    .catch((error: unknown) => {
                        console.error('Music Practice: triad action failed', error)
                        this.busy = false
                        this.renderActions()
                    })
            })
        }
        if (this.options.pick) action(t('tools.triads.useThis'), (p) => this.options.pick!(p))
        else if (this.options.add) action(t('tools.triads.addAsNote'), (p) => this.options.add!(p))
    }

    override onClose(): void {
        for (const d of this.diagrams) d.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}
