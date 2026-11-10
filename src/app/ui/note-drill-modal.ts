/**
 * Note, chord and scale drills (#73): pick a drill (or start from a drill note), answer its
 * questions on the drawing (the library's pick layer, with sound) or with buttons, see the score
 * and the weak-spot heat map, Save (the drill note's map and review), Log this drill.
 */
import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import {
    attachPick,
    emptyNoteSet,
    listNoteSet,
    midiOf,
    renderFretboard,
    renderGuitarDiagram,
    renderKeyboard,
    scaleNoteSet,
    chordNoteSet,
    lightPlayer,
    withNaming,
    withRootMark
} from '@dsebastien/music-notation'
import type {
    FrettedVoicing,
    Hand,
    Naming,
    Orientation,
    RootMark,
    NoteEvent,
    NotePlayer,
    PickLayer,
    PlayHandle,
    PlayOptions
} from '@dsebastien/music-notation'
import {
    afterPick,
    scalePick,
    startScale,
    type DrawnPick,
    type DrillMark,
    CHORD_FAMILIES,
    KIND_LABELS,
    drillTitle,
    isRight,
    mergeStats,
    noteName,
    questions,
    scoreOf,
    settingWords,
    weakSpots,
    type Answer,
    type DrillAsk,
    type DrillInstrument,
    type DrillKind,
    drillDefaults,
    type DrillRules,
    type DrillSetting,
    type DrillSource,
    type Question,
    type SpotStat,
    afterHear,
    spotsOf,
    isEarKind,
    isEarTraining,
    referenceOf
} from '../domain/note-drill'
import {
    CHORD_QUALITIES,
    EAR_KEYS,
    EAR_SCALES,
    INTERVALS,
    guidedItems,
    intervalName,
    intervalWords,
    nextGuidedItem,
    type ChordStyle,
    type EarQuestion,
    type EarTrainingSetting,
    type IntervalWay
} from '../domain/ear-training'
import type { DrillNote, SavedDrill } from '../services/note-drill.service'
import { choiceShown, expectedShown, noteShown, promptShown, spotShown } from '../domain/note-names'

export interface NoteDrillDeps {
    /** The vault's drill notes, to start one again. */
    notes: () => DrillNote[]
    noteFor: (setting: DrillSetting) => DrillNote | null
    statsOf: (path: string) => Map<string, SpotStat>
    pool: (setting: DrillSetting) => Promise<string[]>
    noteOf: (kind: 'chords' | 'scales', name: string, instrument: DrillInstrument) => string | null
    createNote: (
        kind: 'chords' | 'scales',
        name: string,
        instrument: DrillInstrument
    ) => Promise<string>
    /** A guitar chord's grip: its note's frets and fingers, else the library's easiest voicing. */
    grip: (symbol: string, note: string | null) => FrettedVoicing | null
    /** A piano chord's keys: its note's pitches, else the library's voicing. */
    keys: (symbol: string, note: string | null) => number[] | null
    layout: () => { hand: Hand; fretboard: Orientation; keyboard: Orientation }
    /** Settings → Notation blocks → Note names: how questions, answers and drawings name notes. */
    naming: () => Naming
    /** Settings → Notation blocks → Root marks: by color, or by color and a shape. */
    rootMark: () => RootMark
    /** Settings → Playback, for the sound of each pick; false when playback is off. */
    play: () => PlayOptions | false
    rules: () => DrillRules
    save: (setting: DrillSetting, answers: Answer[]) => Promise<SavedDrill>
    addToPanel: (path: string) => void
    log: (path: string, note: string) => void
}

/** Seconds between a drill by ear's reference note and the note to find. */
const REFERENCE_GAP = 1.5
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const STRINGS = [64, 59, 55, 50, 45, 40]
const keyName = (pitch: number) => `${noteName(pitch)}${Math.floor(pitch / 12) - 1}`

/** A phone or a small tablet held upright: keyboard drills start on one octave there. */
const NARROW = '(pointer: coarse) and (max-width: 640px)'

/** One drill: its setting, then its questions one at a time, then the score. */
export class NoteDrillModal extends Modal {
    private setting: DrillSetting
    private list: Question[] = []
    private index = 0
    private answers: Answer[] = []
    private pool: string[] = []
    private layer: PickLayer | null = null
    private started = 0
    private answered = false
    /** The note of a drill by ear that sounds; its replay, for the R key. */
    private hearing: PlayHandle | null = null
    private replay: (() => void) | null = null
    private next: (() => void) | null = null

    constructor(
        app: App,
        private readonly deps: NoteDrillDeps,
        start: DrillSetting | null = null,
        /** The kind the setup shows first, without a setting to start (Ear training: intervals). */
        kind: DrillKind = 'fretboard'
    ) {
        super(app)
        this.setting = structuredClone(start ?? drillDefaults(kind, this.narrow()))
        this.startNow = start !== null
        this.earTraining = isEarTraining(this.setting)
    }

    /** Opened for ear training: its title says so. */
    private readonly earTraining: boolean

    private readonly startNow: boolean
    /** Counts the drills started: a pool that resolves after another start, or after close, is dropped. */
    private run = 0
    private closed = false

