import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import { DEFAULT_EXERCISE_TEMPO, renderBlock } from '@dsebastien/music-notation'
import type {
    ExerciseDirection,
    ExerciseRhythm,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import { exerciseFretboard } from '../domain/exercise'
import type { ExerciseChoice, ExercisePosition, ExerciseSubject } from '../domain/exercise'

const DIRECTIONS: [ExerciseDirection, string][] = [
    ['both', 'Up and down'],
    ['up', 'Up'],
    ['down', 'Down']
]

const RHYTHMS: [ExerciseRhythm, string][] = [
    ['8ths', '8th notes'],
    ['triplets', 'Triplets'],
    ['16ths', '16th notes']
]

/**
 * Insert a tab exercise (#70): the position, direction, rhythm and tempo of a scale or arpeggio
 * note's run; the preview draws the position and its tab as the block will play it.
 */
export class ExerciseModal extends Modal {
    private position: number
    private choice: ExerciseChoice
    private preview: RenderResult | null = null

    constructor(
        app: App,
        private readonly subject: ExerciseSubject,
        /** The positions the library plays it from (`exercisePositions`), and the first one shown. */
        private readonly positions: ExercisePosition[],
        options: { position: number; tempo: number | undefined },
        /** Orientation, hand and the tab drawing, so the preview looks like the note will. */
        private readonly renderOptions: () => RenderOptions,
        private readonly insert: (at: ExercisePosition, choice: ExerciseChoice) => void
    ) {
        super(app)
        this.position = options.position
        this.choice = {
            direction: 'both',
            rhythm: '8ths',
            tempo: options.tempo ?? DEFAULT_EXERCISE_TEMPO
        }
    }

    private previewEl: HTMLElement | null = null

    override onOpen(): void {
        this.setTitle(`Tab exercise: ${this.subject.name}`)
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        const row = contentEl.createDiv({ cls: 'mp-form-row' })
        this.select(
            row,
            'Position',
            this.positions.map((p, i) => [String(i), p.label]),
            String(this.position),
            (v) => (this.position = Number(v))
        )
        this.select(row, 'Direction', DIRECTIONS, this.choice.direction, (v) => {
            this.choice = { ...this.choice, direction: v as ExerciseDirection }
        })
        this.select(row, 'Rhythm', RHYTHMS, this.choice.rhythm, (v) => {
            this.choice = { ...this.choice, rhythm: v as ExerciseRhythm }
        })
        const tempo = row.createEl('label', { cls: 'mp-field', text: 'Tempo (BPM)' })
        const input = tempo.createEl('input', { type: 'number', attr: { min: '20', max: '240' } })
        input.value = String(this.choice.tempo)
        input.addEventListener('change', () => {
            const n = Math.round(Number(input.value))
            const value = Number.isFinite(n)
                ? Math.min(240, Math.max(20, n))
                : DEFAULT_EXERCISE_TEMPO
            input.value = String(value)
            this.choice = { ...this.choice, tempo: value }
            this.draw()
        })
        contentEl.createEl('p', {
            cls: 'mp-rubric',
            text: 'The tab plays with the count-in, the metronome and the speed control of its player bar.'
        })
        this.previewEl = contentEl.createDiv({ cls: 'mp-notation-preview mp-exercise-preview' })
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        actions
            .createEl('button', { cls: 'mod-cta', text: 'Insert' })
            .addEventListener('click', () => {
                const at = this.positions[this.position]
                if (!at) return
                this.close()
                this.insert(at, this.choice)
            })
        this.draw()
    }

    private select(
        parent: HTMLElement,
        label: string,
        options: [string, string][],
        value: string,
        set: (v: string) => void
    ): void {
        const el = parent.createEl('label', { cls: 'mp-field', text: label })
        const select = el.createEl('select', { cls: 'dropdown' })
        for (const [v, text] of options) select.createEl('option', { value: v, text })
        select.value = value
        select.addEventListener('change', () => {
            set(select.value)
            this.draw()
        })
    }

    /** The position and its tab, drawn as the inserted block will play. */
    private draw(): void {
        const el = this.previewEl
        const at = this.positions[this.position]
        if (!el || !at) return
        this.preview?.destroy()
        el.empty()
        this.preview = renderBlock(
            'fretboard',
            exerciseFretboard(this.subject, at, this.choice),
            el,
            this.renderOptions()
        )
    }

    override onClose(): void {
        this.preview?.destroy()
        this.preview = null
        this.contentEl.empty()
    }
}
