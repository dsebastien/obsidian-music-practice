import { SuggestModal } from 'obsidian'
import type { App } from 'obsidian'
import { parseChord } from '@dsebastien/music-notation'

/** Pick one reading of a chord's notes ("Am7" or "C6/A"), the most common first. */
export class ChooseChordModal extends SuggestModal<string> {
    constructor(
        app: App,
        private readonly readings: string[],
        private readonly onChoose: (symbol: string) => void
    ) {
        super(app)
        this.setPlaceholder('These notes can be read several ways: pick one')
    }

    override getSuggestions(query: string): string[] {
        const q = query.trim().toLowerCase()
        return this.readings.filter(
            (r) =>
                !q ||
                r.toLowerCase().includes(q) ||
                (parseChord(r)?.name.toLowerCase().includes(q) ?? false)
        )
    }

    override renderSuggestion(symbol: string, el: HTMLElement): void {
        el.createDiv({ text: symbol })
        const name = parseChord(symbol)?.name
        if (name) el.createEl('small', { text: name, cls: 'mp-muted' })
    }

    override onChooseSuggestion(symbol: string): void {
        this.onChoose(symbol)
    }
}