    override onOpen(): void {
        this.setTitle(this.earTraining ? 'Ear training' : 'Drill notes, chords or scales')
        this.contentEl.addClass('mp-modal', 'mp-note-drill')
        // R plays the note of a drill by ear again.
        this.scope.register([], 'r', () => {
            if (!this.replay) return true
            this.replay()
            return false
        })
        // Enter moves on once a question is answered.
        this.scope.register([], 'Enter', (event) => {
            if (!this.next) return true
            // Enter on another button (Create note) is that button's.
            const target = event.target
            if (
                target instanceof HTMLElement &&
                target.tagName === 'BUTTON' &&
                !target.hasClass('mp-note-drill-next')
            )
                return true
            this.next()
            return false
        })
        if (this.startNow) void this.begin()
        else this.renderSetup()
    }

    override onClose(): void {
        // A drill still loading its questions stops here.
        this.run++
        this.closed = true
        this.hearing?.stop()
        this.hearing = null
        this.layer?.destroy()
        this.layer = null
        this.contentEl.empty()
    }

    // The setting -------------------------------------------------------------------------------

    private renderSetup(): void {
        this.next = null
        const el = this.contentEl
        el.empty()
        const notes = this.deps.notes()
        if (notes.length) {
            el.createEl('p', { cls: 'mp-muted', text: 'Your drills: start one again.' })
            const list = el.createDiv({ cls: 'mp-list' })
            for (const note of notes) {
                const weak = weakSpots(this.deps.statsOf(note.path), this.deps.rules()).length
                const row = list.createEl('button', { cls: 'mp-drill-pair' })
                row.createSpan({ text: drillTitle(note.setting) })
                row.createSpan({
                    cls: 'mp-muted',
                    text: weak ? `${weak} weak spots` : 'no weak spot'
                })
                row.addEventListener('click', () => {
                    this.setting = note.setting
                    void this.begin()
                })
            }
        }
        el.createEl('h4', { text: 'New drill' })
        const form = el.createDiv({ cls: 'mp-note-drill-form' })
        const kind = this.select(form, 'Kind', Object.entries(KIND_LABELS), this.setting.kind)
        kind.addEventListener('change', () => {
            this.setting = drillDefaults(kind.value as DrillKind, this.narrow())
            this.renderSetup()
        })
        const s = this.setting
        if (s.kind === 'fretboard' || s.kind === 'fretboard-ear') {
            if (s.kind === 'fretboard') this.ask(form, s)
            // Strings as six toggle buttons: a number on each, pressed or not (1 is the high E).
            const strings = form.createDiv({
                cls: 'mp-field mp-note-drill-strings mp-note-drill-row-start'
            })
            strings.createSpan({ text: 'Strings' })
            // The open strings' note, as the setting names it (Mi in solfège).
            const e = noteShown('E', this.deps.naming())
            const row = strings.createDiv({
                cls: 'mp-note-drill-string-row',
                attr: { role: 'group' }
            })
            for (let n = 1; n <= 6; n++) {
                const button = row.createEl('button', {
                    cls: 'mp-note-drill-string',
                    text: String(n),
                    attr: {
                        'aria-pressed': String(s.strings.includes(n)),
                        'aria-label': `String ${n}${n === 1 ? ` (high ${e})` : n === 6 ? ` (low ${e})` : ''}`
                    }
                })
                button.addEventListener('click', () => {
                    const set = new Set(s.strings)
                    if (set.has(n)) set.delete(n)
                    else set.add(n)
                    // At least one string.
                    if (!set.size) return
                    s.strings = [...set].sort((a, b) => a - b)
                    button.setAttr('aria-pressed', String(set.has(n)))
                })
            }
            this.number(
                form,
                'From fret',
                s.frets[0],
                0,
                24,
                (v) => (s.frets = [v, Math.max(v, s.frets[1])])
            )
            this.number(
                form,
                'To fret',
                s.frets[1],
                0,
                24,
                (v) => (s.frets = [Math.min(s.frets[0], v), v])
            )
            if (s.kind === 'fretboard-ear') this.earOptions(form, s)
        } else if (s.kind === 'keyboard' || s.kind === 'keyboard-ear') {
            if (s.kind === 'keyboard') this.ask(form, s)
            this.keyField(form, 'Lowest key', s.keys[0], (p) => (s.keys = [p, s.keys[1]])).addClass(
                'mp-note-drill-row-start'
            )
            this.keyField(form, 'Highest key', s.keys[1], (p) => (s.keys = [s.keys[0], p]))
            if (s.kind === 'keyboard-ear') this.earOptions(form, s)
        } else if (isEarTraining(s)) {
            this.earTrainingSetup(form, s)
        } else {
            this.instrument(form, s)
            const source = this.select(
                form,
                'Where from',
                [
                    ['notes', 'My notes'],
                    ['pieces', 'My pieces (chords without a note)'],
                    ['focus', 'My focus (what it needs, without a note)'],
                    ['library', 'The library']
                ].filter(([v]) => s.kind === 'chords' || v !== 'pieces'),
                s.source
            )
            source.addEventListener('change', () => (s.source = source.value as DrillSource))
            if (s.kind === 'chords') {
                const family = this.select(
                    form,
                    'Chord family',
                    [['', 'Any'], ...CHORD_FAMILIES.map((f) => [f.name, f.name])],
                    s.family ?? ''
                )
                family.addEventListener('change', () => {
                    if (family.value) s.family = family.value
                    else delete s.family
                })
            } else this.ask(form, s)
        }
        // A drill by ear plays its notes: without playback it can't run.
        const silent = isEarKind(s.kind) && !this.deps.play()
        if (silent)
            el.createEl('p', {
                cls: 'mp-muted mp-note-drill-silent',
                text: 'Drills by ear play their notes: turn on playback in the settings first.'
            })
        const actions = el.createDiv({ cls: 'mp-actions' })
        const startButton = actions.createEl('button', { cls: 'mod-cta', text: 'Start' })
        startButton.disabled = silent
        startButton.addEventListener('click', () => {
            if (
                (this.setting.kind === 'keyboard' || this.setting.kind === 'keyboard-ear') &&
                this.setting.keys[0] >= this.setting.keys[1]
            ) {
                new Notice('The lowest key must be below the highest key.')
                return
            }
            // Ear training needs at least one way (up, down, together) or style (block, arpeggio).
            const ear = this.setting
            if (
                (ear.kind === 'intervals-ear' && !ear.ways.length) ||
                (ear.kind === 'chords-ear' && !ear.styles.length)
            ) {
                new Notice(
                    ear.kind === 'chords-ear'
                        ? 'Pick how the chords sound: block, arpeggio or both.'
                        : 'Pick how the intervals sound: going up, going down or together.'
                )
                return
            }
            void this.begin()
        })
    }

