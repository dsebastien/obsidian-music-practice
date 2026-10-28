import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import type { NoteModel } from '../domain/note-model'
import { isDueForReview, overdueBy, practiceNext, readyToLearn } from '../domain/practice'
import type { LearningItem } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'
import { renderItemRow } from './item-row'

const MAX_PER_SECTION = 10

/** What to practice now: due reviews, the ranking, and what is ready to learn. */
export class PracticeNextModal extends Modal {
    constructor(
        app: App,
        private readonly model: NoteModel,
        private readonly items: LearningItem[],
        private readonly rules: PracticeRules
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle('Practice next')
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        if (this.items.length === 0) {
            contentEl.createDiv({
                cls: 'mp-empty',
                text: 'No learning notes yet. Add a chord, a scale or a piece with a mastery level, and it shows up here.'
            })
            return
        }
        const due = this.items.filter(isDueForReview).sort((a, b) => overdueBy(b) - overdueBy(a))
        const next = practiceNext(this.items, this.rules).filter((i) => !isDueForReview(i))
        const ready = readyToLearn(this.items, this.rules)
        if (due.length + next.length + ready.length === 0) {
            contentEl.createDiv({
                cls: 'mp-empty',
                text: 'Nothing active or due. Pick something you want to learn and set it to Learning.'
            })
            return
        }
        this.section('Due for review', due)
        this.section('Next', next)
        this.section('Ready to learn', ready, (i) => (i.unlocks ? [`Unlocks ${i.unlocks}`] : []))
    }

    private section(
        title: string,
        list: LearningItem[],
        extra: (i: LearningItem) => string[] = () => []
    ): void {
        if (list.length === 0) return
        const { contentEl } = this
        const header = contentEl.createEl('h4', { cls: 'mp-section-title', text: title })
        header.createSpan({ cls: 'mp-section-minutes', text: String(list.length) })
        const listEl = contentEl.createDiv({ cls: 'mp-list' })
        for (const item of list.slice(0, MAX_PER_SECTION))
            renderItemRow(this.app, listEl, this.model, item, { extra: extra(item) })
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
