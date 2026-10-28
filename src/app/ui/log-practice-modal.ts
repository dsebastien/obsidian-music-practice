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
import { linkTo, renderBadge, renderMeta } from './item-row'

export interface LogPracticePreset {
    minutes?: number
    /** HH:MM, from the practice timer. */
    startTime?: string
    /** Called after a successful log (the practice timer clears itself). */
    onLogged?: () => void
    paths?: string[]
    /** A running Kanban Action Planner timer that can be adopted. */
    timer?: { startedAt: number; activityName: string } | null
}

export interface LogPracticeDeps {
    model: NoteModel
    items: LearningItem[]
    rules: PracticeRules
    fields: FieldNames
    rubric: RubricSettings
    sessionTypeFor: (items: LearningItem[]) => SessionType | null
    submit: (request: LogRequest, adoptTimer: boolean) => Promise<string>
}

const REVIEW_BUTTONS: { result: ReviewResult; label: string }[] = [
    { result: 'good', label: 'Good' },
    { result: 'shaky', label: 'Shaky' },
    { result: 'failed', label: 'Failed' }
]

/** Log a practice session in under a minute. */
export class LogPracticeModal extends Modal {
    private minutes: number
    private date = isoDate()
    private focus = ''
    private note = ''
    private quality = ''
    private adoptTimer: boolean
    private query = ''
    private readonly selected = new Map<string, LogItem>()
    private listEl: HTMLElement | null = null
    private qualityEl: HTMLElement | null = null
    private submitEl: HTMLButtonElement | null = null

    constructor(
        app: App,
        private readonly deps: LogPracticeDeps,
        private readonly preset: LogPracticePreset = {}
    ) {
        super(app)
        this.minutes = preset.minutes ?? 0
        this.adoptTimer = Boolean(preset.timer)
        for (const path of preset.paths ?? []) this.selected.set(path, { path })
    }

    private typeOf(item: LearningItem): LearningType | undefined {
        return this.deps.model.learningTypes.find((t) => t.id === item.typeId)
    }

    /** The subject of the selection; items of another subject can't join it. */
    private selectedSubject(): string | null {
        for (const path of this.selected.keys()) {
            const item = this.deps.items.find((i) => i.path === path)
            const subject = item ? this.typeOf(item)?.subject : null
            if (subject) return subject
        }
        return null
    }

    private session(): SessionType | null {
        return this.deps.sessionTypeFor(this.deps.items.filter((i) => this.selected.has(i.path)))
    }

