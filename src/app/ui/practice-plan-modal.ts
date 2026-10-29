import { Modal, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type { NoteModel } from '../domain/note-model'
import { buildPlan } from '../domain/plan'
import type { BlockName } from '../domain/plan'
import type { LearningItem } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'
import { renderItemRow } from './item-row'

const BLOCK_TITLE: Record<BlockName, string> = {
    'warm-up': 'Warm-up',
    'focus': 'Focus',
    'review': 'Review',
    'fun': 'Fun'
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
        this.setTitle('Practice plan')
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        new Setting(contentEl)
            .setName('Minutes')
            .setDesc('How long you can practice now.')
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
                text: 'Nothing to practice yet: no active or due learning notes.'
            })
            return
        }
        for (const block of planned) {
            const header = el.createEl('h4', {
                cls: 'mp-section-title',
                text: BLOCK_TITLE[block.block]
            })
            header.createSpan({ cls: 'mp-section-minutes', text: `${block.minutes} min` })
            const list = el.createDiv({ cls: 'mp-list' })
            for (const p of block.items)
                renderItemRow(this.app, list, this.model, p.item, { minutes: p.minutes })
        }
        const onLog = this.onLog
        const onUseInPanel = this.onUseInPanel
        const paths = () => planned.flatMap((b) => b.items.map((p) => p.item.path))
        const actions = el.createDiv({ cls: 'mp-actions' })
        if (onUseInPanel) {
            actions.createEl('button', { text: 'Use in panel' }).addEventListener('click', () => {
                this.close()
                onUseInPanel(paths())
            })
        }
        if (onLog) {
            const button = actions.createEl('button', { cls: 'mod-cta', text: 'Log this session' })
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
