import { Modal, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type { NoteModel } from '../domain/note-model'
import { buildPlan } from '../domain/plan'
import type { BlockName } from '../domain/plan'
import type { LearningItem } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'
import { renderItemRow } from './item-row'
import { t } from '../i18n/i18n'

const blockTitle = (block: BlockName): string => {
    switch (block) {
        case 'warm-up':
            return t('log.plan.block.warm-up')
        case 'focus':
            return t('log.plan.block.focus')
        case 'review':
            return t('log.plan.block.review')
        case 'fun':
            return t('log.plan.block.fun')
    }
}

/** A practice session for the minutes you have. */
export class PracticePlanModal extends Modal {
    private minutes: number
    private planEl: HTMLElement | null = null

    constructor(
        app: App,
        private readonly model: NoteModel,
        private readonly items: LearningItem[],
        private readonly rules: PracticeRules,
        minutes: number,
        private readonly onLog?: (minutes: number, paths: string[]) => void,
        /** Put the plan in the practice panel's session list. */
        private readonly onUseInPanel?: (paths: string[]) => void
    ) {
        super(app)
        this.minutes = minutes
    }

    override onOpen(): void {
        this.setTitle(t('log.plan.title'))
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        new Setting(contentEl)
            .setName(t('log.plan.minutes'))
            .setDesc(t('log.plan.minutesDesc'))
            .addText((text) => {
                text.inputEl.type = 'number'
                text.inputEl.min = '5'
                text.setValue(String(this.minutes)).onChange((value) => {
                    const n = Number(value)
                    if (Number.isFinite(n) && n >= 5) {
                        this.minutes = Math.round(n)
                        this.render()
                    }
                })
            })
        this.planEl = contentEl.createDiv({ cls: 'mp-modal' })
        this.render()
    }

    private render(): void {
        const el = this.planEl
        if (!el) return
        el.empty()
        const plan = buildPlan(this.items, this.minutes, this.rules)
        const planned = plan.blocks.filter((b) => b.items.length > 0)
        if (planned.length === 0) {
            el.createDiv({
                cls: 'mp-empty',
                text: t('log.plan.empty')
            })
            return
        }
        for (const block of planned) {
            const header = el.createEl('h4', {
                cls: 'mp-section-title',
                text: blockTitle(block.block)
            })
            header.createSpan({
                cls: 'mp-section-minutes',
                text: t('log.minutesShort', { minutes: block.minutes })
            })
            const list = el.createDiv({ cls: 'mp-list' })
            for (const p of block.items)
                renderItemRow(this.app, list, this.model, p.item, { minutes: p.minutes })
        }
        const onLog = this.onLog
        const onUseInPanel = this.onUseInPanel
        const paths = () => planned.flatMap((b) => b.items.map((p) => p.item.path))
        const actions = el.createDiv({ cls: 'mp-actions' })
        if (onUseInPanel) {
            actions
                .createEl('button', { text: t('log.plan.useInPanel') })
                .addEventListener('click', () => {
                    this.close()
                    onUseInPanel(paths())
                })
        }
        if (onLog) {
            const button = actions.createEl('button', {
                cls: 'mod-cta',
                text: t('log.plan.logSession')
            })
            button.addEventListener('click', () => {
                this.close()
                onLog(
                    this.minutes,
                    planned.flatMap((b) => b.items.map((p) => p.item.path))
                )
            })
        }
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