    override onOpen(): void {
        this.setTitle('Log practice')
        const { contentEl } = this
        contentEl.addClass('mp-modal')

        const row = contentEl.createDiv({ cls: 'mp-form-row' })
        this.numberField(row, 'Minutes', this.minutes || '', (v) => (this.minutes = v))
        this.textField(row, 'Date', this.date, 'date', (v) => (this.date = v || isoDate()))
        this.textField(row, 'Focus (optional)', '', 'text', (v) => (this.focus = v), 'Barre chords')

        if (this.preset.timer) {
            const label = contentEl.createEl('label', { cls: 'mp-field' })
            const box = label.createEl('input', { type: 'checkbox' })
            box.checked = this.adoptTimer
            box.addEventListener('change', () => (this.adoptTimer = box.checked))
            const started = new Date(this.preset.timer.startedAt)
            label.appendText(
                ` Use the running timer on ${this.preset.timer.activityName} (started ${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')})`
            )
        }

        contentEl.createEl('h4', { cls: 'mp-section-title', text: 'What did you practice?' })
        const search = contentEl.createEl('input', {
            cls: 'mp-search',
            type: 'search',
            attr: { placeholder: 'Filter items…' }
        })
        search.addEventListener('input', () => {
            this.query = search.value.trim().toLowerCase()
            this.renderList()
        })
        this.listEl = contentEl.createDiv({ cls: 'mp-pick-list' })

        this.qualityEl = contentEl.createDiv()
        const noteField = contentEl.createEl('label', { cls: 'mp-field', text: 'Note (optional)' })
        const note = noteField.createEl('textarea', { attr: { rows: '2' } })
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
        if (visible.length === 0) {
            el.createDiv({ cls: 'mp-empty', text: 'No learning note matches.' })
        }
        for (const item of visible.slice(0, 50)) {
            const type = this.typeOf(item)
            const other = subject !== null && type?.subject && type.subject !== subject
            const isOn = this.selected.has(item.path)
            const card = el.createDiv({ cls: `mp-item${isOn ? ' mp-is-selected' : ''}` })
            if (other) {
                card.addClass('mp-is-dimmed')
                card.title = 'Another instrument: log it in its own session.'
            }
            const head = card.createDiv({ cls: 'mp-item-head' })
            const box = head.createEl('input', { type: 'checkbox' })
            box.checked = isOn
            box.disabled = Boolean(other) && !isOn
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
        this.renderQuality()
        if (this.submitEl) this.submitEl.disabled = this.selected.size === 0
    }

    /** Mastery (with the rubric), BPM where a target exists, and a review result for items in review. */
    private renderDetails(card: HTMLElement, item: LearningItem, type: LearningType): void {
        const log = this.selected.get(item.path)!
        const details = card.createDiv({ cls: 'mp-item-details' })

        const mastery = details.createEl('select', { cls: 'dropdown' })
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
                type: 'number',
                attr: { placeholder: `BPM (target ${item.bpmTarget})`, min: '20', max: '400' }
            })
            bpm.addClass('mp-bpm-input')
            if (log.bpm !== undefined) bpm.value = String(log.bpm)
            bpm.addEventListener('input', () => {
                const n = Number(bpm.value)
                if (bpm.value && Number.isFinite(n) && n > 0) log.bpm = Math.round(n)
                else delete log.bpm
                // Reaching the target offers "at tempo".
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
                attr: { title: 'Review result' }
            })
            for (const { result, label } of REVIEW_BUTTONS) {
                const button = group.createEl('button', { text: label })
                if (log.review === result) button.addClass('mp-is-on')
                button.addEventListener('click', () => {
                    if (log.review === result) delete log.review
                    else log.review = result
                    group.querySelectorAll('button').forEach((b) => b.removeClass('mp-is-on'))
                    if (log.review) button.addClass('mp-is-on')
                })
            }
        }
    }

    private renderQuality(): void {
        const el = this.qualityEl
        if (!el) return
        el.empty()
        const values = this.session()?.allowedValues[this.deps.fields.quality] ?? []
        if (values.length === 0) return
        const field = el.createEl('label', { cls: 'mp-field', text: 'Session quality' })
        const select = field.createEl('select', { cls: 'dropdown' })
        select.createEl('option', { text: '—', value: '' })
        for (const value of values) {
            const option = select.createEl('option', { text: value, value })
            option.selected = value === this.quality
        }
        select.addEventListener('change', () => (this.quality = select.value))
    }

    private async submit(): Promise<void> {
        if (this.selected.size === 0) return
        if (!(this.minutes > 0) && !this.adoptTimer) {
            new Notice('Enter the minutes practiced.')
            return
        }
        const minutes =
            this.adoptTimer && this.preset.timer
                ? Math.max(1, Math.round((Date.now() - this.preset.timer.startedAt) / 60_000))
                : this.minutes
        this.submitEl?.setAttr('disabled', 'true')
        try {
            const session = await this.deps.submit(
                {
                    date: this.date,
                    minutes,
                    ...(this.preset.startTime && !this.adoptTimer
                        ? { startTime: this.preset.startTime }
                        : {}),
                    ...(this.focus ? { focus: this.focus } : {}),
                    ...(this.quality ? { quality: this.quality } : {}),
                    ...(this.note.trim() ? { note: this.note.trim() } : {}),
                    items: [...this.selected.values()]
                },
                this.adoptTimer
            )
            new Notice(`Logged ${minutes} min: ${session}`)
            this.preset.onLogged?.()
            this.close()
        } catch (error: unknown) {
            new Notice(error instanceof Error ? error.message : String(error))
            this.submitEl?.removeAttribute('disabled')
        }
    }

    private numberField(
        parent: HTMLElement,
        label: string,
        value: number | string,
        set: (v: number) => void
    ): void {
        const field = parent.createEl('label', { cls: 'mp-field', text: label })
        const input = field.createEl('input', { type: 'number', attr: { min: '1', max: '600' } })
        input.value = String(value)
        input.addEventListener('input', () => {
            const n = Number(input.value)
            set(Number.isFinite(n) ? Math.round(n) : 0)
        })
    }

    private textField(
        parent: HTMLElement,
        label: string,
        value: string,
        type: string,
        set: (v: string) => void,
        placeholder = ''
    ): void {
        const field = parent.createEl('label', { cls: 'mp-field', text: label })
        const input = field.createEl('input', { type, attr: { placeholder } })
        input.value = value
        input.addEventListener('input', () => set(input.value.trim()))
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
