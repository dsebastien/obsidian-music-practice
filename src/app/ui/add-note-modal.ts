import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { chordTitle, safeTitle, scaleTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import { levelOf } from '../domain/mastery'
import type { LearningType } from '../domain/note-model'
import type { NewLearningNote } from '../services/note-creator.service'
import {
    detectChordFromFrets,
    detectChordFromPitches,
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
    PlayOptions,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import { lookupGuitarVoicing, voicingCount } from '@dsebastien/music-notation/voicings'
import {
    blockSource,
    chordBlock,
    withBlockLine,
    formatFrets,
    voicingRow
} from '../domain/notation-note'
import { hasBarre, shapeValue } from '../domain/voicings'
import {
    PICKING_NAMES,
    arpeggioSource,
    pickingSource,
    strumSource,
    typedPickingProperties
} from '../domain/practice-blocks'
import { triadDetail } from '../domain/triads'
import type { StringSet } from '../domain/triads'
import type { TriadPick } from './triads-modal'
import { alignGrid } from './voicing-cell'
import { readValue, textOfValue, typedKeysOf, valueOfText } from '../domain/click-input'
import { ClickInput, renderNearMatches } from './click-input'

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
    /** Strumming pattern types (#58): the pattern, time signature and feel typed. */
    private strum = { pattern: '', time: '', feel: '' }
    /** Fingerpicking pattern types (#71): the pattern, time signature and chord typed. */
    private picking = { pattern: '', time: '', chord: '' }
    private shape = ''
    private level: number | undefined
    /** Guitar chords: index of the voicing to prefill; -1 for none; PICKED for `picked`. */
    private voicingIndex = 0
    /** A voicing picked from every way to play the chord. */
    private picked: GeneratedVoicing | null = null
    /** A picked triad's string set and inversion, for its title: "(strings 1-3, root position)". */
    private triadDetail: string | null = null
    /** The picked triad's string set and inversion, for its prerequisite (the root position). */
    private triadPick: { set: StringSet; inversion: number } | null = null
    /** The shape came with the picked voicing (and goes when the chord changes). */
    private shapeFromPick = false
    /** The shape field, to update it in place. */
    private shapeEl: HTMLSelectElement | HTMLInputElement | null = null
    private formEl: HTMLElement | null = null
    /** The previews: one diagram, or a row of voicings to pick from. */
    private diagrams: RenderResult[] = []
    /** Chord types: the fretboard or keyboard whose clicks enter the frets or keys (#76). */
    private clicks: ClickInput | null = null

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
        ) => void,
        /** The chord's triads on string sets, to pick one from (#55). */
        private readonly triads?: (symbol: string, pick: (pick: TriadPick) => void) => void,
        /** The name of a triad's root-position note on a string set, when one exists. */
        private readonly triadRootNote?: (
            type: LearningType,
            chordName: string,
            set: StringSet
        ) => string | null,
        /** Settings → Playback, for the sound of each click on the fretboard or keyboard (#76). */
        private readonly play: () => PlayOptions | false = () => false
    ) {
        super(app)
        this.type = types[0]!
    }

    /** The instrument whose notation a chord or scale note of this type gets; null for others. */
    private instrument(): 'guitar' | 'piano' | null {
        if (this.type.kind !== 'chord' && this.type.kind !== 'scale' && !this.arpeggio())
            return null
        return this.type.subject === 'guitar' || this.type.subject === 'piano'
            ? this.type.subject
            : null
    }

    /** Whether this is an arpeggio type: a chord's notes, learned one shape at a time (#56). */
    private arpeggio(): boolean {
        return this.type.kind === 'arpeggio' && this.type.fields.has(this.fields.chordSymbol)
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

    /** Piano chords typed (or clicked) as keys with their octaves ("C4 E4 G4"), low to high (#76). */
    private typedKeys(): number[] | null {
        if (this.type.kind !== 'chord' || this.instrument() !== 'piano') return null
        // One token is a chord first (G7, C7): keys need two tokens or more (#76).
        return typedKeysOf(this.text.trim())
    }

    /** The keys as typed (or as the clicks wrote them, spelled by their chord): Bb3 stays Bb3. */
    private keysText(): string {
        return this.text
            .trim()
            .split(/[\s,]+/)
            .filter(Boolean)
            .join(' ')
    }

    /** The chord typed: a symbol ("Am7"), words ("A Minor 7"), or recognized from frets or keys. */
    private chord(): ParsedChord | null {
        if (this.type.kind !== 'chord' && !this.arpeggio()) return null
        const frets = this.typedFrets()
        if (frets) {
            const detected = detectChordFromFrets(frets)
            return detected ? parseChord(detected.symbol) : null
        }
        const keys = this.typedKeys()
        if (keys) {
            const detected = detectChordFromPitches(keys)
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
        return symbol &&
            this.type.kind === 'chord' &&
            this.instrument() === 'guitar' &&
            this.voicingIndex >= 0
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
        const chordLines = chordBlock(symbol, instrument, this.voicing())
        if (!chordLines) return null
        // Piano chords entered as keys: the preview draws those keys (#76).
        const block = this.typedKeys()
            ? withBlockLine(chordLines, `pitches: ${this.keysText()}`)
            : chordLines
        const probe = renderBlock('chord', blockSource(block), createDiv())
        probe.destroy()
        return probe.ok ? block : null
    }

    /** Whether this is a strumming pattern type: it stores a pattern (#58). */
    private strumFields(): boolean {
        return this.type.fields.has(this.fields.strumPattern)
    }

    /** A strumming pattern note's properties: what was typed, for the fields the type defines. */
    private strumProperties(): Record<string, string> {
        if (!this.strumFields()) return {}
        const { strumPattern, timeSignature, strumFeel } = this.fields
        const typed: [string, string][] = [
            [strumPattern, this.strum.pattern.trim()],
            [timeSignature, this.strum.time.trim()],
            [strumFeel, this.strum.feel.trim()]
        ]
        return Object.fromEntries(
            typed.filter(([name, value]) => value && this.type.fields.has(name))
        )
    }

    /** A strumming pattern note's ```strum block for the preview; only one that draws. */
    private strumPreview(): string | null {
        if (!this.strumFields()) return null
        const source = strumSource(this.strumProperties(), this.fields)
        if (!source) return null
        const probe = renderBlock('strum', source, createDiv())
        probe.destroy()
        return probe.ok ? source : null
    }

    /** Whether this is a fingerpicking pattern type: it stores a picking pattern (#71). */
    private pickingFields(): boolean {
        return !this.strumFields() && this.type.fields.has(this.fields.pickingPattern)
    }

    /** A fingerpicking pattern note's properties: what was typed, for the fields the type defines. */
    private pickingProperties(): Record<string, string> {
        if (!this.pickingFields()) return {}
        return typedPickingProperties(this.picking, this.fields, (name) =>
            this.type.fields.has(name)
        )
    }

    /** A fingerpicking pattern note's ```picking block for the preview; only one that draws. */
    private pickingPreview(): string | null {
        if (!this.pickingFields()) return null
        const source = pickingSource(this.pickingProperties(), this.fields)
        if (!source) return null
        const probe = renderBlock('picking', source, createDiv())
        probe.destroy()
        return probe.ok ? source : null
    }

    /** An arpeggio note's block for the preview, as the note will draw it; only one that draws. */
    private arpeggioPreview(): string | null {
        const language = this.language()
        const symbol = this.symbol()
        if (!this.arpeggio() || !language || !symbol) return null
        const source = arpeggioSource(
            language,
            { [this.fields.chordSymbol]: symbol, [this.fields.shape]: this.shape },
            this.fields,
            'arpeggio',
            this.instrument()
        )
        if (!source) return null
        const probe = renderBlock(language, source, createDiv())
        probe.destroy()
        return probe.ok ? source : null
    }

    /**
     * The empty block the note gets (it draws from the properties): only one that would draw, and
     * only a language Music Practice draws.
     */
    private block(): NotationLanguage | null {
        if (this.strumFields())
            return this.blocksOn('strum') && this.strumPreview() ? 'strum' : null
        if (this.pickingFields())
            return this.blocksOn('picking') && this.pickingPreview() ? 'picking' : null
        const language = this.language()
        if (!language || !this.blocksOn(language)) return null
        if (language === 'chord') return this.preview() ? language : null
        if (this.arpeggio()) return this.arpeggioPreview() ? language : null
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
        // Frets or keys the library doesn't recognize name nothing: type the chord instead.
        if ((this.typedFrets() || this.typedKeys()) && !chord) return null
        const title = safeTitle(
            chord
                ? this.triadDetail && this.voicingIndex === PICKED
                    ? `${chordTitle(chord, shape || 'Triad')} ${this.triadDetail}`
                    : chordTitle(chord, shape || undefined)
                : scale
                  ? scaleTitle(this.scaleRoot, this.scaleType, shape || undefined)
                  : shape
                    ? `${input} - ${shape}`
                    : input
        )
        if (!title) return null
        const block = this.block()
        const prerequisite = chord ? this.triadPrerequisite(chord) : null
        // Piano chords entered as keys keep them as the note's pitches (#76).
        const keys = this.typedKeys()
        const pitches =
            keys && this.type.fields.has(this.fields.pitches)
                ? { [this.fields.pitches]: this.keysText() }
                : {}
        const properties = {
            ...pitches,
            ...scale,
            ...this.strumProperties(),
            ...this.pickingProperties(),
            ...(prerequisite ? { [this.fields.prerequisites]: [`[[${prerequisite}]]`] } : {})
        }
        return {
            title,
            ...(chord ? { chordSymbol: chord.symbol } : {}),
            ...(this.shape ? { shape: this.shape } : {}),
            ...(this.level !== undefined ? { level: this.level } : {}),
            ...(this.voicing() ? { voicing: this.voicing()! } : {}),
            ...(Object.keys(properties).length ? { properties } : {}),
            ...(block ? { block } : {})
        }
    }

    /**
     * A picked triad's inversion learns after its root position on the same strings: that note,
     * when it exists, becomes the prerequisite (as the Triads command does).
     */
    private triadPrerequisite(chord: ParsedChord): string | null {
        const pick = this.triadPick
        if (!pick || pick.inversion === 0 || this.voicingIndex !== PICKED) return null
        if (!this.type.fields.has(this.fields.prerequisites)) return null
        return this.triadRootNote?.(this.type, chord.name, pick.set) ?? null
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
            this.triadDetail = null
            this.triadPick = null
            this.shapeFromPick = false
            this.scaleRoot = ''
            this.scaleType = ''
            this.strum = { pattern: '', time: '', feel: '' }
            this.picking = { pattern: '', time: '', chord: '' }
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
        const isArpeggio = this.arpeggio()
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
                      : isChord && this.instrument() === 'piano'
                        ? 'Chord (F#m7, A Major) or keys (C4 E4 G4)'
                        : isChord
                          ? 'Chord (F#m7, A Major)'
                          : isArpeggio
                            ? 'Chord of the arpeggio (Am7, A Minor 7)'
                            : 'Name'
              })
        const input = (nameField ?? createDiv()).createEl('input', {
            type: 'text',
            attr: {
                placeholder: isChord || isArpeggio ? 'Am7' : "Knockin on Heaven's Door - Simplified"
            }
        })
        input.value = this.text
        // Chords: click the frets or keys on a fretboard or keyboard (#76), with the chords that
        // hold the notes when they make none.
        this.clicks?.destroy()
        this.clicks = null
        const clickInstrument = isChord ? this.instrument() : null
        const clickHost = clickInstrument ? el.createDiv() : null
        const nearEl = clickInstrument ? el.createDiv({ cls: 'mp-click-near-box' }) : null

        // Strumming patterns: the pattern, its time signature and its feel (the type's values
        // when it lists them).
        if (this.strumFields()) {
            const strumRow = el.createDiv({ cls: 'mp-form-row' })
            const strumField = (
                label: string,
                name: string,
                key: 'pattern' | 'time' | 'feel',
                placeholder: string
            ) => {
                if (!this.type.fields.has(name)) return
                const field = strumRow.createEl('label', { cls: 'mp-field', text: label })
                const values = this.type.allowedValues[name] ?? []
                let control: HTMLSelectElement | HTMLInputElement
                if (values.length) {
                    const select = field.createEl('select', { cls: 'dropdown' })
                    select.createEl('option', { text: '—', value: '' })
                    for (const v of values)
                        select.createEl('option', { text: v, value: v }).selected =
                            v === this.strum[key]
                    control = select
                } else {
                    control = field.createEl('input', { type: 'text', attr: { placeholder } })
                    control.value = this.strum[key]
                }
                const update = () => {
                    this.strum[key] = control.value
                    refresh()
                }
                control.addEventListener('input', update)
                control.addEventListener('change', update)
                control.addEventListener('keydown', (event) => {
                    if ((event as KeyboardEvent).key === 'Enter') void this.submit()
                })
            }
            strumField('Pattern', this.fields.strumPattern, 'pattern', 'D DU UDU')
            strumField('Time signature', this.fields.timeSignature, 'time', '4/4')
            strumField('Feel', this.fields.strumFeel, 'feel', 'straight, swing, 60%')
        }

        // Fingerpicking patterns: the pattern (a named one suggested, or PIMA letters / string
        // numbers), its time signature (the type's values when it lists them) and the chord.
        if (this.pickingFields()) {
            const pickingRow = el.createDiv({ cls: 'mp-form-row' })
            const pickingField = (
                label: string,
                name: string,
                key: 'pattern' | 'time' | 'chord',
                placeholder: string,
                suggestions: readonly string[] = []
            ) => {
                if (!this.type.fields.has(name)) return
                const field = pickingRow.createEl('label', { cls: 'mp-field', text: label })
                const values = this.type.allowedValues[name] ?? []
                let control: HTMLSelectElement | HTMLInputElement
                if (values.length) {
                    const select = field.createEl('select', { cls: 'dropdown' })
                    select.createEl('option', { text: '—', value: '' })
                    for (const v of values)
                        select.createEl('option', { text: v, value: v }).selected =
                            v === this.picking[key]
                    control = select
                } else {
                    control = field.createEl('input', { type: 'text', attr: { placeholder } })
                    control.value = this.picking[key]
                    if (suggestions.length) {
                        const list = field.createEl('datalist')
                        list.id = `mp-picking-${key}-${Math.random().toString(36).slice(2)}`
                        for (const v of suggestions) list.createEl('option', { value: v })
                        control.setAttribute('list', list.id)
                    }
                }
                const update = () => {
                    this.picking[key] = control.value
                    refresh()
                }
                control.addEventListener('input', update)
                control.addEventListener('change', update)
                control.addEventListener('keydown', (event) => {
                    if ((event as KeyboardEvent).key === 'Enter') void this.submit()
                })
            }
            pickingField(
                'Pattern',
                this.fields.pickingPattern,
                'pattern',
                "Travis, or p i m a p' i m a",
                PICKING_NAMES
            )
            pickingField('Time signature', this.fields.timeSignature, 'time', '4/4')
            pickingField('Chord', this.fields.chordSymbol, 'chord', 'C')
        }

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
            isChord && this.instrument() === 'guitar'
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
                this.triadDetail = null
                this.triadPick = null
                this.voicingIndex = PICKED
                // The shape is the voicing's (one chosen before described another voicing).
                const name = this.fields.shape
                if (this.type.fields.has(name))
                    this.setShape(
                        shapeValue(
                            voicing.shape,
                            this.type.allowedValues[name] ?? [],
                            hasBarre(voicing.fingers)
                        ) ?? '',
                        true
                    )
                this.render()
            })
        })
        const triadsButton =
            voicingField && this.triads
                ? voicingField.createEl('button', { text: 'Triads…' })
                : null
        triadsButton?.addEventListener('click', (event) => {
            event.preventDefault()
            const symbol = this.symbol()
            if (!symbol) return
            this.triads?.(symbol, (pick) => {
                this.picked = pick.triad
                this.triadDetail = triadDetail(pick.set, pick.triad.inversion)
                this.triadPick = { set: pick.set, inversion: pick.triad.inversion }
                this.voicingIndex = PICKED
                // A triad note's shape is the type's "Triad".
                const name = this.fields.shape
                if (this.type.fields.has(name))
                    this.setShape(
                        shapeValue('Triad', this.type.allowedValues[name] ?? []) ?? '',
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
            alignGrid(row)
            return true
        }
        const refreshDiagram = () => {
            for (const diagram of this.diagrams) diagram.destroy()
            this.diagrams = []
            diagramEl.empty()
            const symbol = this.symbol()
            if (
                symbol &&
                isChord &&
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
            // Strumming patterns: the pattern as the note will draw it.
            const strum = this.blocksOn('strum') ? this.strumPreview() : null
            if (strum) {
                this.diagrams.push(renderBlock('strum', strum, diagramEl, options()))
                return
            }
            // Fingerpicking patterns: the pattern as the note will draw it, over its chord.
            const picking = this.blocksOn('picking') ? this.pickingPreview() : null
            if (picking) {
                this.diagrams.push(renderBlock('picking', picking, diagramEl, options()))
                return
            }
            // Arpeggios: drawn as the note will draw them (the chord's notes in its shape).
            const arpeggio = this.arpeggioPreview()
            if (arpeggio && language && this.blocksOn(language)) {
                this.diagrams.push(renderBlock(language, arpeggio, diagramEl, options()))
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
                    : isChord || isArpeggio
                      ? this.typedFrets() || this.typedKeys()
                          ? `These ${this.typedFrets() ? 'frets' : 'keys'} make no chord the library knows: type the chord instead.`
                          : 'Type a chord: its name is spelled out, the symbol becomes an alias.'
                      : isScale
                        ? 'Pick a root and a scale or mode.'
                        : ''
            )
            submit.disabled = !spec
        }
        const refreshNear = () => {
            if (!nearEl || !clickInstrument) return
            const typed = this.typedFrets() ?? this.typedKeys()
            const near =
                typed && !this.chord()
                    ? readValue(valueOfText(this.text, clickInstrument)).near
                    : []
            renderNearMatches(nearEl, near, {
                mark: (missing) => this.clicks?.showNear(missing),
                pick: (symbol) => {
                    // The chord replaces the notes clicked: the drawing shows none now.
                    input.value = symbol
                    typedText(symbol)
                    this.clicks?.set(valueOfText(symbol, clickInstrument))
                    // The list is gone with the chord: the focus goes to the field (#76).
                    input.focus()
                }
            })
        }
        const typedText = (text: string) => {
            const before = this.symbol()
            this.text = text
            // A new chord starts over; a space or a different spelling of the same chord doesn't.
            if (this.symbol() !== before) {
                this.voicingIndex = 0
                this.picked = null
                this.triadDetail = null
                this.triadPick = null
                this.dropPickedShape()
            }
            refreshVoicings()
            refresh()
            refreshNear()
        }
        input.addEventListener('input', () => {
            typedText(input.value)
            if (clickInstrument) this.clicks?.set(valueOfText(input.value, clickInstrument))
        })
        if (clickHost && clickInstrument) {
            this.clicks = new ClickInput(clickHost, {
                instrument: clickInstrument,
                layout: () => {
                    const o = this.renderOptions()
                    return {
                        hand: o.hand === 'left' ? 'left' : 'right',
                        fretboard: o.orientation?.fretboard ?? 'horizontal',
                        keyboard: o.orientation?.keyboard ?? 'horizontal',
                        naming: o.naming ?? 'letters'
                    }
                },
                play: this.play,
                value: valueOfText(this.text, clickInstrument),
                onChange: (value) => {
                    input.value = textOfValue(value)
                    typedText(input.value)
                }
            })
        }
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') void this.submit()
        })
        submit.addEventListener('click', () => void this.submit())
        refreshVoicings()
        refresh()
        refreshNear()
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
        this.clicks?.destroy()
        this.clicks = null
        for (const diagram of this.diagrams) diagram.destroy()
        this.diagrams = []
        this.contentEl.empty()
    }
}
