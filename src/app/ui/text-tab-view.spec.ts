import { describe, expect, it } from 'bun:test'
import { textTabView } from './text-tab-view'

/** An element with the Obsidian helpers the view uses (no DOM in these tests). */
class El {
    children: El[] = []
    parent: El | null = null
    shown = true
    title = ''
    private readonly listeners: Record<string, ((event: unknown) => void)[]> = {}

    constructor(
        readonly tag: string,
        readonly cls = '',
        readonly text = ''
    ) {}

    private add(el: El): El {
        el.parent = this
        this.children.push(el)
        return el
    }
    createEl(tag: string, options: { cls?: string; text?: string } = {}): El {
        return this.add(new El(tag, options.cls, options.text))
    }
    createDiv(options: { cls?: string } = {}): El {
        return this.add(new El('div', options.cls))
    }
    createSpan(options: { cls?: string; text?: string } = {}): El {
        return this.add(new El('span', options.cls, options.text))
    }
    get parentElement(): El | null {
        return this.parent
    }
    remove(): void {
        if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this)
        this.parent = null
    }
    insertAdjacentElement(_where: 'afterend', el: El): El {
        el.remove()
        const siblings = this.parent!.children
        siblings.splice(siblings.indexOf(this) + 1, 0, el)
        el.parent = this.parent
        return el
    }
    insertBefore(el: El, before: El | null): El {
        el.remove()
        const at = before ? this.children.indexOf(before) : -1
        this.children.splice(at < 0 ? this.children.length : at, 0, el)
        el.parent = this
        return el
    }
    querySelector(selector: string): El | null {
        for (const child of this.children) {
            if (child.cls.split(' ').includes(selector.slice(1))) return child
            const found = child.querySelector(selector)
            if (found) return found
        }
        return null
    }
    toggle(show: boolean): void {
        this.shown = show
    }
    addEventListener(type: string, listener: (event: unknown) => void): void {
        ;(this.listeners[type] ??= []).push(listener)
    }
    click(): void {
        for (const listener of this.listeners['click'] ?? [])
            listener({ preventDefault: () => {}, stopPropagation: () => {} })
    }
    find(cls: string): El {
        return this.querySelector(`.${cls}`)!
    }
}

/** A drawn tab block in its container: the library's element, its bar, its view control. */
function drawnBlock(views = true) {
    const container = new El('div')
    const el = container.createDiv({ cls: 'mn-tab' })
    el.createDiv({ cls: 'mn-tab-surface' })
    const bar = el.createDiv({ cls: 'mn-play mn-tab-bar' })
    bar.createEl('button', { text: 'Play' })
    if (views) {
        const group = bar.createSpan({ cls: 'mn-tab-views' })
        for (const text of ['Tab', 'Score', 'Both']) group.createEl('button', { text })
        group.createEl('button', { cls: 'mn-tab-keep', text: 'Keep this view' })
    }
    bar.createSpan({ cls: 'mn-tab-time' })
    return { container, el, bar }
}

/** A test double typed as what it stands in for (it only has what the code under test reads). */
const fake = <T>(value: unknown): T => value as T

const view = (el: El, options: Partial<Parameters<typeof textTabView>[1]> = {}) =>
    textTabView(fake<HTMLElement>(el), {
        text: 'e|---0---|',
        language: 'tab',
        edit: null,
        drawn: true,
        ...options
    })

describe('textTabView (#84)', () => {
    it('adds Text to the view control, then the guessed rhythm and Edit as alphaTex', () => {
        const { el, bar } = drawnBlock()
        view(el, { edit: () => {} })
        expect(bar.find('mn-tab-views').children.map((c) => c.text)).toEqual([
            'Tab',
            'Score',
            'Both',
            'Text',
            'Keep this view'
        ])
        expect(bar.children.map((c) => c.cls || c.text)).toEqual([
            'Play',
            'mn-tab-views',
            'mn-tab-time',
            'mp-tab-guessed',
            'mp-tab-edit'
        ])
        expect(bar.find('mp-tab-guessed').text).toBe('Rhythm guessed from the tab')
        // Drums have no view control: Text goes at the end.
        const drums = drawnBlock(false)
        view(drums.el)
        expect(drums.bar.children.map((c) => c.cls || c.text).slice(-2)).toEqual([
            'mp-tab-show-text',
            'mp-tab-guessed'
        ])
    })

    it('switches between the tablature and the text, both ways', () => {
        const { container, el, bar } = drawnBlock()
        const shown: boolean[] = []
        const edits: number[] = []
        const v = view(el, { edit: () => edits.push(1), onShow: (text) => shown.push(text) })
        const panel = container.find('mp-tab-text')
        // The panel comes right after the drawing, hidden.
        expect(container.children).toEqual([el, panel])
        expect([el.shown, panel.shown, v.showingText]).toEqual([true, false, false])
        bar.find('mp-tab-show-text').click()
        expect([el.shown, panel.shown, v.showingText]).toEqual([false, true, true])
        expect(panel.find('language-tab').text).toBe('e|---0---|')
        expect(panel.find('mp-tab-actions').children.map((c) => c.text)).toEqual([
            'Show as tab',
            'Edit as alphaTex'
        ])
        panel.find('mp-tab-convert').click()
        expect(edits).toEqual([1])
        panel.find('mp-tab-show-tab').click()
        expect([el.shown, panel.shown]).toEqual([true, false])
        expect(shown).toEqual([true, false])
        v.remove()
        expect(container.children).toEqual([el])
    })

    it("shows the text with no way back when alphaTab couldn't draw it", () => {
        const { container, el, bar } = drawnBlock()
        const v = view(el, { drawn: false, edit: () => {} })
        const panel = container.find('mp-tab-text')
        expect([el.shown, panel.shown, v.showingText]).toEqual([false, true, true])
        expect(panel.find('mp-tab-actions').children.map((c) => c.text)).toEqual([
            'Edit as alphaTex'
        ])
        expect(bar.querySelector('.mp-tab-show-text')).toBeNull()
    })

    it('has no Edit as alphaTex without a note to change (a canvas card)', () => {
        const { container, el, bar } = drawnBlock()
        view(el)
        expect(bar.querySelector('.mp-tab-edit')).toBeNull()
        expect(container.querySelector('.mp-tab-convert')).toBeNull()
    })
})
