import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import type { LogItem, LogRequest } from '../domain/log'
import { levelOf } from '../domain/mastery'
import type { LearningType, NoteModel, SessionType } from '../domain/note-model'
import { isDueForReview, practiceNext } from '../domain/practice'
import type { LearningItem } from '../domain/practice'
import type { ReviewResult } from '../domain/review'
import type { PracticeRules } from '../domain/rules'
import { rubricFor } from '../domain/rubric'
import type { RubricSettings } from '../domain/rubric'
import { clockTime, minutesBetween } from '../domain/timer'
import { linkTo, renderBadge, renderMeta } from './item-row'

export interface LogPracticePreset {
    minutes?: number
    /** YYYY-MM-DD, from the practice timer (its start day). */
    date?: string
    /** HH:MM, from the practice timer. */
    startTime?: string
    paths?: string[]
    /** BPMs reached, by path (the practice panel's nudges). */
    bpms?: Record<string, number>
    /** The session's note (a chord change drill's result). */
    note?: string
    /** Called after a successful log (the practice timer clears itself). */
    onLogged?: () => void
}

/** A Kanban Action Planner timer running on the activity of the current selection. */
export interface RunningTimer {
    startedAt: number
    activityName: string
}

export interface LogPracticeDeps {
    model: NoteModel
    items: LearningItem[]
    rules: PracticeRules
    fields: FieldNames
    rubric: RubricSettings
    /** Session types the selection can go to (throws when it spans several instruments). */
    sessionTypesFor: (items: LearningItem[]) => SessionType[]
    timerFor: (items: LearningItem[], sessionTypeId?: string) => RunningTimer | null
    submit: (request: LogRequest, adoptTimer: boolean) => Promise<string>
    onClosed: () => void
}

const REVIEW_BUTTONS: { result: ReviewResult; label: string }[] = [
    { result: 'good', label: 'Good' },
    { result: 'shaky', label: 'Shaky' },
    { result: 'failed', label: 'Failed' }
]

/** Log a practice session in under a minute. */
export class LogPracticeModal extends Modal {
    private minutes: number
    private date: string
    private focus = ''
    private note = ''
    private quality = ''
    private sessionTypeId = ''
    private adoptTimer = false
    private submitting = false
    private query = ''
    private readonly selected = new Map<string, LogItem>()
    private listEl: HTMLElement | null = null
    private sessionEl: HTMLElement | null = null
    private minutesInput: HTMLInputElement | null = null
    private submitEl: HTMLButtonElement | null = null

    constructor(
        app: App,
        private readonly deps: LogPracticeDeps,
        private readonly preset: LogPracticePreset = {}
    ) {
        super(app)
        this.minutes = preset.minutes ?? 0
        this.note = preset.note ?? ''
        this.date = preset.date ?? isoDate()
        // Planned items of several instruments: keep the first instrument's (one log, one session).
        let subject: string | null = null
        for (const path of preset.paths ?? []) {
            const item = deps.items.find((i) => i.path === path)
            // Not (or no longer) a learning note: it can't be logged.
            if (!item) continue
            const itemSubject = item ? (this.typeOf(item)?.subject ?? null) : null
            if (itemSubject && subject && itemSubject !== subject) continue
            subject ??= itemSubject
            const bpm = preset.bpms?.[path]
            this.selected.set(path, bpm !== undefined ? { path, bpm } : { path })
        }
    }

    private typeOf(item: LearningItem): LearningType | undefined {
        return this.deps.model.learningTypes.find((t) => t.id === item.typeId)
    }

    private selectedItems(): LearningItem[] {
        return this.deps.items.filter((i) => this.selected.has(i.path))
    }

    /** The subject of the selection; items of another subject can't join it. */
    private selectedSubject(): string | null {
        for (const item of this.selectedItems()) {
            const subject = this.typeOf(item)?.subject
            if (subject) return subject
        }
        return null
    }

    private sessionChoices(): SessionType[] {
        try {
            return this.deps.sessionTypesFor(this.selectedItems())
        } catch {
            return []
        }
    }

    override onOpen(): void {
        this.setTitle('Log practice')
        const { contentEl } = this
        contentEl.addClass('mp-modal')

        const row = contentEl.createDiv({ cls: 'mp-form-row' })
        this.minutesInput = this.field(
            row,
            'Minutes',
            'number',
            this.minutes ? String(this.minutes) : '',
            (v) => {
                const n = Number(v)
                this.minutes = Number.isFinite(n) ? Math.round(n) : 0
            }
        )
        this.minutesInput.min = '1'
        this.minutesInput.max = '1440'
        this.field(row, 'Date', 'date', this.date, (v) => (this.date = v || isoDate()))
        this.field(row, 'Focus (optional)', 'text', '', (v) => (this.focus = v), 'Barre chords')

        this.sessionEl = contentEl.createDiv({ cls: 'mp-modal' })

        contentEl.createDiv({ cls: 'mp-section-title', text: 'What did you practice?' })
        const search = contentEl.createEl('input', {
            cls: 'mp-search',
            type: 'search',
            attr: { 'placeholder': 'Filter items…', 'aria-label': 'Filter items' }
        })
        search.addEventListener('input', () => {
            this.query = search.value.trim().toLowerCase()
            this.renderList()
        })
        this.listEl = contentEl.createDiv({ cls: 'mp-pick-list' })

        const noteField = contentEl.createEl('label', { cls: 'mp-field', text: 'Note (optional)' })
        const note = noteField.createEl('textarea', { attr: { rows: '2' } })
        note.value = this.note
        note.addEventListener('input', () => (this.note = note.value))

        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        this.submitEl = actions.createEl('button', { cls: 'mod-cta', text: 'Log practice' })
        this.submitEl.addEventListener('click', () => void this.submit())

        this.renderList()
    }

