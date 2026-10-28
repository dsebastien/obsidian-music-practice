import { Modal, Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { LearningItem } from '../domain/practice'

export interface BpmResult {
    current?: number
    target?: number
    /** The user accepted moving the item to "at tempo" after reaching the target. */
    atTempo: boolean
}

/** Set the current and target BPM; reaching the target offers the "at tempo" level. */
export class BpmModal extends Modal {
    private current: number | undefined
    private target: number | undefined
    private moveToTempo = true
    private offerEl: HTMLElement | null = null

    constructor(
        app: App,
        private readonly item: LearningItem,
        private readonly tempoLevel: number,
        private readonly save: (result: BpmResult) => Promise<void>
    ) {
        super(app)
        this.current = item.bpmCurrent ?? undefined
        this.target = item.bpmTarget ?? undefined
    }

    override onOpen(): void {
        this.setTitle(`BPM: ${this.item.name}`)
        const { contentEl } = this
        contentEl.addClass('mp-modal')
        const row = contentEl.createDiv({ cls: 'mp-form-row' })
        this.field(row, 'Current BPM', this.current, (v) => (this.current = v))
        this.field(row, 'Target BPM', this.target, (v) => (this.target = v))
        const offer = contentEl.createEl('label', { cls: 'mp-field' })
        const box = offer.createEl('input', { type: 'checkbox' })
        box.checked = this.moveToTempo
        box.addEventListener('change', () => (this.moveToTempo = box.checked))
        offer.appendText(' Target reached: move to "at tempo"')
        this.offerEl = offer
        this.refreshOffer()
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        actions
            .createEl('button', { cls: 'mod-cta', text: 'Save' })
            .addEventListener('click', () => void this.submit())
    }

    private field(
        parent: HTMLElement,
        label: string,
        value: number | undefined,
        set: (v: number | undefined) => void
    ): void {
        const el = parent.createEl('label', { cls: 'mp-field', text: label })
        const input = el.createEl('input', { type: 'number', attr: { min: '20', max: '400' } })
        if (value !== undefined) input.value = String(value)
        input.addEventListener('input', () => {
            const n = Number(input.value)
            set(input.value && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined)
            this.refreshOffer()
        })
    }

    private reached(): boolean {
        return (
            this.current !== undefined &&
            this.target !== undefined &&
            this.current >= this.target &&
            (this.item.level ?? 0) < this.tempoLevel
        )
    }

    private refreshOffer(): void {
        this.offerEl?.toggleClass('mp-is-hidden', !this.reached())
    }

    private async submit(): Promise<void> {
        const reached = this.reached() && this.moveToTempo
        try {
            await this.save({
                ...(this.current !== undefined ? { current: this.current } : {}),
                ...(this.target !== undefined ? { target: this.target } : {}),
                atTempo: reached
            })
            this.close()
        } catch (error: unknown) {
            new Notice(error instanceof Error ? error.message : String(error))
        }
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
