import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { PROGRESSION_STRUMS, type ProgressionStrum } from '@dsebastien/music-notation'
import {
    backingBpm,
    backingMeter,
    MAX_BACKING_BPM,
    MIN_BACKING_BPM,
    type BackingSource
} from '../domain/backing'
import type { Trainer } from '../domain/metronome'
import type { BackingRequest, BackingTrack } from '../services/backing.service'

/** A strumming pattern note the piece links, with its ```strum text. */
export interface LinkedPattern {
    name: string
    text: string
}

export interface BackingModalDeps {
    /** The note's name, for the title. */
    name: string
    sources: BackingSource[]
    patterns: LinkedPattern[]
    /** The note's time signature property (#77), used when the progression has no time. */
    noteTime: unknown
    bpmCurrent: number | null
    bpmTarget: number | null
    track: BackingTrack
    /** Read at each start: the count-in, the trainer's step and bars, the volume (0 to 1). */
    settings: () => { countIn: boolean; trainerStep: number; trainerBars: number; volume: number }
    /** Read at each start: the player of the window it plays in, the sound, the voicings. */
    playing: (
        source: BackingSource
    ) => Pick<BackingRequest, 'player' | 'window' | 'sound' | 'voicings'>
    /** Set BPM for the note (a learning note only), offering the tempo reached. */
    saveBpm?: (bpm: number) => void
}

const STRUM_LABELS: Record<ProgressionStrum, string> = {
    beats: 'A strum on each beat',
    bar: 'One strum a bar',
    arpeggio: 'Arpeggio'
}

/** A strum choice: a style, the block's own pattern, or a linked strumming pattern note. */
type StrumChoice = { strum: ProgressionStrum } | { pattern: string }

/**
 * Practice a progression in time (#69): the note's chords one a bar as a backing loop, with the
 * click, a count-in, the speed trainer, and the chord playing lit; Save BPM for the note.
 */
export class BackingModal extends Modal {
    private source = 0
    private strum = 0
    private click = true
    private countIn: boolean
    private trainerOn = false
    private bpm: number
    private unsubscribe: (() => void) | null = null
    private chips: HTMLElement[] = []
    private statusEl: HTMLElement | null = null
    private playButton: HTMLButtonElement | null = null
    private bpmInput: HTMLInputElement | null = null
    private strumSelect: HTMLSelectElement | null = null
    private chordsEl: HTMLElement | null = null
    private meterEl: HTMLElement | null = null

    constructor(
        app: App,
        private readonly deps: BackingModalDeps
    ) {
        super(app)
        this.countIn = deps.settings().countIn
        this.bpm = backingBpm(deps.bpmCurrent, deps.sources[0]?.tempo ?? null)
    }

    override onOpen(): void {
        this.setTitle(`In time: ${this.deps.name}`)
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        contentEl.addClass('mp-backing')
        const row = contentEl.createDiv({ cls: 'mp-form-row' })
        if (this.deps.sources.length > 1) {
            this.select(
                row,
                'Progression',
                this.deps.sources.map((s, i) => [String(i), s.label]),
                '0',
                (v) => {
                    this.source = Number(v)
                    this.strum = 0
                    this.fillStrums()
                    this.drawChords()
                    this.restart()
                }
            )
        }
        this.strumSelect = this.select(row, 'Strum', [], '0', (v) => {
            this.strum = Number(v)
            this.restart()
        })
        this.fillStrums()
        const tempo = row.createEl('label', { cls: 'mp-field', text: 'Tempo (BPM)' })
        const input = tempo.createEl('input', {
            type: 'number',
            attr: { min: String(MIN_BACKING_BPM), max: String(MAX_BACKING_BPM) }
        })
        input.value = String(this.bpm)
        input.addEventListener('change', () => this.setBpm(Number(input.value)))
        this.bpmInput = input
        const toggles = contentEl.createDiv({ cls: 'mp-form-row' })
        this.toggle(toggles, 'Click', this.click, (on) => {
            this.click = on
            this.deps.track.update({ click: on })
        })
        this.toggle(toggles, 'Count-in', this.countIn, (on) => (this.countIn = on))
        const { trainerStep, trainerBars } = this.deps.settings()
        const target = this.deps.bpmTarget ? `, up to ${this.deps.bpmTarget}` : ''
        this.toggle(
            toggles,
            `Speed trainer (+${trainerStep} BPM every ${trainerBars} bars${target})`,
            this.trainerOn,
            (on) => {
                this.trainerOn = on
                this.deps.track.setTrainer(on ? this.trainer() : null)
            }
        )
        this.meterEl = contentEl.createDiv({ cls: 'mp-rubric' })
        this.chordsEl = contentEl.createDiv({ cls: 'mp-backing-chords' })
        this.drawChords()
        this.statusEl = contentEl.createDiv({ cls: 'mp-muted mp-backing-status' })
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        if (this.deps.saveBpm) {
            const save = this.deps.saveBpm
            actions
                .createEl('button', { text: 'Save BPM' })
                .addEventListener('click', () => save(this.deps.track.state.bpm))
        }
        this.playButton = actions.createEl('button', { cls: 'mod-cta', text: 'Play' })
        this.playButton.addEventListener('click', () => {
            if (this.deps.track.state.running) this.deps.track.stop()
            else this.start()
        })
        this.unsubscribe = this.deps.track.subscribe(() => this.refresh())
        this.refresh()
    }