    /** Selected first, then due items, then the practice ranking, then everything else. */
    private ordered(): LearningItem[] {
        const ranked = practiceNext(this.deps.items, this.deps.rules)
        const rank = new Map(ranked.map((i, n) => [i.path, n]))
        const key = (i: LearningItem) =>
            (this.selected.has(i.path) ? 0 : isDueForReview(i) ? 1 : rank.has(i.path) ? 2 : 3) *
                10_000 +
            (rank.get(i.path) ?? 9_999)
        return [...this.deps.items].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name))
    }

    private renderList(): void {
        const el = this.listEl
        if (!el) return
        el.empty()
        const subject = this.selectedSubject()
        const visible = this.ordered().filter(
            (i) =>
                this.selected.has(i.path) ||
                !this.query ||
                i.name.toLowerCase().includes(this.query)
        )
        if (visible.length === 0)
            el.createDiv({ cls: 'mp-empty', text: 'No learning note matches.' })
        for (const item of visible.slice(0, 50)) {
            const type = this.typeOf(item)
            const other = Boolean(subject && type?.subject && type.subject !== subject)
            const isOn = this.selected.has(item.path)
            const card = el.createDiv({ cls: `mp-item${isOn ? ' mp-is-selected' : ''}` })
            if (other) {
                card.addClass('mp-is-dimmed')
                card.title = 'Another instrument: log it in its own session.'
            }
            const head = card.createDiv({ cls: 'mp-item-head' })
            const box = head.createEl('input', {
                type: 'checkbox',
                attr: { 'aria-label': `Practiced ${item.name}` }
            })
            box.checked = isOn
            box.disabled = other && !isOn
            const name = head.createEl('a', { cls: 'mp-item-name internal-link', text: item.name })
            linkTo(this.app, name, item)
            renderBadge(head, this.deps.model, item)
            box.addEventListener('change', () => {
                if (box.checked) this.selected.set(item.path, { path: item.path })
                else this.selected.delete(item.path)
                this.renderList()
            })
            if (isOn && type) this.renderDetails(card, item, type)
            else renderMeta(card, item)
        }
        this.renderSession()
        this.refreshSubmit()
    }

    /** Session choice (instrument-less items), quality, and the running timer of the activity. */
    private renderSession(): void {
        const el = this.sessionEl
        if (!el) return
        el.empty()
        const items = this.selectedItems()
        const choices = items.length ? this.sessionChoices() : []
        if (!choices.some((s) => s.id === this.sessionTypeId))
            this.sessionTypeId = choices.length === 1 ? choices[0]!.id : ''
        if (choices.length > 1 && !this.selectedSubject()) {
            const field = el.createEl('label', { cls: 'mp-field', text: 'Session for' })
            const select = field.createEl('select', { cls: 'dropdown' })
            select.createEl('option', { text: 'Choose…', value: '' })
            for (const s of choices)
                select.createEl('option', { text: s.name, value: s.id }).selected =
                    s.id === this.sessionTypeId
            select.addEventListener('change', () => {
                this.sessionTypeId = select.value
                this.renderSession()
                this.refreshSubmit()
            })
        }
        const session = choices.find((s) => s.id === this.sessionTypeId)
        const qualities = session?.allowedValues[this.deps.fields.quality] ?? []
        if (qualities.length) {
            const field = el.createEl('label', { cls: 'mp-field', text: 'Session quality' })
            const select = field.createEl('select', { cls: 'dropdown' })
            select.createEl('option', { text: '—', value: '' })
            for (const v of qualities)
                select.createEl('option', { text: v, value: v }).selected = v === this.quality
            select.addEventListener('change', () => (this.quality = select.value))
        }
        const timer = items.length
            ? this.deps.timerFor(items, this.sessionTypeId || undefined)
            : null
        if (!timer) {
            this.adoptTimer = false
            return
        }
        // Offered only for a timer on this log's activity; its minutes show in the Minutes field.
        const label = el.createEl('label', { cls: 'mp-field' })
        const box = label.createEl('input', { type: 'checkbox' })
        box.checked = this.adoptTimer
        label.appendText(
            ` Use the Kanban Action Planner timer running on ${timer.activityName} since ${clockTime(timer.startedAt)} (required: it times this activity)`
        )
        box.addEventListener('change', () => {
            this.adoptTimer = box.checked
            if (this.adoptTimer && this.minutesInput) {
                this.minutes = Math.min(minutesBetween(timer.startedAt, Date.now()), 1440)
                this.minutesInput.value = String(this.minutes)
            }
        })
    }

    /** Mastery (with the rubric), BPM where a target exists, and a review result for items in review. */
    private renderDetails(card: HTMLElement, item: LearningItem, type: LearningType): void {
        const log = this.selected.get(item.path)!
        const details = card.createDiv({ cls: 'mp-item-details' })

        const mastery = details.createEl('select', {
            cls: 'dropdown',
            attr: { 'aria-label': `Mastery of ${item.name}` }
        })
        for (const value of type.statusValues) {
            const option = mastery.createEl('option', { text: value, value })
            option.selected = levelOf(value) === (log.level ?? item.level)
        }
        const rubric = card.createDiv({ cls: 'mp-rubric' })
        const showRubric = () => {
            const level = log.level ?? item.level
            const text =
                level !== null
                    ? rubricFor(type.kind, this.deps.rubric, this.deps.rules)[level]
                    : undefined
            rubric.setText(text ? `${text}.` : '')
        }
        mastery.addEventListener('change', () => {
            const level = levelOf(mastery.value)
            if (level === null || level === item.level) delete log.level
            else log.level = level
            showRubric()
        })
        showRubric()

        if (item.bpmTarget !== null) {
            const bpm = details.createEl('input', {
                cls: 'mp-bpm-input',
                type: 'number',
                attr: {
                    'placeholder': `BPM (target ${item.bpmTarget})`,
                    'aria-label': `BPM reached on ${item.name}`,
                    'min': '1',
                    'max': '1000'
                }
            })
            if (log.bpm !== undefined) bpm.value = String(log.bpm)
            bpm.addEventListener('input', () => {
                const n = Number(bpm.value)
                if (bpm.value && Number.isInteger(n) && n > 0) log.bpm = n
                else delete log.bpm
                // Reaching the target offers "at tempo" (visible in the mastery list, changeable).
                const tempo = this.deps.rules.levels.tempo
                if (
                    log.bpm !== undefined &&
                    log.bpm >= item.bpmTarget! &&
                    (item.level ?? 0) < tempo
                ) {
                    log.level = tempo
                    mastery.value =
                        type.statusValues.find((v) => levelOf(v) === tempo) ?? mastery.value
                    showRubric()
                }
            })
        }

        if (item.review !== null) {
            const group = details.createDiv({
                cls: 'mp-segmented',
                attr: { 'role': 'group', 'aria-label': 'Review result' }
            })
            const buttons: HTMLButtonElement[] = []
            for (const { result, label } of REVIEW_BUTTONS) {
                const button = group.createEl('button', {
                    text: label,
                    attr: { 'aria-pressed': String(log.review === result) }
                })
                if (log.review === result) button.addClass('mp-is-on')
                buttons.push(button)
                button.addEventListener('click', () => {
                    if (log.review === result) delete log.review
                    else log.review = result
                    buttons.forEach((b, i) => {
                        const on = log.review === REVIEW_BUTTONS[i]!.result
                        b.toggleClass('mp-is-on', on)
                        b.setAttr('aria-pressed', String(on))
                    })
                })
            }
        }
    }

    private refreshSubmit(): void {
        if (!this.submitEl) return
        const needsSession =
            this.sessionChoices().length > 1 && !this.selectedSubject() && !this.sessionTypeId
        this.submitEl.disabled = this.submitting || this.selected.size === 0 || needsSession
    }

    private async submit(): Promise<void> {
        if (this.submitting || this.selected.size === 0) return
        if (!(this.minutes > 0)) {
            new Notice('Enter the minutes practiced.')
            return
        }
        this.submitting = true
        this.refreshSubmit()
        try {
            const session = await this.deps.submit(
                {
                    date: this.date,
                    minutes: this.minutes,
                    ...(this.preset.startTime && !this.adoptTimer
                        ? { startTime: this.preset.startTime }
                        : {}),
                    ...(this.focus ? { focus: this.focus } : {}),
                    ...(this.quality ? { quality: this.quality } : {}),
                    ...(this.note.trim() ? { note: this.note.trim() } : {}),
                    ...(this.sessionTypeId ? { sessionTypeId: this.sessionTypeId } : {}),
                    items: [...this.selected.values()]
                },
                this.adoptTimer
            )
            new Notice(`Logged ${this.minutes} min: ${session}`)
            this.preset.onLogged?.()
            this.close()
        } catch (error: unknown) {
            new Notice(error instanceof Error ? error.message : String(error))
            this.submitting = false
            this.refreshSubmit()
        }
    }

    private field(
        parent: HTMLElement,
        label: string,
        type: string,
        value: string,
        set: (v: string) => void,
        placeholder = ''
    ): HTMLInputElement {
        const field = parent.createEl('label', { cls: 'mp-field', text: label })
        const input = field.createEl('input', { type, attr: { placeholder } })
        input.value = value
        input.addEventListener('input', () => set(input.value.trim()))
        return input
    }

    override onClose(): void {
        this.contentEl.empty()
        this.deps.onClosed()
    }
}