    private select(
        parent: HTMLElement,
        label: string,
        options: string[][],
        value: string
    ): HTMLSelectElement {
        const field = parent.createEl('label', { cls: 'mp-field', text: label })
        const select = field.createEl('select', { cls: 'dropdown' })
        for (const [v, text] of options) select.createEl('option', { value: v!, text: text! })
        select.value = value
        return select
    }

    private number(
        parent: HTMLElement,
        label: string,
        value: number,
        min: number,
        max: number,
        set: (v: number) => void
    ): void {
        const field = parent.createEl('label', { cls: 'mp-field', text: label })
        const input = field.createEl('input', {
            type: 'number',
            attr: { min: String(min), max: String(max) }
        })
        input.value = String(value)
        input.addEventListener('change', () => {
            const v = Number(input.value)
            if (Number.isInteger(v) && v >= min && v <= max) set(v)
            else input.value = String(value)
        })
    }

    private keyField(
        parent: HTMLElement,
        label: string,
        value: number,
        set: (pitch: number) => void
    ): HTMLElement {
        const field = parent.createEl('label', { cls: 'mp-field', text: label })
        const input = field.createEl('input', { type: 'text', attr: { placeholder: 'C3' } })
        input.value = keyName(value)
        input.addEventListener('change', () => {
            const pitch = midiOf(input.value.trim())
            if (pitch !== null && pitch >= 21 && pitch <= 108) set(pitch)
            else input.value = keyName(value)
        })
        return field
    }

    /** Toggle buttons on a whole row, pressed or not; at least `min` stay pressed. */
    private toggles(
        parent: HTMLElement,
        label: string,
        options: { value: string; text: string; name?: string }[],
        chosen: string[],
        set: (values: string[]) => void,
        min: number
    ): void {
        const field = parent.createDiv({
            cls: 'mp-field mp-note-drill-strings mp-note-drill-row-start'
        })
        field.createSpan({ text: label })
        const row = field.createDiv({
            cls: 'mp-note-drill-string-row mp-note-drill-toggles',
            attr: { 'role': 'group', 'aria-label': label }
        })
        const on = new Set(chosen)
        for (const option of options) {
            const button = row.createEl('button', {
                cls: 'mp-note-drill-string',
                text: option.text,
                attr: {
                    'aria-pressed': String(on.has(option.value)),
                    ...(option.name ? { 'aria-label': option.name } : {})
                }
            })
            button.addEventListener('click', () => {
                if (on.has(option.value)) {
                    if (on.size <= min) return
                    on.delete(option.value)
                } else on.add(option.value)
                button.setAttr('aria-pressed', String(on.has(option.value)))
                set(options.map((o) => o.value).filter((v) => on.has(v)))
            })
        }
    }

    /** A check box before its words. */
    private check(
        parent: HTMLElement,
        label: string,
        value: boolean,
        set: (on: boolean) => void,
        first = false
    ): void {
        const field = parent.createEl('label', {
            cls: `mp-field mp-note-drill-check${first ? ' mp-note-drill-row-start' : ''}`
        })
        const box = field.createEl('input', { type: 'checkbox' })
        box.checked = value
        field.appendText(` ${label}`)
        box.addEventListener('change', () => set(box.checked))
    }

    /** Ear training (#72): the sound, then what to ask and how it sounds. */
    private earTrainingSetup(form: HTMLElement, s: EarTrainingSetting): void {
        const sound = this.select(
            form,
            'Sound',
            [
                ['piano', 'Piano'],
                ['guitar', 'Guitar']
            ],
            s.instrument
        )
        sound.addEventListener('change', () => (s.instrument = sound.value as DrillInstrument))
        // Several ways or styles: each question picks one of them.
        const ways = (
            values: readonly string[],
            chosen: readonly string[],
            labels: Record<string, string>,
            set: (v: string[]) => void
        ) =>
            values.forEach((v, i) =>
                this.check(
                    form,
                    labels[v]!,
                    chosen.includes(v),
                    (on) => {
                        const next = new Set(chosen)
                        if (on) next.add(v)
                        else next.delete(v)
                        chosen = values.filter((x) => next.has(x))
                        set([...chosen])
                    },
                    i === 0
                )
            )
        switch (s.kind) {
            case 'intervals-ear':
                this.toggles(
                    form,
                    'Intervals',
                    INTERVALS.map((n) => ({
                        value: String(n),
                        text: intervalName(n),
                        name: intervalWords(n)
                    })),
                    s.intervals.map(String),
                    (v) => (s.intervals = v.map(Number)),
                    2
                )
                ways(
                    ['up', 'down', 'together'],
                    s.ways,
                    { up: 'Going up', down: 'Going down', together: 'Together (harmonic)' },
                    (v) => (s.ways = v as IntervalWay[])
                )
                return
            case 'chords-ear':
                this.toggles(
                    form,
                    'Chords',
                    CHORD_QUALITIES.map((q) => ({ value: q.name, text: q.name })),
                    s.qualities,
                    (v) => (s.qualities = v),
                    2
                )
                ways(
                    ['block', 'arpeggio'],
                    s.styles,
                    { block: 'Block (all at once)', arpeggio: 'Arpeggio (one by one)' },
                    (v) => (s.styles = v as ChordStyle[])
                )
                return
            case 'scales-ear':
                this.toggles(
                    form,
                    'Scales and modes',
                    EAR_SCALES.map((x) => ({ value: x.name, text: x.name })),
                    s.scales,
                    (v) => (s.scales = v),
                    2
                )
                return
            case 'degrees-ear': {
                const naming = this.deps.naming()
                const key = this.select(
                    form,
                    'Key',
                    [['', 'Any key'], ...EAR_KEYS.map((k) => [k, `${noteShown(k, naming)} major`])],
                    s.key ?? ''
                )
                key.addEventListener('change', () => (s.key = key.value || null))
                this.check(
                    form,
                    'Chromatic degrees (b2, b3, #4, b6, b7)',
                    s.chromatic,
                    (on) => (s.chromatic = on),
                    true
                )
                return
            }
        }
    }

