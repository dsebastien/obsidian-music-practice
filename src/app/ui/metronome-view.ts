import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import {
    bpmFromTaps,
    MAX_COUNT_IN_BARS,
    type MetronomeSettings,
    type Subdivision
} from '../domain/metronome'
import type { Metronome } from '../services/metronome.service'
import { t, tn } from '../i18n/i18n'

export interface MetronomeViewDeps {
    settings: () => MetronomeSettings
    saveSettings: (change: Partial<MetronomeSettings>) => Promise<void>
    /** Save the tempo reached to the item (opens Set BPM); absent without an item. */
    saveBpm: () => void
}

const subdivisions = (): [Subdivision, string][] => [
    [1, t('metronome.subdivision.quarter')],
    [2, t('metronome.subdivision.eighths')],
    [3, t('metronome.subdivision.triplets')],
    [4, t('metronome.subdivision.sixteenths')]
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
            attr: { 'aria-label': t('metronome.nudge', { by: `${by > 0 ? '+' : ''}${by}` }) }
        })
        b.addEventListener('click', () => metronome.setBpm(metronome.state.bpm + by))
    }
    nudge(-5, '−5')
    nudge(-1, '−1')
    const bpmInput = tempo.createEl('input', {
        type: 'number',
        cls: 'mp-metronome-bpm',
        attr: { 'min': '20', 'max': '300', 'aria-label': t('metronome.bpm') }
    })
    bpmInput.addEventListener('change', () => metronome.setBpm(Number(bpmInput.value)))
    nudge(1, '+1')
    nudge(5, '+5')

    const beats = el.createDiv({ cls: 'mp-metronome-beats', attr: { 'aria-hidden': 'true' } })
    // A light for noisy rooms: it flashes on each beat, beat one in the accent color (#77).
    const flash = el.createDiv({ cls: 'mp-metronome-flash', attr: { 'aria-hidden': 'true' } })
    const status = el.createDiv({ cls: 'mp-metronome-status mp-muted' })

    const actions = el.createDiv({ cls: 'mp-metronome-actions' })
    const play = actions.createEl('button', { cls: 'mod-cta' })
    play.addEventListener('click', () => metronome.toggle())
    const taps: number[] = []
    const tap = actions.createEl('button', { text: t('metronome.tap') })
    tap.addEventListener('click', () => {
        taps.push(Date.now())
        const bpm = bpmFromTaps(taps)
        if (bpm) metronome.setBpm(bpm)
    })

    const options = el.createDiv({ cls: 'mp-form-row' })
    const beatsField = options.createEl('label', {
        cls: 'mp-field',
        text: t('metronome.beatsPerBar')
    })
    const beatsSelect = beatsField.createEl('select', { cls: 'dropdown' })
    for (let n = 2; n <= 12; n++)
        beatsSelect.createEl('option', { text: String(n), value: String(n) })
    beatsSelect.addEventListener('change', () => {
        // Beats chosen by hand win over the note's time signature.
        metronome.clearMeter()
        void deps.saveSettings({ beatsPerBar: Number(beatsSelect.value) }).then(() => {
            lastControls = ''
            update()
        })
    })
    const subField = options.createEl('label', { cls: 'mp-field', text: t('metronome.clicks') })
    const subSelect = subField.createEl('select', { cls: 'dropdown' })
    for (const [value, text] of subdivisions())
        subSelect.createEl('option', { text, value: String(value) })
    subSelect.addEventListener('change', () => {
        metronome.clearMeter()
        void deps.saveSettings({ subdivision: Number(subSelect.value) as Subdivision })
    })
    const countField = options.createEl('label', { cls: 'mp-field', text: t('metronome.countIn') })
    const countSelect = countField.createEl('select', { cls: 'dropdown' })
    for (let n = 0; n <= MAX_COUNT_IN_BARS; n++)
        countSelect.createEl('option', {
            text: n === 0 ? t('metronome.countIn.none') : tn('metronome.countIn.bars', n),
            value: String(n)
        })
    countSelect.addEventListener('change', () => {
        void deps.saveSettings({ countInBars: Number(countSelect.value) })
    })
    const flashLabel = options.createEl('label', { cls: 'mp-check' })
    const flashBox = flashLabel.createEl('input', { type: 'checkbox' })
    flashLabel.appendText(` ${t('metronome.flash')}`)
    flashBox.addEventListener('change', () => void deps.saveSettings({ flash: flashBox.checked }))
    const volumeField = el.createEl('label', { cls: 'mp-field', text: t('metronome.volume') })
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
    trainerLabel.appendText(` ${t('metronome.trainer')}`)
    trainerBox.addEventListener('change', () => metronome.setTrainer(trainerBox.checked))
    const trainerInfo = trainerEl.createSpan({ cls: 'mp-muted' })
    const stepUp = trainerEl.createEl('button', {
        text: '+',
        attr: { 'aria-label': t('metronome.stepUp') }
    })
    stepUp.addEventListener('click', () => metronome.stepUp())

    const save = el.createEl('button', { text: t('metronome.saveBpm') })
    save.addEventListener('click', () => deps.saveBpm())

    // The beat moves up to 20 times a second: only the beat dots follow it; the controls are set
    // when something else changed, and never while you're using one.
    let lastPulse = -1
    let flashOff: number | null = null
    const win = el.ownerDocument.defaultView ?? window
    const showBeat = () => {
        const s = metronome.state
        const { beatsPerBar } = metronome.meterNow()
        if (beats.childElementCount !== beatsPerBar) {
            beats.empty()
            for (let n = 0; n < beatsPerBar; n++) beats.createSpan({ cls: 'mp-metronome-dot' })
        }
        beats.toggleClass('is-count-in', s.running && s.countIn)
        Array.from(beats.children).forEach((dot: Element, n) => {
            const on = s.running && n === s.beat
            dot.classList.toggle('is-accent', on && n === 0)
            dot.classList.toggle('is-on', on && n !== 0)
        })
        if (deps.settings().flash && s.running && s.pulse !== lastPulse) {
            flash.toggleClass('is-accent', s.beat === 0 && !s.countIn)
            flash.toggleClass('is-count-in', s.countIn)
            flash.addClass('is-on')
            if (flashOff !== null) win.clearTimeout(flashOff)
            flashOff = win.setTimeout(() => {
                flashOff = null
                flash.removeClass('is-on')
            }, 120)
        }
        lastPulse = s.pulse
    }
    const update = () => {
        const s = metronome.state
        if (s.running && lastControls === key(s)) {
            showBeat()
            return
        }
        lastControls = key(s)
        const settings = deps.settings()
        const focused = el.ownerDocument.activeElement
        if (focused !== bpmInput) bpmInput.value = String(s.bpm)
        play.setText(s.running ? t('common.stop') : t('common.start'))
        const meter = metronome.meterNow()
        if (focused !== beatsSelect) beatsSelect.value = String(meter.beatsPerBar)
        if (focused !== subSelect) subSelect.value = String(meter.subdivision)
        if (focused !== countSelect) countSelect.value = String(settings.countInBars)
        flashBox.checked = settings.flash
        flash.toggle(settings.flash)
        if (focused !== volume) volume.value = String(settings.volume)
        status.setText(
            s.running && s.countIn
                ? t('metronome.status.countIn')
                : s.meter
                  ? t('metronome.status.fromNote', { label: s.meter.label })
                  : ''
        )
        status.toggle(status.getText() !== '')
        showBeat()
        itemEl.setText(
            s.item
                ? s.item.bpmCurrent || s.item.bpmTarget
                    ? t('metronome.item.withTempo', {
                          name: s.item.name,
                          current: s.item.bpmCurrent ?? '?',
                          target: s.item.bpmTarget ?? '?'
                      })
                    : s.item.name
                : t('metronome.item.none')
        )
        trainerBox.checked = s.trainer !== null
        trainerInfo.setText(
            s.trainer
                ? s.trainer.target && s.trainer.target > s.trainer.start
                    ? ` ${tn('metronome.trainer.infoTarget', s.trainer.everyBars, { step: s.trainer.step, target: s.trainer.target })}`
                    : ` ${tn('metronome.trainer.info', s.trainer.everyBars, { step: s.trainer.step })}`
                : ''
        )
        stepUp.toggle(s.trainer !== null)
        save.toggle(s.item !== null)
    }
    // Everything but the beat: when it changes, the controls are set again.
    const key = (s: typeof metronome.state) =>
        JSON.stringify([s.running, s.countIn, s.bpm, s.trainer, s.item, s.meter, deps.settings()])
    let lastControls = ''
    const unsubscribe = metronome.subscribe(update)
    update()
    return () => {
        unsubscribe()
        if (flashOff !== null) win.clearTimeout(flashOff)
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
        this.setTitle(t('metronome.title'))
        this.contentEl.addClass('mp-modal')
        this.cleanup = renderMetronome(this.contentEl, this.metronome, this.deps)
    }

    override onClose(): void {
        this.cleanup?.()
        this.cleanup = null
        this.contentEl.empty()
    }
}
