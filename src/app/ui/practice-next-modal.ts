import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import type { NoteModel } from '../domain/note-model'
import { isDueForReview, overdueBy, practiceNext, readyToLearn } from '../domain/practice'
import type { LearningItem } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'
import { renderItemRow } from './item-row'
import { t } from '../i18n/i18n'

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
        this.setTitle(t('log.next.title'))
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        if (this.items.length === 0) {
            contentEl.createDiv({
                cls: 'mp-empty',
                text: t('log.next.empty')
            })
            return
        }
        const due = this.items.filter(isDueForReview).sort((a, b) => overdueBy(b) - overdueBy(a))
        const next = practiceNext(this.items, this.rules).filter((i) => !isDueForReview(i))
        const ready = readyToLearn(this.items, this.rules)
        if (due.length + next.length + ready.length === 0) {
            contentEl.createDiv({
                cls: 'mp-empty',
                text: t('log.next.nothingDue')
            })
            return
        }
        this.section(t('log.next.due'), due)
        this.section(t('log.next.next'), next)
        this.section(t('log.next.ready'), ready, (i) =>
            i.unlocks ? [t('log.next.unlocks', { items: i.unlocks })] : []
        )
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