    /** A drill by ear's two options: the exact octave, and a reference note first. */
    private earOptions(parent: HTMLElement, s: { exact: boolean; reference: boolean }): void {
        this.check(parent, 'Exact octave', s.exact, (on) => (s.exact = on), true)
        this.check(parent, 'Reference note first', s.reference, (on) => (s.reference = on))
    }

    private ask(parent: HTMLElement, s: { ask: DrillAsk }): void {
        const select = this.select(
            parent,
            'Questions',
            [
                ['both', 'Find and name'],
                ['find', 'Find on the drawing'],
                ['name', 'Name what is shown']
            ],
            s.ask
        )
        select.addEventListener('change', () => (s.ask = select.value as DrillAsk))
    }

    private instrument(parent: HTMLElement, s: { instrument: DrillInstrument }): void {
        const select = this.select(
            parent,
            'Instrument',
            [
                ['guitar', 'Guitar'],
                ['piano', 'Piano']
            ],
            s.instrument
        )
        select.addEventListener('change', () => (s.instrument = select.value as DrillInstrument))
    }

    // The questions ------------------------------------------------------------------------------

    private async begin(): Promise<void> {
        // A drill by ear plays its notes: without playback (a drill note started again) it can't run.
        if (isEarKind(this.setting.kind) && !this.deps.play()) {
            new Notice('Drills by ear play their notes: turn on playback in the settings first.')
            this.renderSetup()
            return
        }
        const run = ++this.run
        // The drill keeps its own copy: the form can't change it while it runs.
        const setting = structuredClone(this.setting)
        this.setting = setting
        this.next = null
        this.contentEl.empty()
        this.contentEl.createDiv({ cls: 'mp-muted', text: 'Preparing the questions…' })
        const pool = await this.deps.pool(setting)
        if (run !== this.run || this.closed) return
        this.pool = pool
        const note = this.deps.noteFor(setting)
        this.list = questions(setting, {
            stats: note ? this.deps.statsOf(note.path) : new Map<string, SpotStat>(),
            rules: this.deps.rules(),
            random: Math.random,
            pool: this.pool
        })
        if (!this.list.length) {
            new Notice(
                setting.kind === 'chords' || setting.kind === 'scales'
                    ? `Nothing to ask ${settingWords(setting)}: pick another source.`
                    : 'Nothing to ask.'
            )
            this.renderSetup()
            return
        }
        // The drill counts like any practice (decision 8): its note joins the panel's list.
        if (note) this.deps.addToPanel(note.path)
        this.index = 0
        this.answers = []
        this.renderQuestion()
    }

    private renderQuestion(): void {
        const q = this.list[this.index]!
        this.layer?.destroy()
        this.layer = null
        this.hearing?.stop()
        this.hearing = null
        this.replay = null
        this.answered = false
        this.next = null
        // A drill by ear counts from when its note sounds (set again by the player's start).
        this.started = performance.now()
        const el = this.contentEl
        el.empty()
        el.createDiv({
            cls: 'mp-muted',
            text: `${drillTitle(this.setting)} · ${this.index + 1} of ${this.list.length}`
        })
        // The prompt is announced: the question changed.
        el.createDiv({
            cls: 'mp-drill-title',
            text: promptShown(q, this.deps.naming()),
            attr: { 'aria-live': 'polite' }
        })
        const drawing = el.createDiv({ cls: 'mp-notation-preview mp-note-drill-drawing' })
        const answer = el.createDiv({ cls: 'mp-note-drill-answer' })
        const feedback = el.createDiv({
            cls: 'mp-note-drill-feedback',
            attr: { 'aria-live': 'polite' }
        })
        const actions = el.createDiv({ cls: 'mp-actions' })
        // The library's drawings (string names, key labels) name notes as the setting says, and
        // mark roots as it says.
        withRootMark(this.deps.rootMark(), () =>
            withNaming(this.deps.naming(), () => this.draw(q, drawing, answer, feedback, actions))
        )
        // The focus goes to the answer: the drawing's tab stop or the first button.
        if (!this.layer) answer.querySelector('button')?.focus()
    }

