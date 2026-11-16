import { Modal } from 'obsidian'
import type { App } from 'obsidian'
import { t } from '../i18n/i18n'

/**
 * Asks for the name of a section set in the play-along player (#75). Resolves with the name typed
 * (empty is allowed: the time shows instead), or null for Cancel, Escape or closing the modal.
 */
export class SectionNameModal extends Modal {
    private answer: string | null = null

    constructor(
        app: App,
        private readonly proposed: string,
        private readonly resolve: (name: string | null) => void
    ) {
        super(app)
    }

    override onOpen(): void {
        const { contentEl } = this
        this.setTitle(t('tools.section.title'))
        contentEl.addClass('mp-confirm')
        const input = contentEl.createEl('input', {
            type: 'text',
            cls: 'mp-section-name',
            attr: { 'aria-label': t('tools.section.nameLabel') }
        })
        input.value = this.proposed
        const add = () => {
            this.answer = input.value.trim()
            this.close()
        }
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.isComposing) return
            event.preventDefault()
            add()
        })
        const actions = contentEl.createDiv({ cls: 'mp-actions' })
        actions
            .createEl('button', { text: t('common.cancel') })
            .addEventListener('click', () => this.close())
        actions
            .createEl('button', { cls: 'mod-cta', text: t('common.add') })
            .addEventListener('click', add)
        input.focus()
        input.select()
    }

    override onClose(): void {
        this.contentEl.empty()
        this.resolve(this.answer)
    }
}

/** Open the question and wait for the name. */
export function askSectionName(app: App, proposed: string): Promise<string | null> {
    return new Promise((resolve) => new SectionNameModal(app, proposed, resolve).open())
}
