import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import { bpmFromTaps, type MetronomeSettings, type Subdivision } from '../domain/metronome'
import type { Metronome } from '../services/metronome.service'

export interface MetronomeViewDeps {
    settings: () => MetronomeSettings
    saveSettings: (change: Partial<MetronomeSettings>) => Promise<void>
    /** Save the tempo reached to the item (opens Set BPM); absent without an item. */
    saveBpm: () => void
}

const SUBDIVISIONS: [Subdivision, string][] = [
    [1, 'Quarter notes'],
    [2, 'Eighths'],
    [3, 'Triplets'],
    [4, 'Sixteenths']
]

/**
 * The metronome's controls: tempo, start and stop, tap tempo, beats per bar, subdivision, volume,
 * the speed trainer, and Save BPM for the item practiced. Returns a cleanup.
 */
export function renderMetronome(
    container: HTMLElement,
    metronome: Metronome,
    deps: MetronomeViewDeps
): () => void {
    const el = container.createDiv({ cls: 'mp-metronome' })
    const itemEl = el.createDiv({ cls: 'mp-metronome-item' })

    const tempo = el.createDiv({ cls: 'mp-metronome-tempo' })
    const nudge = (by: number, label: string) => {
        const b = tempo.createEl('button', {
            text: label,
            attr: { 'aria-label': `${by > 0 ? '+' : ''}${by} BPM` }
        })
        b.addEventListener('click', () => metronome.setBpm(metronome.state.bpm + by))
    }
    nudge(-5, '−5')
    nudge(-1, '−1')
    const bpmInput = tempo.createEl('input', {
        type: 'number',
        cls: 'mp-metronome-bpm',
        attr: { 'min': '20', 'max': '300', 'aria-label': 'BPM' }
    })
    bpmInput.addEventListener('change', () => metronome.setBpm(Number(bpmInput.value)))
    nudge(1, '+1')
    nudge(5, '+5')

    const beats = el.createDiv({ cls: 'mp-metronome-beats', attr: { 'aria-hidden': 'true' } })

    const actions = el.createDiv({ cls: 'mp-metronome-actions' })
    const play = actions.createEl('button', { cls: 'mod-cta' })
    play.addEventListener('click', () => metronome.toggle())
    const taps: number[] = []
    const tap = actions.createEl('button', { text: 'Tap' })
    tap.addEventListener('click', () => {
        taps.push(Date.now())
        const bpm = bpmFromTaps(taps)
        if (bpm) metronome.setBpm(bpm)
    })

    const options = el.createDiv({ cls: 'mp-form-row' })
    const beatsField = options.createEl('label', { cls: 'mp-field', text: 'Beats per bar' })
    const beatsSelect = beatsField.createEl('select', { cls: 'dropdown' })
    for (let n = 2; n <= 12; n++)
        beatsSelect.createEl('option', { text: String(n), value: String(n) })
    beatsSelect.addEventListener('change', () => {
        void deps.saveSettings({ beatsPerBar: Number(beatsSelect.value) }).then(update)
    })
    const subField = options.createEl('label', { cls: 'mp-field', text: 'Clicks' })
    const subSelect = subField.createEl('select', { cls: 'dropdown' })
    for (const [value, text] of SUBDIVISIONS)
        subSelect.createEl('option', { text, value: String(value) })
    subSelect.addEventListener('change', () => {
        void deps.saveSettings({ subdivision: Number(subSelect.value) as Subdivision })
    })
    const volumeField = el.createEl('label', { cls: 'mp-field', text: 'Volume' })
    const volume = volumeField.createEl('input', {
        type: 'range',
        attr: { min: '0', max: '1', step: '0.05' }
    })
    volume.addEventListener(
        'change',
        () => void deps.saveSettings({ volume: Number(volume.value) })
    )

    const trainerEl = el.createDiv({ cls: 'mp-metronome-trainer' })
    const trainerLabel = trainerEl.createEl('label', { cls: 'mp-check' })
    const trainerBox = trainerLabel.createEl('input', { type: 'checkbox' })
    trainerLabel.appendText(' Speed trainer')
    trainerBox.addEventListener('change', () => metronome.setTrainer(trainerBox.checked))
    const trainerInfo = trainerEl.createSpan({ cls: 'mp-muted' })
    const stepUp = trainerEl.createEl('button', {
        text: '+',
        attr: { 'aria-label': 'Step the tempo up now' }
    })
    stepUp.addEventListener('click', () => metronome.stepUp())

    const save = el.createEl('button', { text: 'Save BPM to the note' })
    save.addEventListener('click', () => deps.saveBpm())

    const update = () => {
        const s = metronome.state
        const settings = deps.settings()
        if (el.ownerDocument.activeElement !== bpmInput) bpmInput.value = String(s.bpm)
        play.setText(s.running ? 'Stop' : 'Start')
        beatsSelect.value = String(settings.beatsPerBar)
        subSelect.value = String(settings.subdivision)
        volume.value = String(settings.volume)
        beats.empty()
        for (let n = 0; n < settings.beatsPerBar; n++) {
            const dot = beats.createSpan({ cls: 'mp-metronome-dot' })
            if (s.running && n === s.beat) dot.addClass(n === 0 ? 'is-accent' : 'is-on')
        }
        itemEl.setText(
            s.item
                ? `${s.item.name}${s.item.bpmCurrent || s.item.bpmTarget ? ` · ${s.item.bpmCurrent ?? '?'} → ${s.item.bpmTarget ?? '?'} BPM` : ''}`
                : 'No note: open one, or pick an item in the practice panel, to save its BPM.'
        )
        trainerBox.checked = s.trainer !== null
        trainerInfo.setText(
            s.trainer
                ? ` +${s.trainer.step} every ${s.trainer.everyBars} bars${s.trainer.target ? `, up to ${s.trainer.target}` : ''}`
                : ''
        )
        stepUp.toggle(s.trainer !== null)
        save.toggle(s.item !== null)
    }
    const unsubscribe = metronome.subscribe(update)
    update()
    return () => {
        unsubscribe()
        el.remove()
    }
}

/** The metronome in a modal, when the practice panel isn't open. Closing it keeps it playing. */
export class MetronomeModal extends Modal {
    private cleanup: (() => void) | null = null

    constructor(
        app: App,
        private readonly metronome: Metronome,
        private readonly deps: MetronomeViewDeps
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle('Metronome')
        this.contentEl.addClass('mp-modal')
        this.cleanup = renderMetronome(this.contentEl, this.metronome, this.deps)
    }

    override onClose(): void {
        this.cleanup?.()
        this.cleanup = null
        this.contentEl.empty()
    }
}
