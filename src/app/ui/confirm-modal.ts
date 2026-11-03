import { Modal } from 'obsidian'
import type { App } from 'obsidian'

export interface ConfirmOptions {
    title: string
    message: string
    /** The button that confirms ("Discard"); it gets the warning style. */
    confirm: string
}

/**
 * Asks before an action that can't be undone, in an Obsidian modal (never `window.confirm`, which
 * blocks the app and doesn't follow the theme). Resolves with true only when the user confirms;
 * Cancel, Escape and closing the modal resolve with false.
 */
export class ConfirmModal extends Modal {
    private confirmed = false

    constructor(
        app: App,
        private readonly options: ConfirmOptions,
        private readonly resolve: (confirmed: boolean) => void
    ) {
        super(app)
    }

    override onOpen(): void {
        const { contentEl } = this
        this.setTitle(this.options.title)
        contentEl.addClass('mp-confirm')
        contentEl.createEl('p', { text: this.options.message })
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        const ok = actions.createEl('button', { cls: 'mod-warning', text: this.options.confirm })
        ok.addEventListener('click', () => {
            this.confirmed = true
            this.close()
        })
        ok.focus()
    }

    override onClose(): void {
        this.contentEl.empty()
        this.resolve(this.confirmed)
    }
}

/** Open a confirmation and wait for the answer. */
export function confirm(app: App, options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => new ConfirmModal(app, options, resolve).open())
}
