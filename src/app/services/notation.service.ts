import { MarkdownRenderChild } from 'obsidian'
import type { Plugin } from 'obsidian'
import { LANGUAGES, renderBlock } from '@dsebastien/music-notation'
import type { NotationLanguage, RenderResult } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'

export type NotationToggles = Record<NotationLanguage, boolean>

/** Where each block language stands: rendered by us, turned off, or handled by another plugin. */
export type NotationStatus = 'on' | 'off' | 'taken'

/** A rendered block, removed when Obsidian re-renders or closes the note. */
class NotationChild extends MarkdownRenderChild {
    constructor(
        el: HTMLElement,
        private readonly result: RenderResult
    ) {
        super(el)
    }

    override onunload(): void {
        this.result.destroy()
    }
}

/**
 * Registers the notation code block processors (chord, chords, keyboard, fretboard), drawn by the
 * music notation library. A language another plugin registered first stays theirs. A language
 * turned off after registration renders as plain code until the plugin reloads (Obsidian can't
 * unregister a processor), so turning one off and reloading frees it for another plugin.
 */
export class NotationBlocks {
    private readonly registered = new Set<NotationLanguage>()
    private readonly taken = new Set<NotationLanguage>()

    constructor(
        private readonly plugin: Plugin,
        private readonly toggles: () => NotationToggles
    ) {}

    /** Register every language turned on and not registered yet. */
    sync(): void {
        for (const language of LANGUAGES) {
            if (!this.toggles()[language] || this.registered.has(language)) continue
            try {
                this.plugin.registerMarkdownCodeBlockProcessor(language, (source, el, ctx) => {
                    if (!this.toggles()[language]) {
                        el.createEl('pre').createEl('code', {
                            cls: `language-${language}`,
                            text: source
                        })
                        return
                    }
                    const result = renderBlock(language, source, el, {
                        voicings: lookupGuitarVoicing
                    })
                    ctx.addChild(new NotationChild(el, result))
                })
                this.registered.add(language)
                this.taken.delete(language)
            } catch {
                // Obsidian throws when another plugin already handles this language.
                this.taken.add(language)
            }
        }
    }

    status(language: NotationLanguage): NotationStatus {
        if (this.taken.has(language)) return 'taken'
        return this.toggles()[language] && this.registered.has(language) ? 'on' : 'off'
    }
}
