import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import { levelOf } from '../domain/mastery'
import type { LearningType } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import { rubricFor } from '../domain/rubric'
import type { RubricSettings } from '../domain/rubric'
import type { PracticeRules } from '../domain/rules'

/** Pick an item's mastery level; each level shows what it means for this kind of item. */
export class MasteryModal extends Modal {
    constructor(
        app: App,
        private readonly item: LearningItem,
        private readonly type: LearningType,
        private readonly rubricSettings: RubricSettings,
        private readonly rules: PracticeRules,
        private readonly save: (level: number) => Promise<void>
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle(`Mastery: ${this.item.name}`)
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        const rubric = rubricFor(this.type.kind, this.rubricSettings, this.rules)
        const list = contentEl.createDiv({ cls: 'mp-list' })
        for (const value of this.type.statusValues) {
            const level = levelOf(value)
            if (level === null) continue
            const isCurrent = level === this.item.level
            const card = list.createEl('button', {
                cls: `mp-item mp-choice${isCurrent ? ' mp-is-selected' : ''}`
            })
            const head = card.createDiv({ cls: 'mp-item-head' })
            const badge = head.createSpan({
                cls: 'mp-badge',
                text: value.replace(/^\s*\d+\s*-\s*/, '')
            })
            badge.dataset['level'] = String(level)
            if (isCurrent) head.createSpan({ cls: 'mp-item-minutes', text: 'Current' })
            if (rubric[level]) card.createDiv({ cls: 'mp-item-meta', text: rubric[level] })
            card.addEventListener('click', () => void this.pick(level))
        }
    }

    private async pick(level: number): Promise<void> {
        if (level === this.item.level) {
            this.close()
            return
        }
        try {
            await this.save(level)
            this.close()
        } catch (error: unknown) {
            new Notice(error instanceof Error ? error.message : String(error))
        }
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
