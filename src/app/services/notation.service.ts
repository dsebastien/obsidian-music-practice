import { MarkdownPreviewRenderer, MarkdownRenderChild, MarkdownView } from 'obsidian'
import type { Plugin, Workspace } from 'obsidian'
import { LANGUAGES, renderBlock } from '@dsebastien/music-notation'
import type { LayoutDefaults, NotationLanguage, RenderResult } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'

export type NotationToggles = Record<NotationLanguage, boolean>

/** What the notation blocks need from the plugin. */
export type NotationHost = Pick<Plugin, 'registerMarkdownCodeBlockProcessor'> & {
    app: { workspace: Pick<Workspace, 'getLeavesOfType'> }
}

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
 * Whether a code block language already has a processor, from Obsidian's registry (not part of
 * the public API: null when it can't be read).
 */
export function processorExists(language: string): boolean | null {
    const registry: unknown = Reflect.get(MarkdownPreviewRenderer, 'codeBlockPostProcessors')
    if (typeof registry !== 'object' || registry === null) return null
    return Object.prototype.hasOwnProperty.call(registry, language)
}

/**
 * Registers the notation code block processors (chord, chords, keyboard, fretboard), drawn by the
 * music notation library.
 *
 * A language another plugin already handles is left alone, checked before registering: Obsidian
 * adds a generic post-processor before it refuses a duplicate, and that one is never removed, so a
 * refused registration must happen at most once (and never when the registry can be read).
 * A language turned off after registration renders as plain code until the plugin reloads
 * (Obsidian can't unregister a processor), which frees it for another plugin.
 */
export class NotationBlocks {
    private readonly registered = new Set<NotationLanguage>()
    private readonly taken = new Set<NotationLanguage>()

    constructor(
        private readonly plugin: NotationHost,
        private readonly toggles: () => NotationToggles,
        private readonly layout: () => LayoutDefaults = () => ({}),
        private readonly exists: (language: string) => boolean | null = processorExists
    ) {}

    /** Register every language turned on, not registered yet and not taken. */
    sync(): void {
        for (const language of LANGUAGES) {
            if (!this.toggles()[language]) continue
            if (this.registered.has(language) || this.taken.has(language)) continue
            if (this.exists(language) === true) {
                this.taken.add(language)
                continue
            }
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
                        ...this.layout(),
                        voicings: lookupGuitarVoicing
                    })
                    ctx.addChild(new NotationChild(el, result))
                })
                this.registered.add(language)
            } catch {
                // Registry unreadable and another plugin was first: never try this one again.
                this.taken.add(language)
            }
        }
    }

    status(language: NotationLanguage): NotationStatus {
        if (this.taken.has(language)) return 'taken'
        return this.toggles()[language] && this.registered.has(language) ? 'on' : 'off'
    }

    /** Redraw open notes in reading view, after a block was turned on or off or the layout changed. */
    refreshOpenNotes(): void {
        for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
            if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true)
        }
    }
}
