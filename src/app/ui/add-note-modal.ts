import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { chordTitle, parseChord, safeTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import { levelOf } from '../domain/mastery'
import type { LearningType } from '../domain/note-model'
import type { NewLearningNote } from '../services/note-creator.service'

/** Add a learning note: type, name (or chord symbol), shape and starting level. */
export class AddNoteModal extends Modal {
    private type: LearningType
    private text = ''
    private shape = ''
    private level: number | undefined
    private formEl: HTMLElement | null = null

    constructor(
        app: App,
        private readonly types: LearningType[],
        private readonly fields: FieldNames,
        private readonly create: (type: LearningType, spec: NewLearningNote) => Promise<void>
    ) {
        super(app)
        this.type = types[0]!
    }

    /** The note's title and chord symbol for the current input. */
    private spec(): NewLearningNote | null {
        const input = this.text.trim()
        if (!input) return null
        const chord = this.type.kind === 'chord' ? parseChord(input) : null
        const title = chord
            ? chordTitle(chord, this.shape || undefined)
            : safeTitle(this.shape ? `${input} - ${this.shape}` : input)
        return {
            title,
            ...(chord ? { chordSymbol: chord.symbol } : {}),
            ...(this.shape ? { shape: this.shape } : {}),
            ...(this.level !== undefined ? { level: this.level } : {})
        }
    }

    override onOpen(): void {
        this.setTitle('Add a learning note')
        this.contentEl.addClass('mp-modal')
        const typeField = this.contentEl.createEl('label', { cls: 'mp-field', text: 'Type' })
        const select = typeField.createEl('select', { cls: 'dropdown' })
        for (const [i, t] of this.types.entries())
            select.createEl('option', { text: t.name, value: String(i) })
        select.addEventListener('change', () => {
            this.type = this.types[Number(select.value)]!
            this.shape = ''
            this.level = undefined
            this.render()
        })
        this.formEl = this.contentEl.createDiv({ cls: 'mp-modal' })
        this.render()
    }

    private render(): void {
        const el = this.formEl
        if (!el) return
        el.empty()
        const isChord = this.type.kind === 'chord'
        const nameField = el.createEl('label', {
            cls: 'mp-field',
            text: isChord ? 'Chord symbol (F#m7, C/G) or name' : 'Name'
        })
        const input = nameField.createEl('input', {
            type: 'text',
            attr: { placeholder: isChord ? 'Am7' : "Knockin on Heaven's Door - Simplified" }
        })
        input.value = this.text

        const row = el.createDiv({ cls: 'mp-form-row' })
        const shapes = this.type.allowedValues[this.fields.shape] ?? []
        if (this.type.fields.has(this.fields.shape)) {
            const shapeField = row.createEl('label', { cls: 'mp-field', text: 'Shape (optional)' })
            if (shapes.length) {
                const s = shapeField.createEl('select', { cls: 'dropdown' })
                s.createEl('option', { text: '—', value: '' })
                for (const v of shapes)
                    s.createEl('option', { text: v, value: v }).selected = v === this.shape
                s.addEventListener('change', () => {
                    this.shape = s.value
                    refresh()
                })
            } else {
                const s = shapeField.createEl('input', {
                    type: 'text',
                    attr: { placeholder: 'Open' }
                })
                s.value = this.shape
                s.addEventListener('input', () => {
                    this.shape = s.value.trim()
                    refresh()
                })
            }
        }
        const levelField = row.createEl('label', { cls: 'mp-field', text: 'Mastery' })
        const levelSelect = levelField.createEl('select', { cls: 'dropdown' })
        for (const v of this.type.statusValues) {
            const option = levelSelect.createEl('option', { text: v, value: v })
            option.selected =
                this.level !== undefined
                    ? levelOf(v) === this.level
                    : v === this.type.statusValues[0]
        }
        levelSelect.addEventListener('change', () => {
            this.level = levelOf(levelSelect.value) ?? undefined
        })

        const preview = el.createDiv({ cls: 'mp-rubric' })
        const actions = el.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        const submit = actions.createEl('button', { cls: 'mod-cta', text: 'Add' })
        const refresh = () => {
            const spec = this.spec()
            preview.setText(
                spec
                    ? `Note: ${spec.title}${spec.chordSymbol ? ` (alias ${spec.chordSymbol})` : ''}`
                    : isChord
                      ? 'Type a chord symbol: its name is spelled out, the symbol becomes an alias.'
                      : ''
            )
            submit.disabled = !spec
        }
        input.addEventListener('input', () => {
            this.text = input.value
            refresh()
        })
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') void this.submit()
        })
        submit.addEventListener('click', () => void this.submit())
        refresh()
        input.focus()
    }

    private async submit(): Promise<void> {
        const spec = this.spec()
        if (!spec) return
        try {
            await this.create(this.type, spec)
            this.close()
        } catch (error: unknown) {
            new Notice(error instanceof Error ? error.message : String(error))
        }
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
