import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { chordTitle, parseChord, safeTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import { levelOf } from '../domain/mastery'
import type { LearningType } from '../domain/note-model'
import type { NewLearningNote } from '../services/note-creator.service'
import { renderBlock } from '@dsebastien/music-notation'
import type { FrettedVoicing, RenderOptions, RenderResult } from '@dsebastien/music-notation'
import { lookupGuitarVoicing, voicingCount } from '@dsebastien/music-notation/voicings'
import { blockSource, chordBlock, formatFrets, voicingRow } from '../domain/notation-note'

/** Add a learning note: type, name (or chord symbol), shape and starting level. */
export class AddNoteModal extends Modal {
    private type: LearningType
    private text = ''
    private shape = ''
    private level: number | undefined
    /** Guitar chords: index of the voicing to prefill; -1 for none. */
    private voicingIndex = 0
    private formEl: HTMLElement | null = null
    /** The previews: one diagram, or a row of voicings to pick from. */
    private diagrams: RenderResult[] = []

    constructor(
        app: App,
        private readonly types: LearningType[],
        private readonly fields: FieldNames,
        /** Whether chord notes get a ```chord block (Music Practice draws them). */
        private readonly chordBlocks: () => boolean,
        private readonly create: (type: LearningType, spec: NewLearningNote) => Promise<void>,
        /** Orientation and hand, so previews look like the notes will. */
        private readonly renderOptions: () => RenderOptions = () => ({})
    ) {
        super(app)
        this.type = types[0]!
    }

    /** The instrument whose notation a chord note of this type gets; null for other kinds. */
    private instrument(): 'guitar' | 'piano' | null {
        if (this.type.kind !== 'chord') return null
        return this.type.subject === 'guitar' || this.type.subject === 'piano'
            ? this.type.subject
            : null
    }

    /** The chord symbol typed, when it is one. */
    private symbol(): string | null {
        return this.type.kind === 'chord' ? (parseChord(this.text.trim())?.symbol ?? null) : null
    }

    private voicing(): FrettedVoicing | null {
        const symbol = this.symbol()
        return symbol && this.instrument() === 'guitar' && this.voicingIndex >= 0
            ? lookupGuitarVoicing(symbol, this.voicingIndex)
            : null
    }

    /** The ```chord block the note gets: only one that draws, and only when Music Practice draws them. */
    private notation(): string | null {
        const symbol = this.symbol()
        const instrument = this.instrument()
        if (!symbol || !instrument || !this.chordBlocks()) return null
        const block = chordBlock(symbol, instrument, this.voicing())
        if (!block) return null
        const probe = renderBlock('chord', blockSource(block), createDiv())
        probe.destroy()
        return probe.ok ? block : null
    }

    /** The note's title and chord symbol for the current input. */
    private spec(): NewLearningNote | null {
        const input = this.text.trim()
        if (!input) return null
        const chord = this.type.kind === 'chord' ? parseChord(input) : null
        const shape = safeTitle(this.shape)
        const title = safeTitle(
            chord ? chordTitle(chord, shape || undefined) : shape ? `${input} - ${shape}` : input
        )
        if (!title) return null
        return {
            title,
            ...(chord ? { chordSymbol: chord.symbol } : {}),
            ...(this.shape ? { shape: this.shape } : {}),
            ...(this.level !== undefined ? { level: this.level } : {}),
            ...(this.voicing() ? { voicing: this.voicing()! } : {}),
            ...(this.notation() ? { notation: this.notation()! } : {})
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
            this.voicingIndex = 0
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

        // Guitar chords: pick one of the library's voicings; the note gets its frets, fingers and
        // a diagram. Piano chords get a keyboard diagram from the symbol.
        const voicingField =
            this.instrument() === 'guitar'
                ? el.createEl('label', { cls: 'mp-field', text: 'Voicing' })
                : null
        const voicingSelect = voicingField?.createEl('select', { cls: 'dropdown' }) ?? null
        const diagramEl = el.createDiv({ cls: 'mp-notation-preview' })

        const preview = el.createDiv({ cls: 'mp-rubric' })
        const actions = el.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        const submit = actions.createEl('button', { cls: 'mod-cta', text: 'Add' })
        const refreshVoicings = () => {
            if (!voicingSelect || !voicingField) return
            const symbol = this.symbol()
            const count = symbol ? voicingCount(symbol) : 0
            voicingSelect.empty()
            voicingField.toggle(Boolean(symbol) && this.chordBlocks())
            if (!symbol) return
            if (count === 0) {
                voicingSelect.createEl('option', { text: 'None found: no diagram', value: '-1' })
                voicingSelect.disabled = true
                return
            }
            voicingSelect.disabled = false
            if (this.voicingIndex >= count) this.voicingIndex = 0
            for (let i = 0; i < count; i++) {
                const v = lookupGuitarVoicing(symbol, i)
                if (v)
                    voicingSelect.createEl('option', {
                        text: `${i + 1}: ${formatFrets(v.frets)}`,
                        value: String(i)
                    })
            }
            voicingSelect.createEl('option', { text: 'No diagram', value: '-1' })
            voicingSelect.value = String(this.voicingIndex)
        }
        voicingSelect?.addEventListener('change', () => {
            this.voicingIndex = Number(voicingSelect.value)
            refresh()
        })
        const options = (): RenderOptions => ({
            ...this.renderOptions(),
            voicings: lookupGuitarVoicing
        })
        // Guitar chords: the top voicings side by side, the selected one highlighted; a click
        // picks one. Past the fourth, the dropdown picks it and it joins the row. "No diagram"
        // shows none.
        const refreshVoicingRow = (symbol: string): boolean => {
            const indexes = voicingRow(voicingCount(symbol), this.voicingIndex)
            if (!indexes.length || this.voicingIndex < 0) return false
            const row = diagramEl.createDiv({
                cls: indexes.length > 4 ? 'mp-voicing-row has-extra' : 'mp-voicing-row'
            })
            for (const i of indexes) {
                const voicing = lookupGuitarVoicing(symbol, i)
                const block = voicing ? chordBlock(symbol, 'guitar', voicing) : null
                if (!voicing || !block) continue
                const selected = i === this.voicingIndex
                const button = row.createEl('button', {
                    cls: selected ? 'mp-voicing is-selected' : 'mp-voicing',
                    attr: {
                        'aria-label': `Voicing ${i + 1}: ${formatFrets(voicing.frets)}`,
                        'aria-pressed': String(selected)
                    }
                })
                this.diagrams.push(
                    renderBlock(
                        'chord',
                        `${blockSource(block)}\ntitle: ${i + 1}`,
                        button,
                        options()
                    )
                )
                // Selected in place, so the button keeps the keyboard focus.
                button.addEventListener('click', () => {
                    this.voicingIndex = i
                    if (voicingSelect) voicingSelect.value = String(i)
                    row.querySelectorAll('.mp-voicing').forEach((b) => {
                        const on = b === button
                        b.toggleClass('is-selected', on)
                        b.setAttr('aria-pressed', String(on))
                    })
                })
            }
            return true
        }
        const refreshDiagram = () => {
            for (const diagram of this.diagrams) diagram.destroy()
            this.diagrams = []
            diagramEl.empty()
            const symbol = this.symbol()
            if (
                symbol &&
                this.instrument() === 'guitar' &&
                this.chordBlocks() &&
                refreshVoicingRow(symbol)
            )
                return
            const block = this.notation()
            if (!block) return
            this.diagrams.push(renderBlock('chord', blockSource(block), diagramEl, options()))
        }
        const refresh = () => {
            refreshDiagram()
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
            this.voicingIndex = 0
            refreshVoicings()
            refresh()
        })
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') void this.submit()
        })
        submit.addEventListener('click', () => void this.submit())
        refreshVoicings()
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
        for (const diagram of this.diagrams) diagram.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}