    /** A narrow touch screen (a phone): see `drillDefaults`. */
    private narrow(): boolean {
        return this.contentEl.ownerDocument.defaultView?.matchMedia(NARROW).matches ?? false
    }

    private seconds(): number {
        return Math.max(0, Math.round((performance.now() - this.started) / 100) / 10)
    }

    /**
     * Plays notes on the play options' player (the light player without one). `startAt` (seconds
     * into the notes) sets when the answer time starts: from the moment the notes start sounding,
     * as the player reports it, else from the play call; null for a replay, which keeps the time.
     */
    private sound(events: NoteEvent[], sound: 'guitar' | 'piano', startAt: number | null): void {
        const play = this.deps.play()
        if (!play) return
        this.hearing?.stop()
        const win = this.contentEl.win
        const given = typeof play.player === 'function' ? play.player(win) : play.player
        const player: NotePlayer = given ?? lightPlayer(win)
        const raw: unknown = typeof play.volume === 'function' ? play.volume() : play.volume
        const volume =
            typeof raw === 'number' && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.8
        if (startAt !== null) this.started = performance.now() + startAt * 1000
        const question = this.index
        try {
            this.hearing = player.play(events, {
                sound,
                volume,
                onStart: () => {
                    if (startAt !== null && !this.answered && this.index === question)
                        this.started = performance.now() + startAt * 1000
                }
            })
        } catch {
            // A player that fails leaves the question as it is: Play again tries again.
        }
    }

    /**
     * Plays a drill by ear's note (after its reference when `lead` is a pitch), on the play options'
     * player. The first play of a question sets when the answer time starts: the moment the note
     * sounds, as the player reports it, else the play call plus the reference.
     */
    private hear(
        q: Extract<Question, { type: 'hear-fret' | 'hear-key' }>,
        lead: number | null,
        first: boolean
    ): void {
        const offset = lead === null ? 0 : REFERENCE_GAP
        const events: NoteEvent[] = [
            ...(lead === null ? [] : [{ midi: lead, time: 0, duration: 1 }]),
            { midi: q.pitch, time: offset, duration: 1.5 }
        ]
        this.sound(events, q.type === 'hear-key' ? 'piano' : 'guitar', first ? offset : null)
    }

    /** Records the answer, says right or wrong, and shows Next. */
    private finish(
        q: Question,
        right: boolean,
        feedback: HTMLElement,
        actions: HTMLElement,
        said?: string
    ): void {
        if (this.answered) return
        this.answered = true
        // What a right answer is: a note for fretboard and keyboard questions, else the spot.
        const expected = 'note' in q ? q.note : q.spot
        const naming = this.deps.naming()
        // The map keeps the note next to a fretboard spot (`s5f3 C`); a key or a chord is its spot.
        const fret = q.type === 'find-fret' || q.type === 'name-fret'
        this.answers.push({
            spot: q.spot,
            answer: fret ? expected : '',
            right,
            seconds: this.seconds()
        })
        feedback.setText(right ? 'Right.' : (said ?? `It was ${expectedShown(q, naming)}.`))
        feedback.toggleClass('mp-note-drill-right', right)
        feedback.toggleClass('mp-note-drill-wrong', !right)
        this.offerNote(q, actions)
        const go = () => {
            this.index++
            if (this.index < this.list.length) this.renderQuestion()
            else this.renderResult()
        }
        const button = actions.createEl('button', {
            cls: 'mod-cta mp-note-drill-next',
            text: this.index + 1 < this.list.length ? 'Next' : 'See the score'
        })
        button.addEventListener('click', go)
        this.next = go
        button.focus()
    }

    /** A chord or scale without a note (decision 2): Create note, through its type. */
    private offerNote(q: Question, actions: HTMLElement): void {
        const s = this.setting
        if (s.kind !== 'chords' && s.kind !== 'scales') return
        if (this.deps.noteOf(s.kind, q.spot, s.instrument)) return
        const create = actions.createEl('button', { text: 'Create note' })
        create.addEventListener('click', () => {
            create.disabled = true
            void this.deps
                .createNote(s.kind, q.spot, s.instrument)
                .then((path) => {
                    new Notice(`Created ${path.replace(/^.*\//, '').replace(/\.md$/, '')}.`)
                    create.remove()
                })
                .catch((error: unknown) => {
                    create.disabled = false
                    new Notice(error instanceof Error ? error.message : String(error))
                })
        })
    }

    /**
     * Answer buttons. Once answered, they are disabled, the one picked shows right or wrong and
     * the right one is shown (in words for screen readers: the feedback line says it too).
     */
    private answerButtons(
        parent: HTMLElement,
        cls: string,
        texts: string[],
        right: (text: string) => boolean,
        onPick: (text: string) => void,
        label: (text: string) => string,
        name?: (text: string) => string
    ): HTMLButtonElement[] {
        const row = parent.createDiv({ cls })
        // Each button shows its answer in the naming; answers are compared in letters.
        const buttons = texts.map((t) =>
            row.createEl('button', {
                text: label(t),
                ...(name ? { attr: { 'aria-label': name(t) } } : {})
            })
        )
        buttons.forEach((button, i) =>
            button.addEventListener('click', () => {
                if (this.answered) return
                onPick(texts[i]!)
                for (const [j, b] of buttons.entries()) {
                    b.disabled = true
                    if (right(texts[j]!)) b.addClass('mp-note-drill-is-right')
                    else if (j === i) b.addClass('mp-note-drill-is-wrong')
                }
            })
        )
        return buttons
    }

