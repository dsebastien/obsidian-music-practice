/**
 * Identify this chord by clicking (#76): the note's frets or keys on a fretboard or keyboard,
 * changed by clicks; the chord they make (pick a reading to name the note) or, when they make
 * none, the chords that hold them with their missing notes.
 */
import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { Hand, Orientation, PlayOptions } from '@dsebastien/music-notation'
import { clickHint, pitchesOfFrets, readValue, type ClickValue } from '../domain/click-input'
import { ClickInput, renderNearMatches } from './click-input'

export interface IdentifyChordOptions {
    instrument: 'guitar' | 'piano'
    /** The note's frets or keys (none chosen when it has none). */
    value: ClickValue
    layout: () => { hand: Hand; fretboard: Orientation; keyboard: Orientation }
    play: () => PlayOptions | false
    /** Names the note with this chord, and keeps the notes clicked; rejects when it can't. */
    name: (symbol: string, value: ClickValue) => Promise<void>
}

export class IdentifyChordModal extends Modal {
    private clicks: ClickInput | null = null

    constructor(
        app: App,
        private readonly options: IdentifyChordOptions
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle('Identify this chord')
        this.contentEl.addClass('mp-modal')
        const el = this.contentEl
        el.createEl('p', {
            cls: 'mp-muted',
            text:
                this.options.instrument === 'guitar'
                    ? 'Click a string at a fret to play it there; click it again to mute the string.'
                    : 'Click the keys of the chord; click a key again to take it away.'
        })
        const host = el.createDiv()
        const result = el.createDiv({ cls: 'mp-click-result', attr: { 'aria-live': 'polite' } })
        const near = el.createDiv({ cls: 'mp-click-near-box' })
        const actions = el.createDiv({ cls: 'mp-actions' })
        const show = (value: ClickValue) => {
            const read = readValue(value)
            result.empty()
            actions.empty()
            if (read.detected) {
                result.setText(
                    read.detected.readings.length > 1
                        ? `This chord reads ${read.detected.readings.length} ways: pick one.`
                        : `This is ${read.detected.symbol}.`
                )
                for (const reading of read.detected.readings) {
                    const button = actions.createEl('button', {
                        cls: reading === read.detected.symbol ? 'mod-cta' : '',
                        text: `Name it ${reading}`
                    })
                    button.addEventListener('click', () => {
                        button.disabled = true
                        void this.options
                            .name(reading, value)
                            .then(() => this.close())
                            .catch((error: unknown) => {
                                // Nothing written: the modal stays open and says why.
                                button.disabled = false
                                const message =
                                    error instanceof Error ? error.message : String(error)
                                result.setText(`Couldn't name the chord: ${message}`)
                                new Notice(`Couldn't name the chord: ${message}`)
                            })
                    })
                }
            } else
                result.setText(
                    clickHint(
                        value.kind === 'keys' ? value.keys : pitchesOfFrets(value.frets),
                        read.near
                    )
                )
            renderNearMatches(near, read.near, { mark: (m) => this.clicks?.showNear(m) })
        }
        this.clicks = new ClickInput(host, {
            instrument: this.options.instrument,
            layout: this.options.layout,
            play: this.options.play,
            value: this.options.value,
            onChange: show
        })
        show(this.options.value)
    }

    override onClose(): void {
        this.clicks?.destroy()
        this.clicks = null
        this.contentEl.empty()
    }
}
