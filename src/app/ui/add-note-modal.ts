import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { chordTitle, safeTitle, scaleTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import { levelOf } from '../domain/mastery'
import type { LearningType } from '../domain/note-model'
import type { NewLearningNote } from '../services/note-creator.service'
import {
    detectChordFromFrets,
    fingerVoicing,
    parseChord,
    parseFrets,
    readChord,
    renderBlock
} from '@dsebastien/music-notation'
import type {
    FrettedVoicing,
    GeneratedVoicing,
    NotationLanguage,
    ParsedChord,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import { lookupGuitarVoicing, voicingCount } from '@dsebastien/music-notation/voicings'
import { blockSource, chordBlock, formatFrets, voicingRow } from '../domain/notation-note'
import { shapeValue } from '../domain/voicings'

/** voicingIndex of a voicing picked from every way to play the chord (#54). */
const PICKED = -2

/** Scale roots and types offered when the note type doesn't list its own. */
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const SCALE_TYPES = [
    'Major',
    'Natural minor',
    'Harmonic minor',
    'Melodic minor',
    'Major pentatonic',
    'Minor pentatonic',
    'Blues',
    'Dorian',
    'Phrygian',
    'Lydian',
    'Mixolydian',
    'Locrian'
]

/**
 * Add a learning note: type, name (a chord in symbols, words or frets; a scale's root and type),
 * shape and starting level. Chord and scale notes get their properties and an empty notation
 * block that draws from them.
 */
export class AddNoteModal extends Modal {
    private type: LearningType
    private text = ''
    private scaleRoot = ''
    private scaleType = ''
    private shape = ''
    private level: number | undefined
    /** Guitar chords: index of the voicing to prefill; -1 for none; PICKED for `picked`. */
    private voicingIndex = 0
    /** A voicing picked from every way to play the chord. */
    private picked: GeneratedVoicing | null = null
    /** The shape came with the picked voicing (and goes when the chord changes). */
    private shapeFromPick = false
    /** The shape field, to update it in place. */
    private shapeEl: HTMLSelectElement | HTMLInputElement | null = null
    private formEl: HTMLElement | null = null
    /** The previews: one diagram, or a row of voicings to pick from. */
    private diagrams: RenderResult[] = []

    constructor(
        app: App,
        private readonly types: LearningType[],
        private readonly fields: FieldNames,
        /** Whether Music Practice draws a block language (notes only get blocks it draws). */
        private readonly blocksOn: (language: NotationLanguage) => boolean,
        private readonly create: (type: LearningType, spec: NewLearningNote) => Promise<void>,
        /** Orientation and hand, so previews look like the notes will. */
        private readonly renderOptions: () => RenderOptions = () => ({}),
        /** Every way to play a chord, to pick one from (#54). */
        private readonly moreVoicings?: (
            symbol: string,
            pick: (voicing: GeneratedVoicing) => void
        ) => void
    ) {
        super(app)
        this.type = types[0]!
    }

    /** The instrument whose notation a chord or scale note of this type gets; null for others. */
    private instrument(): 'guitar' | 'piano' | null {
        if (this.type.kind !== 'chord' && this.type.kind !== 'scale') return null
        return this.type.subject === 'guitar' || this.type.subject === 'piano'
            ? this.type.subject
            : null
    }

    /** The block language a note of this type gets; null when it gets none. */
    private language(): NotationLanguage | null {
        const instrument = this.instrument()
        if (!instrument) return null
        if (this.type.kind === 'chord') return 'chord'
        return instrument === 'guitar' ? 'fretboard' : 'keyboard'
    }

    /** Guitar chords typed as frets ("x02220"): six strings, lowest first. */
    private typedFrets(): (number | null)[] | null {
        if (this.type.kind !== 'chord' || this.instrument() !== 'guitar') return null
        const frets = parseFrets(this.text.trim())
        return frets?.length === 6 ? frets : null
    }

    /** The chord typed: a symbol ("Am7"), words ("A Minor 7"), or recognized from frets. */
    private chord(): ParsedChord | null {
        if (this.type.kind !== 'chord') return null
        const frets = this.typedFrets()
        if (frets) {
            const detected = detectChordFromFrets(frets)
            return detected ? parseChord(detected.symbol) : null
        }
        return readChord(this.text.trim())
    }

    /** The chord symbol typed, when it is one. */
    private symbol(): string | null {
        return this.chord()?.symbol ?? null
    }

    private voicing(): FrettedVoicing | null {
        const frets = this.typedFrets()
        // Typed frets get their fingers worked out, when a hand can play them.
        if (frets) return { frets, fingers: fingerVoicing(frets) ?? frets.map(() => null) }
        if (this.voicingIndex === PICKED && this.picked) return this.picked
        const symbol = this.symbol()
        return symbol && this.instrument() === 'guitar' && this.voicingIndex >= 0
            ? lookupGuitarVoicing(symbol, this.voicingIndex)
            : null
    }

    /** Whether this is a scale type that stores its root and type (else it's named by hand). */
    private scaleFields(): boolean {
        return (
            this.type.kind === 'scale' &&
            this.instrument() !== null &&
            this.type.fields.has(this.fields.scaleRoot) &&
            this.type.fields.has(this.fields.scaleType)
        )
    }

    /** A scale note's properties, by the configured names. */
    private scaleProperties(): Record<string, string> | null {
        if (!this.scaleFields() || !this.scaleRoot || !this.scaleType) return null
        return { [this.fields.scaleRoot]: this.scaleRoot, [this.fields.scaleType]: this.scaleType }
    }

    /** The full ```chord block for the preview: only one that draws. */
    private preview(): string | null {
        const symbol = this.symbol()
        const instrument = this.instrument()
        if (!symbol || !instrument || this.type.kind !== 'chord') return null
        const block = chordBlock(symbol, instrument, this.voicing())
        if (!block) return null
        const probe = renderBlock('chord', blockSource(block), createDiv())
        probe.destroy()
        return probe.ok ? block : null
    }

    /**
     * The empty block the note gets (it draws from the properties): only one that would draw, and
     * only a language Music Practice draws.
     */
    private block(): NotationLanguage | null {
        const language = this.language()
        if (!language || !this.blocksOn(language)) return null
        if (language === 'chord') return this.preview() ? language : null
        return this.scaleProperties() ? language : null
    }

    /** The note's title and properties for the current input. */
    private spec(): NewLearningNote | null {
        const shape = safeTitle(this.shape)
        const scale = this.scaleProperties()
        const input = this.text.trim()
        if (this.scaleFields() && !scale) return null
        if (!scale && !input) return null
        const chord = this.chord()
        // Frets the library doesn't recognize name nothing: type the chord instead.
        if (this.typedFrets() && !chord) return null
        const title = safeTitle(
            chord
                ? chordTitle(chord, shape || undefined)
                : scale
                  ? scaleTitle(this.scaleRoot, this.scaleType, shape || undefined)
                  : shape
                    ? `${input} - ${shape}`
                    : input
        )
        if (!title) return null
        const block = this.block()
        return {
            title,
            ...(chord ? { chordSymbol: chord.symbol } : {}),
            ...(this.shape ? { shape: this.shape } : {}),
            ...(this.level !== undefined ? { level: this.level } : {}),
            ...(this.voicing() ? { voicing: this.voicing()! } : {}),
            ...(scale ? { properties: scale } : {}),
            ...(block ? { block } : {})
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
            this.picked = null
            this.shapeFromPick = false
            this.scaleRoot = ''
            this.scaleType = ''
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
        const isScale = this.scaleFields()
        const guitarChord = isChord && this.instrument() === 'guitar'
        // Scales: a root and a scale or mode, from the type's values when it lists them.
        const scaleRow = isScale ? el.createDiv({ cls: 'mp-form-row' }) : null
        const picker = (
            label: string,
            values: string[],
            current: string,
            set: (v: string) => void
        ) => {
            if (!scaleRow) return
            const field = scaleRow.createEl('label', { cls: 'mp-field', text: label })
            const select = field.createEl('select', { cls: 'dropdown' })
            select.createEl('option', { text: '—', value: '' })
            for (const v of values)
                select.createEl('option', { text: v, value: v }).selected = v === current
            select.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') void this.submit()
            })
            select.addEventListener('change', () => {
                set(select.value)
                refresh()
            })
        }
        const valuesOf = (name: string, fallback: string[]) => {
            const values = this.type.allowedValues[name]
            return values?.length ? values : fallback
        }
        picker(
            'Root',
            valuesOf(this.fields.scaleRoot, ROOTS),
            this.scaleRoot,
            (v) => (this.scaleRoot = v)
        )
        picker(
            'Scale or mode',
            valuesOf(this.fields.scaleType, SCALE_TYPES),
            this.scaleType,
            (v) => (this.scaleType = v)
        )
        const nameField = isScale
            ? null
            : el.createEl('label', {
                  cls: 'mp-field',
                  text: guitarChord
                      ? 'Chord (F#m7, A Major) or frets (x02220)'
                      : isChord
                        ? 'Chord (F#m7, A Major)'
                        : 'Name'
              })
        const input = (nameField ?? createDiv()).createEl('input', {
            type: 'text',
            attr: {
                placeholder: isChord ? 'Am7' : "Knockin on Heaven's Door - Simplified"
            }
        })
        input.value = this.text

        const row = el.createDiv({ cls: 'mp-form-row' })
        const shapes = this.type.allowedValues[this.fields.shape] ?? []
        this.shapeEl = null
        if (this.type.fields.has(this.fields.shape)) {
            const shapeField = row.createEl('label', { cls: 'mp-field', text: 'Shape (optional)' })
            if (shapes.length) {
                const s = shapeField.createEl('select', { cls: 'dropdown' })
                this.shapeEl = s
                s.createEl('option', { text: '—', value: '' })
                for (const v of shapes)
                    s.createEl('option', { text: v, value: v }).selected = v === this.shape
                s.addEventListener('change', () => {
                    this.shape = s.value
                    this.shapeFromPick = false
                    refresh()
                })
            } else {
                const s = shapeField.createEl('input', {
                    type: 'text',
                    attr: { placeholder: 'Open' }
                })
                this.shapeEl = s
                s.value = this.shape
                s.addEventListener('input', () => {
                    this.shape = s.value.trim()
                    this.shapeFromPick = false
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
        const more =
            voicingField && this.moreVoicings
                ? voicingField.createEl('button', { text: 'More voicings…' })
                : null
        more?.addEventListener('click', (event) => {
            event.preventDefault()
            const symbol = this.symbol()
            if (!symbol) return
            this.moreVoicings?.(symbol, (voicing) => {
                this.picked = voicing
                this.voicingIndex = PICKED
                // The shape is the voicing's (one chosen before described another voicing).
                const name = this.fields.shape
                if (this.type.fields.has(name))
                    this.setShape(
                        shapeValue(voicing.shape, this.type.allowedValues[name] ?? []) ?? '',
                        true
                    )
                this.render()
            })
        })
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
            voicingField.toggle(Boolean(symbol) && this.blocksOn('chord') && !this.typedFrets())
            if (!symbol) return
            if (count === 0 && !this.picked) {
                voicingSelect.createEl('option', {
                    text: this.moreVoicings
                        ? 'None in the database: see More voicings'
                        : 'None found: no diagram',
                    value: '-1'
                })
                voicingSelect.disabled = true
                if (this.voicingIndex >= 0) this.voicingIndex = -1
                return
            }
            voicingSelect.disabled = false
            if (this.voicingIndex >= count) this.voicingIndex = 0
            if (this.picked)
                voicingSelect.createEl('option', {
                    text: `Picked: ${formatFrets(this.picked.frets)}`,
                    value: String(PICKED)
                })
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
            this.dropPickedShape()
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
            const picked = this.voicingIndex === PICKED ? this.picked : null
            const indexes = [
                ...voicingRow(voicingCount(symbol), this.voicingIndex),
                ...(picked ? [PICKED] : [])
            ]
            if (!indexes.length || (this.voicingIndex < 0 && !picked)) return false
            const row = diagramEl.createDiv({
                cls: indexes.length > 4 ? 'mp-voicing-row has-extra' : 'mp-voicing-row'
            })
            for (const i of indexes) {
                const voicing = i === PICKED ? picked : lookupGuitarVoicing(symbol, i)
                const block = voicing ? chordBlock(symbol, 'guitar', voicing) : null
                if (!voicing || !block) continue
                const selected = i === this.voicingIndex
                const label = i === PICKED ? 'Picked' : String(i + 1)
                const button = row.createEl('button', {
                    cls: selected ? 'mp-voicing is-selected' : 'mp-voicing',
                    attr: {
                        'aria-label': `Voicing ${label}: ${formatFrets(voicing.frets)}`,
                        'aria-pressed': String(selected)
                    }
                })
                this.diagrams.push(
                    renderBlock(
                        'chord',
                        `${blockSource(block)}\ntitle: ${label}`,
                        button,
                        options()
                    )
                )
                // Selected in place, so the button keeps the keyboard focus.
                button.addEventListener('click', () => {
                    this.voicingIndex = i
                    if (voicingSelect) voicingSelect.value = String(i)
                    // Away from the picked voicing, its shape goes too (the title changes).
                    if (this.dropPickedShape()) {
                        refresh()
                        return
                    }
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
                this.blocksOn('chord') &&
                !this.typedFrets() &&
                refreshVoicingRow(symbol)
            )
                return
            // Scales: drawn from the properties the note will get, as the note will draw them.
            const scale = this.scaleProperties()
            const language = this.language()
            if (scale && language && language !== 'chord' && this.blocksOn(language)) {
                const properties = {
                    scale_root: this.scaleRoot,
                    scale_type: this.scaleType,
                    shape: this.shape
                }
                this.diagrams.push(
                    renderBlock(language, '', diagramEl, {
                        ...options(),
                        properties,
                        instrument: this.instrument()!
                    })
                )
                return
            }
            const block = this.blocksOn('chord') ? this.preview() : null
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
                      ? this.typedFrets()
                          ? 'These frets make no chord the library knows: type the chord instead.'
                          : 'Type a chord: its name is spelled out, the symbol becomes an alias.'
                      : isScale
                        ? 'Pick a root and a scale or mode.'
                        : ''
            )
            submit.disabled = !spec
        }
        input.addEventListener('input', () => {
            const before = this.symbol()
            this.text = input.value
            // A new chord starts over; a space or a different spelling of the same chord doesn't.
            if (this.symbol() !== before) {
                this.voicingIndex = 0
                this.picked = null
                this.dropPickedShape()
            }
            refreshVoicings()
            refresh()
        })
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') void this.submit()
        })
        submit.addEventListener('click', () => void this.submit())
        refreshVoicings()
        refresh()
        // Scales start on the root; everything else on the name.
        if (scaleRow) scaleRow.querySelector('select')?.focus()
        else input.focus()
    }

    /** Sets the shape and its field, without drawing the form again. */
    private setShape(value: string, fromPick: boolean): void {
        this.shape = value
        this.shapeFromPick = fromPick
        if (this.shapeEl) this.shapeEl.value = value
    }

    /** Clears the shape that came with a picked voicing, once it's no longer the one used. */
    private dropPickedShape(): boolean {
        if (!this.shapeFromPick || this.voicingIndex === PICKED) return false
        this.setShape('', false)
        return true
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