    /**
     * An ear training question (#72): its sound plays, Play again (R) plays it again (a degree's
     * note only), Key plays a degree's cadence and note, Show me gives the answer (a miss).
     */
    private earTrainingQuestion(
        q: EarQuestion,
        answer: HTMLElement,
        feedback: HTMLElement,
        actions: HTMLElement
    ): void {
        const s = this.setting
        const sound = isEarTraining(s) ? s.instrument : 'piano'
        const tools = answer.createDiv({ cls: 'mp-note-drill-hear' })
        const replay = () => this.sound(q.again, sound, null)
        tools
            .createEl('button', { text: 'Play again', attr: { 'aria-keyshortcuts': 'R' } })
            .addEventListener('click', replay)
        if (q.kind === 'degrees-ear')
            tools
                .createEl('button', { text: 'Key' })
                .addEventListener('click', () => this.sound(q.sound, sound, null))
        const show = tools.createEl('button', { text: 'Show me' })
        this.replay = replay
        const intervals = q.kind === 'intervals-ear'
        const buttons = this.answerButtons(
            answer,
            'mp-note-drill-choices',
            q.choices,
            (c) => c === q.answer,
            (choice) => {
                if (this.answered) return
                show.disabled = true
                this.finish(q, isRight(q, { choice }), feedback, actions)
            },
            (c) => c,
            intervals
                ? (c) => intervalWords(INTERVALS.find((n) => intervalName(n) === c) ?? 0) || c
                : undefined
        )
        show.addEventListener('click', () => {
            if (this.answered) return
            show.disabled = true
            for (const [i, b] of buttons.entries()) {
                b.disabled = true
                if (q.choices[i] === q.answer) b.addClass('mp-note-drill-is-right')
            }
            // Shown is not known: it counts as a miss, and the map brings it back sooner.
            this.finish(q, false, feedback, actions, `It was ${q.answer}.`)
            this.sound(q.sound, sound, null)
        })
        this.sound(q.sound, sound, q.last)
        buttons[0]?.focus()
    }

    private noteButtons(parent: HTMLElement, q: Question, onPick: (note: string) => void): void {
        this.answerButtons(
            parent,
            'mp-note-drill-notes',
            NOTES,
            (n) => isRight(q, { note: n }),
            onPick,
            (n) => noteShown(n, this.deps.naming())
        )
    }

    private choiceButtons(
        parent: HTMLElement,
        q: Question & { choices: string[] },
        onPick: (choice: string) => void
    ): void {
        this.answerButtons(
            parent,
            'mp-note-drill-choices',
            q.choices,
            (c) => isRight(q, { choice: c }),
            onPick,
            (c) => choiceShown(q, c, this.deps.naming())
        )
    }

    private pick(svg: SVGElement, onPick: (pick: DrawnPick) => void): void {
        const play = this.deps.play()
        this.layer = attachPick(svg, {
            ...(play ? { play } : {}),
            onPick: (p) => onPick({ string: p.string, fret: p.fret, pitch: p.pitch })
        })
    }

    private drawMarks(marks: DrillMark[]): void {
        for (const mark of marks) this.layer?.mark(mark.at, mark.result)
    }

