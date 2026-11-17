/**
 * Identify this chord by clicking (#76): the note's frets or keys on a fretboard or keyboard,
 * changed by clicks; the chord they make (pick a reading to name the note) or, when they make
 * none, the chords that hold them with their missing notes. When the note's name says a chord
 * (#119), one more button names the note from it, without clicks.
 */
import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { PlayOptions } from '@dsebastien/music-notation'
import { clickHint, pitchesOfFrets, readValue, type ClickValue } from '../domain/click-input'
import { ClickInput, renderNearMatches, type ClickLayout } from './click-input'
import { t } from '../i18n/i18n'

export interface IdentifyChordOptions {
    instrument: 'guitar' | 'piano'
    /** The note's frets or keys (none chosen when it has none). */
    value: ClickValue
    layout: () => ClickLayout
    play: () => PlayOptions | false
    /** Names the note with this chord, and keeps the notes clicked; rejects when it can't. */
    name: (symbol: string, value: ClickValue) => Promise<void>
    /** The chord the note's name says (#119), offered as a way to name the note without clicks. */
    fromName?: {
        name: string
        symbol: string
        shape: string | null
        /** Names the note from its name; rejects when it can't. */
        apply: () => Promise<void>
    }
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
        this.setTitle(t('tools.identify.title'))
        this.contentEl.addClass('mp-modal')
        const el = this.contentEl
        el.createEl('p', {
            cls: 'mp-muted',
            text:
                this.options.instrument === 'guitar'
                    ? t('tools.identify.helpGuitar')
                    : t('tools.identify.helpPiano')
        })
        // The note's name says a chord (#119): one click names the note, or the clicks below do.
        const fromName = this.options.fromName
        let nameButton: HTMLButtonElement | null = null
        if (fromName) {
            const box = el.createDiv({ cls: 'mp-click-name' })
            box.createEl('p', {
                text: fromName.shape
                    ? t('tools.identify.nameSaysShape', {
                          name: fromName.name,
                          symbol: fromName.symbol,
                          shape: fromName.shape
                      })
                    : t('tools.identify.nameSays', { name: fromName.name, symbol: fromName.symbol })
            })
            const button = box.createEl('button', {
                cls: 'mod-cta',
                text: t('tools.identify.nameFromName', { symbol: fromName.symbol })
            })
            button.addEventListener('click', () => {
                button.disabled = true
                void fromName
                    .apply()
                    .then(() => this.close())
                    .catch((error: unknown) => {
                        // Nothing written: the modal stays open and says why.
                        button.disabled = false
                        const message = error instanceof Error ? error.message : String(error)
                        new Notice(t('tools.identify.failed', { message }))
                    })
            })
            nameButton = button
        }
        const host = el.createDiv()
        const result = el.createDiv({ cls: 'mp-click-result', attr: { 'aria-live': 'polite' } })
        const near = el.createDiv({ cls: 'mp-click-near-box' })
        const actions = el.createDiv({ cls: 'mp-actions' })
        const show = (value: ClickValue) => {
            const read = readValue(value)
            result.empty()
            actions.empty()
            // Clicked notes that make a chord take the lead from the name.
            nameButton?.toggleClass('mod-cta', !read.detected)
            if (read.detected) {
                result.setText(
                    read.detected.readings.length > 1
                        ? t('tools.identify.ways', { count: read.detected.readings.length })
                        : t('tools.identify.is', { symbol: read.detected.symbol })
                )
                for (const reading of read.detected.readings) {
                    const button = actions.createEl('button', {
                        cls: reading === read.detected.symbol ? 'mod-cta' : '',
                        text: t('tools.identify.nameIt', { symbol: reading })
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
                                result.setText(t('tools.identify.failed', { message }))
                                new Notice(t('tools.identify.failed', { message }))
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
        // Enter names the note from its name right away.
        nameButton?.focus()
    }

    override onClose(): void {
        this.clicks?.destroy()
        this.clicks = null
        this.contentEl.empty()
    }
}
