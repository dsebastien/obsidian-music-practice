/**
 * The controls of a plain-text tab drawn as tablature (#84): **Text** in the player bar shows the
 * block as written, **Show as tab** goes back, **Edit as alphaTex** converts it in its note (#60),
 * and the bar says the rhythm is guessed. Made with Obsidian's element helpers, in the block's
 * own document (popout windows).
 */

export interface TextTabViewOptions {
    /** The block's text, as written. */
    text: string
    language: string
    /** Converts the block into alphaTex in its note; null when it can't (a canvas card). */
    edit: (() => void) | null
    /** Whether the tablature was drawn: else the text shows, with no way back. */
    drawn: boolean
    /** Called when the text shows (true) or the tablature (false). */
    onShow?: (text: boolean) => void
}

export interface TextTabView {
    /** Shows the text (true) or the tablature (false). */
    show(text: boolean): void
    /** Whether the text shows. */
    readonly showingText: boolean
    /** Removes the text panel (the block is drawn again). */
    remove(): void
}

/** A button in `parent` that keeps its clicks: in live preview, a click on a block opens its source. */
function button(parent: HTMLElement, cls: string, text: string, run: () => void): HTMLElement {
    const b = parent.createEl('button', { cls, text, attr: { type: 'button' } })
    b.addEventListener('mousedown', (event) => event.stopPropagation())
    b.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        run()
    })
    return b
}

/**
 * Adds the text tab controls around `el`, the drawn block (the library's `.mn-tab`): the text
 * panel after it, and in its player bar **Text** (in the view control), the guessed rhythm
 * note and **Edit as alphaTex**.
 */
export function textTabView(el: HTMLElement, options: TextTabViewOptions): TextTabView {
    const panel = (el.parentElement ?? el).createDiv({ cls: 'mp-tab-text' })
    el.insertAdjacentElement('afterend', panel)
    panel
        .createEl('pre')
        .createEl('code', { cls: `language-${options.language}`, text: options.text })
    const actions = panel.createDiv({ cls: 'mp-tab-actions' })
    let showingText = false
    const show = (text: boolean) => {
        showingText = text
        panel.toggle(text)
        el.toggle(!text)
        options.onShow?.(text)
    }
    if (options.drawn) button(actions, 'mp-tab-show-tab', 'Show as tab', () => show(false))
    const edit = options.edit
    if (edit) button(actions, 'mp-tab-convert', 'Edit as alphaTex', edit)

    const bar = options.drawn ? el.querySelector<HTMLElement>('.mn-tab-bar') : null
    if (bar) {
        const text = button(bar, 'mp-tab-show-text', 'Text', () => show(true))
        text.title = 'Show as text: the block as you wrote it'
        // With the views (Tab, Score, Both, Text), before Keep this view: they wrap together.
        const views = bar.querySelector('.mn-tab-views')
        views?.insertBefore(text, views.querySelector('.mn-tab-keep'))
        bar.createSpan({ cls: 'mp-tab-guessed', text: 'Rhythm guessed from the tab' })
        if (edit)
            button(bar, 'mp-tab-edit', 'Edit as alphaTex', edit).title =
                'Replace the text tab with alphaTex in the note, to correct the rhythm'
    }
    showingText = !options.drawn
    panel.toggle(showingText)
    el.toggle(!showingText)
    return {
        show,
        get showingText() {
            return showingText
        },
        remove: () => panel.remove()
    }
}