    private draw(
        q: Question,
        drawing: HTMLElement,
        answer: HTMLElement,
        feedback: HTMLElement,
        actions: HTMLElement
    ): void {
        const doc = drawing.ownerDocument
        const layout = this.deps.layout()
        const s = this.setting
        const neck = (
            frets: [number, number],
            set = emptyNoteSet(),
            extra: { strings?: number[]; pick?: boolean } = {}
        ) =>
            renderFretboard(doc, set, {
                frets,
                hand: layout.hand,
                orientation: layout.fretboard,
                label: 'none',
                title: '',
                ...extra
            })
        const keyboard = (
            range: [number, number],
            set = emptyNoteSet(),
            extra: { pick?: boolean; playAs?: 'chord' | 'scale' } = {}
        ) =>
            renderKeyboard(doc, set, {
                range,
                orientation: layout.keyboard,
                label: 'none',
                title: '',
                ...extra
            })
        const named = (note: string) => {
            if (this.answered) return
            const right = isRight(q, { note })
            this.finish(q, right, feedback, actions)
        }
        switch (q.type) {
            case 'find-fret': {
                const frets = s.kind === 'fretboard' ? s.frets : ([0, 12] as [number, number])
                const svg = neck(frets, emptyNoteSet(), { pick: true })
                drawing.appendChild(svg)
                this.pick(svg, (pick) => {
                    if (this.answered) return
                    const outcome = afterPick(q, pick, frets)
                    this.drawMarks(outcome.marks)
                    this.finish(q, outcome.right, feedback, actions)
                })
                // The focus starts on the asked string, at the range's first fret.
                if (!this.layer?.focus({ string: q.string, fret: frets[0] })) this.layer?.focus()
                return
            }
            case 'name-fret': {
                const frets = s.kind === 'fretboard' ? s.frets : ([0, 12] as [number, number])
                drawing.appendChild(
                    neck(frets, listNoteSet(keyName(q.pitch))!, { strings: [6 - q.string] })
                )
                this.noteButtons(answer, q, named)
                return
            }
            case 'find-key': {
                const range = s.kind === 'keyboard' ? s.keys : ([48, 71] as [number, number])
                const svg = keyboard(range, emptyNoteSet(), { pick: true })
                drawing.appendChild(svg)
                this.pick(svg, (pick) => {
                    if (this.answered) return
                    const outcome = afterPick(q, pick, [0, 0])
                    this.drawMarks(outcome.marks)
                    this.finish(q, outcome.right, feedback, actions)
                })
                this.layer?.focus()
                return
            }
            case 'hear-fret':
            case 'hear-key': {
                // A note sounds; any place that plays it (any octave, or the same pitch) is right.
                const area:
                    { strings: number[]; frets: [number, number] } | { keys: [number, number] } =
                    s.kind === 'fretboard-ear'
                        ? { strings: s.strings, frets: s.frets }
                        : s.kind === 'keyboard-ear'
                          ? { keys: s.keys }
                          : q.type === 'hear-key'
                            ? { keys: [48, 71] as [number, number] }
                            : { strings: [1, 2, 3, 4, 5, 6], frets: [0, 12] as [number, number] }
                const svg =
                    'keys' in area
                        ? keyboard(area.keys, emptyNoteSet(), { pick: true })
                        : neck(area.frets, emptyNoteSet(), { pick: true })
                drawing.appendChild(svg)
                this.pick(svg, (pick) => {
                    if (this.answered) return
                    const outcome = afterHear(q, pick, area)
                    this.drawMarks(outcome.marks)
                    this.finish(q, outcome.right, feedback, actions)
                })
                const replay = () => this.hear(q, null, false)
                const reference =
                    s.kind === 'fretboard-ear' || s.kind === 'keyboard-ear' ? referenceOf(s) : null
                const buttons = answer.createDiv({ cls: 'mp-note-drill-hear' })
                buttons
                    .createEl('button', { text: 'Play again', attr: { 'aria-keyshortcuts': 'R' } })
                    .addEventListener('click', replay)
                if (reference !== null)
                    buttons
                        .createEl('button', { text: 'Reference' })
                        .addEventListener('click', () => this.hear(q, reference, false))
                this.replay = replay
                this.hear(q, q.reference, true)
                this.layer?.focus()
                return
            }
            case 'hear-name':
                this.earTrainingQuestion(q, answer, feedback, actions)
                return
            case 'name-key': {
                const range = s.kind === 'keyboard' ? s.keys : ([48, 71] as [number, number])
                drawing.appendChild(keyboard(range, listNoteSet(keyName(q.pitch))!))
                this.noteButtons(answer, q, named)
                return
            }
            case 'name-chord': {
                const instrument = s.kind === 'chords' ? s.instrument : 'guitar'
                const note = this.deps.noteOf('chords', q.spot, instrument)
                if (instrument === 'guitar') {
                    const grip = this.deps.grip(q.spot, note)
                    if (grip)
                        drawing.appendChild(
                            renderGuitarDiagram(doc, grip, { title: '', hand: layout.hand })
                        )
                } else {
                    const keys = this.deps.keys(q.spot, note)
                    const set = keys?.length
                        ? listNoteSet(keys.map(keyName).join(' '))
                        : chordNoteSet(q.spot)
                    if (set) {
                        const low = keys?.length ? Math.min(...keys) : 60
                        const high = keys?.length ? Math.max(...keys) : 72
                        drawing.appendChild(
                            keyboard([low - (low % 12), high + 11 - (high % 12)], set, {
                                playAs: 'chord'
                            })
                        )
                    }
                }
                this.choiceButtons(answer, q, (choice) => {
                    if (!this.answered) this.finish(q, isRight(q, { choice }), feedback, actions)
                })
                return
            }
            case 'name-scale': {
                const instrument = s.kind === 'scales' ? s.instrument : 'guitar'
                const set = scaleNoteSet(q.spot)
                if (set)
                    drawing.appendChild(
                        instrument === 'guitar'
                            ? neck([0, 12], set)
                            : renderKeyboard(doc, set, {
                                  orientation: layout.keyboard,
                                  label: 'none',
                                  title: ''
                              })
                    )
                this.choiceButtons(answer, q, (choice) => {
                    if (!this.answered) this.finish(q, isRight(q, { choice }), feedback, actions)
                })
                return
            }
            case 'find-scale': {
                const instrument = s.kind === 'scales' ? s.instrument : 'guitar'
                const svg =
                    instrument === 'guitar'
                        ? neck([0, 12], emptyNoteSet(), { pick: true })
                        : keyboard([48, 71], emptyNoteSet(), { pick: true })
                drawing.appendChild(svg)
                const left = answer.createDiv({ cls: 'mp-muted' })
                let state = startScale()
                const show = () =>
                    left.setText(
                        `${state.found.length} of ${q.classes.length} notes found${state.misses ? `, ${state.misses} wrong` : ''}`
                    )
                show()
                this.pick(svg, (pick) => {
                    if (this.answered) return
                    const outcome = scalePick(q, state, pick)
                    state = outcome.state
                    this.drawMarks(outcome.marks)
                    show()
                    if (outcome.done)
                        this.finish(
                            q,
                            outcome.right,
                            feedback,
                            actions,
                            state.misses ? `All found, with ${state.misses} wrong.` : undefined
                        )
                })
                answer
                    .createEl('button', { text: 'Show the notes' })
                    .addEventListener('click', () => {
                        if (this.answered) return
                        const missing = q.classes
                            .filter((c) => !state.found.includes(c))
                            .map((c) => noteShown(NOTES[c]!, this.deps.naming()))
                        this.finish(q, false, feedback, actions, `Missing: ${missing.join(' ')}.`)
                    })
                this.layer?.focus()
                return
            }
        }
    }

    // The score ----------------------------------------------------------------------------------