    override onClose(): void {
        this.unsubscribe?.()
        this.unsubscribe = null
        this.deps.track.stop()
        this.contentEl.empty()
    }

    private current(): BackingSource {
        return this.deps.sources[this.source]!
    }

    /** The strum styles, the block's own strum, then the linked strumming patterns. */
    private strums(): [StrumChoice, string][] {
        const own = this.current().strum
        const choices: [StrumChoice, string][] = []
        if (own && !(PROGRESSION_STRUMS as readonly string[]).includes(own.toLowerCase()))
            choices.push([{ pattern: own }, `The block's pattern (${own})`])
        const first = (PROGRESSION_STRUMS as readonly string[]).includes(own?.toLowerCase() ?? '')
            ? (own!.toLowerCase() as ProgressionStrum)
            : null
        const styles = first
            ? [first, ...PROGRESSION_STRUMS.filter((s) => s !== first)]
            : [...PROGRESSION_STRUMS]
        for (const s of styles) choices.push([{ strum: s }, STRUM_LABELS[s]])
        for (const p of this.deps.patterns) choices.push([{ pattern: p.text }, p.name])
        return choices
    }

    private fillStrums(): void {
        const select = this.strumSelect
        if (!select) return
        select.empty()
        this.strums().forEach(([, text], i) =>
            select.createEl('option', { value: String(i), text })
        )
        select.value = String(this.strum)
    }

    private drawChords(): void {
        const el = this.chordsEl
        if (!el) return
        el.empty()
        const source = this.current()
        this.chips = source.chords.map((chord, i) => {
            const name = typeof chord === 'string' ? chord : (chord.chord ?? '?')
            return el.createSpan({
                cls: 'mp-backing-chord',
                text: name,
                attr: { 'data-bar': String(i) }
            })
        })
        const meter = backingMeter(source.time, this.deps.noteTime)
        const counted = meter.beatUnit >= 8 && meter.beatsPerBar % 3 === 0 && meter.beatsPerBar >= 6
        if (this.meterEl)
            this.meterEl.setText(
                `${source.chords.length} bars of ${meter.label}, one chord a bar${counted ? ', counted in dotted beats' : ''}. Changes apply from the next pass.`
            )
    }

    private trainer(): Trainer {
        const { trainerStep, trainerBars } = this.deps.settings()
        return {
            start: this.bpm,
            step: trainerStep,
            everyBars: trainerBars,
            target: this.deps.bpmTarget
        }
    }

    private setBpm(value: number): void {
        const n = Number.isFinite(value) ? Math.round(value) : this.bpm
        this.bpm = Math.min(MAX_BACKING_BPM, Math.max(MIN_BACKING_BPM, n))
        if (this.bpmInput) this.bpmInput.value = String(this.bpm)
        this.deps.track.setBpm(this.bpm)
    }

    private start(): void {
        const source = this.current()
        const meter = backingMeter(source.time, this.deps.noteTime)
        const choice = this.strums()[this.strum]?.[0] ?? { strum: 'beats' as const }
        const { volume } = this.deps.settings()
        try {
            this.deps.track.start({
                chords: source.chords,
                beatsPerBar: meter.beatsPerBar,
                beatUnit: meter.beatUnit,
                bpm: this.bpm,
                strum: 'strum' in choice ? choice.strum : 'beats',
                ...('pattern' in choice ? { pattern: choice.pattern } : {}),
                click: this.click,
                countIn: this.countIn,
                loop: true,
                volume,
                trainer: this.trainerOn ? this.trainer() : null,
                ...this.deps.playing(source)
            })
        } catch (error: unknown) {
            new Notice(error instanceof Error ? error.message : String(error))
        }
    }

    /** A new progression or strum while playing starts again with it. */
    private restart(): void {
        if (this.deps.track.state.running) this.start()
    }

    private refresh(): void {
        const state = this.deps.track.state
        if (this.playButton) this.playButton.setText(state.running ? 'Stop' : 'Play')
        this.chips.forEach((chip, i) => chip.toggleClass('is-playing', state.bar === i))
        if (state.running && state.bpm !== this.bpm) {
            // The trainer moved the tempo: show it.
            this.bpm = state.bpm
            if (this.bpmInput) this.bpmInput.value = String(state.bpm)
        }
        if (this.statusEl)
            this.statusEl.setText(
                state.running
                    ? state.bar === null
                        ? `Counting in at ${state.bpm} BPM…`
                        : `Bar ${state.bar + 1} of ${this.chips.length}, pass ${state.pass}, ${state.bpm} BPM`
                    : 'Stopped.'
            )
    }

    private select(
        parent: HTMLElement,
        label: string,
        options: [string, string][],
        value: string,
        set: (v: string) => void
    ): HTMLSelectElement {
        const el = parent.createEl('label', { cls: 'mp-field', text: label })
        const select = el.createEl('select', { cls: 'dropdown' })
        for (const [v, text] of options) select.createEl('option', { value: v, text })
        select.value = value
        select.addEventListener('change', () => set(select.value))
        return select
    }

    private toggle(
        parent: HTMLElement,
        label: string,
        value: boolean,
        set: (on: boolean) => void
    ): void {
        const el = parent.createEl('label', { cls: 'mp-field' })
        const box = el.createEl('input', { type: 'checkbox' })
        box.checked = value
        box.addEventListener('change', () => set(box.checked))
        el.appendText(` ${label}`)
    }
}