    private renderResult(): void {
        this.layer?.destroy()
        this.layer = null
        this.next = null
        const el = this.contentEl
        el.empty()
        const score = scoreOf(this.answers)
        el.createDiv({ cls: 'mp-drill-title', text: `${score.right} of ${score.total} right` })
        if (score.right)
            el.createDiv({
                cls: 'mp-muted',
                text: `${score.seconds.toFixed(1)} s on average for a right answer`
            })
        const note = this.deps.noteFor(this.setting)
        const before = note ? this.deps.statsOf(note.path) : new Map<string, SpotStat>()
        const after = mergeStats(before, this.answers, this.deps.rules())
        this.heatMap(el.createDiv({ cls: 'mp-note-drill-map' }), after)
        // Guided ear training: what the next drill adds, or what comes once these are known.
        const rules = this.deps.rules()
        const s = this.setting
        if (isEarTraining(s) && rules.guided !== false) {
            const now = guidedItems(s, before, rules.clearStreak).length
            const next = guidedItems(s, after, rules.clearStreak)
            const coming = nextGuidedItem(s, after, rules.clearStreak)
            const text =
                next.length > now
                    ? `Save it, and the next drill adds ${next.at(-1)}.`
                    : coming
                      ? `Next to come: ${coming}, once you know these.`
                      : null
            if (text) el.createDiv({ cls: 'mp-muted', text })
        }
        const actions = el.createDiv({ cls: 'mp-actions' })
        const save = actions.createEl('button', { cls: 'mod-cta', text: 'Save' })
        actions
            .createEl('button', { text: 'Again' })
            .addEventListener('click', () => void this.begin())
        actions
            .createEl('button', { text: 'Another drill' })
            .addEventListener('click', () => this.renderSetup())
        save.addEventListener('click', () => {
            save.disabled = true
            void this.deps
                .save(this.setting, this.answers)
                .then((saved) => {
                    new Notice(
                        `Saved: ${saved.score.right} of ${saved.score.total} right (review: ${saved.review}).`
                    )
                    this.deps.addToPanel(saved.path)
                    save.remove()
                    const log = actions.createEl('button', {
                        cls: 'mod-cta',
                        text: 'Log this drill'
                    })
                    log.addEventListener('click', () => {
                        this.close()
                        this.deps.log(
                            saved.path,
                            `${drillTitle(this.setting)}: ${saved.score.right} of ${saved.score.total} right`
                        )
                    })
                    actions.prepend(log)
                    log.focus()
                })
                .catch((error: unknown) => {
                    save.disabled = false
                    new Notice(error instanceof Error ? error.message : String(error))
                })
        })
        save.focus()
    }

    /** The weak-spot map as a heat map: each spot colored by its right answers, slow ones marked. */
    private heatMap(el: HTMLElement, stats: Map<string, SpotStat>): void {
        const rules = this.deps.rules()
        const naming = this.deps.naming()
        // Each cell says its numbers in text, not only in color (orange to blue, color-blind safe).
        const cell = (parent: HTMLElement, text: string, stat: SpotStat | undefined) => {
            const c = parent.createDiv({ cls: 'mp-note-drill-cell', attr: { role: 'listitem' } })
            c.createDiv({ text })
            if (!stat) {
                c.addClass('mp-note-drill-unasked')
                c.setAttr('aria-label', `${text}: not asked yet`)
                return c
            }
            const slow = stat.seconds >= rules.fastSeconds
            c.createDiv({ cls: 'mp-note-drill-count', text: `${stat.right}/${stat.asked}` })
            c.setCssProps({ '--mp-share': String(stat.right / stat.asked) })
            c.toggleClass('mp-note-drill-slow', slow)
            c.setAttr(
                'aria-label',
                `${text}: ${stat.right} of ${stat.asked} right, ${stat.seconds.toFixed(1)} s${slow ? ', slow' : ''}`
            )
            return c
        }
        const s = this.setting
        if (s.kind === 'fretboard') {
            const grid = el.createDiv({ cls: 'mp-note-drill-grid', attr: { role: 'list' } })
            grid.setCssProps({ '--mp-columns': String(s.frets[1] - s.frets[0] + 2) })
            grid.createDiv()
            for (let f = s.frets[0]; f <= s.frets[1]; f++)
                grid.createDiv({ cls: 'mp-muted', text: String(f) })
            for (const n of s.strings) {
                grid.createDiv({ cls: 'mp-muted', text: `S${n}` })
                for (let f = s.frets[0]; f <= s.frets[1]; f++)
                    cell(
                        grid,
                        noteShown(noteName(STRINGS[n - 1]! + f), naming),
                        stats.get(`s${n}f${f}`)
                    )
            }
            return
        }
        if (s.kind === 'keyboard') {
            const row = el.createDiv({ cls: 'mp-note-drill-keys', attr: { role: 'list' } })
            for (let p = s.keys[0]; p <= s.keys[1]; p++)
                cell(row, noteShown(keyName(p), naming), stats.get(keyName(p)))
            return
        }
        if (isEarKind(s.kind)) {
            // By ear: each pitch of the range, low to high, as the keys of a keyboard drill.
            const row = el.createDiv({ cls: 'mp-note-drill-keys', attr: { role: 'list' } })
            for (const spot of spotsOf(s)) cell(row, noteShown(spot, naming), stats.get(spot))
            return
        }
        const list = el.createDiv({ cls: 'mp-note-drill-list', attr: { role: 'list' } })
        const asked = [...stats.values()].sort(
            (a, b) => a.right / a.asked - b.right / b.asked || b.seconds - a.seconds
        )
        for (const stat of asked) cell(list, spotShown(s.kind, stat.spot, naming), stat)
    }
}
