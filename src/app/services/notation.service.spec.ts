import { describe, expect, it } from 'bun:test'
import { NotationBlocks, processorExists } from './notation.service'
import type { NotationHost, NotationToggles } from './notation.service'
import type {
    LayoutDefaults,
    NotationLanguage,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import type { MarkdownRenderChild } from 'obsidian'

const allOn = (): NotationToggles => ({
    chord: true,
    chords: true,
    keyboard: true,
    fretboard: true
})

/** A plugin whose registrations are recorded; `refuse` languages throw like Obsidian does. */
function fakePlugin(refuse: string[] = []) {
    const calls: string[] = []
    const plugin: NotationHost = {
        registerMarkdownCodeBlockProcessor: (language: string) => {
            calls.push(language)
            if (refuse.includes(language))
                throw new Error(
                    `Code block postprocessor for language ${language} is already registered`
                )
            return () => {}
        },
        app: { workspace: { getLeavesOfType: () => [] } }
    }
    return { plugin, calls }
}

describe('NotationBlocks', () => {
    it('registers every language turned on, once', () => {
        const { plugin, calls } = fakePlugin()
        const blocks = new NotationBlocks(plugin, allOn, undefined, () => false)
        blocks.sync()
        blocks.sync()
        expect(calls).toEqual(['chord', 'chords', 'keyboard', 'fretboard'])
        expect(blocks.status('chord')).toBe('on')
    })

    it('skips languages turned off, and registers them when turned on', () => {
        const { plugin, calls } = fakePlugin()
        const toggles = { ...allOn(), chords: false }
        const blocks = new NotationBlocks(
            plugin,
            () => toggles,
            undefined,
            () => false
        )
        blocks.sync()
        expect(calls).not.toContain('chords')
        expect(blocks.status('chords')).toBe('off')
        toggles.chords = true
        blocks.sync()
        expect(calls).toContain('chords')
        expect(blocks.status('chords')).toBe('on')
    })

    it("leaves another plugin's language alone without trying to register it", () => {
        const { plugin, calls } = fakePlugin()
        const blocks = new NotationBlocks(plugin, allOn, undefined, (l) => l === 'chord')
        blocks.sync()
        expect(calls).not.toContain('chord')
        expect(blocks.status('chord')).toBe('taken')
    })

    it('tries a refused registration only once when the registry is unreadable', () => {
        const { plugin, calls } = fakePlugin(['keyboard'])
        const blocks = new NotationBlocks(plugin, allOn, undefined, () => null)
        blocks.sync()
        blocks.sync()
        blocks.sync()
        expect(calls.filter((l) => l === 'keyboard')).toHaveLength(1)
        expect(blocks.status('keyboard')).toBe('taken')
        expect(blocks.status('fretboard')).toBe('on')
    })

    it("reads no registry when Obsidian doesn't expose one", () => {
        expect(processorExists('chord')).toBeNull()
    })
})

describe('NotationBlocks layout', () => {
    type Register = NotationHost['registerMarkdownCodeBlockProcessor']
    type Processor = Parameters<Register>[1]
    type Context = Parameters<Processor>[2]

    function setup() {
        const processors = new Map<string, Processor>()
        const plugin: NotationHost = {
            registerMarkdownCodeBlockProcessor: (language: string, processor: Processor) => {
                processors.set(language, processor)
                return () => {}
            },
            app: { workspace: { getLeavesOfType: () => [] } }
        }
        let layout: LayoutDefaults = {}
        const drawn: { source: string; options: RenderOptions; destroyed: boolean }[] = []
        const render = (
            _language: NotationLanguage,
            source: string,
            host: HTMLElement,
            options: RenderOptions = {}
        ): RenderResult => {
            const entry = { source, options, destroyed: false }
            drawn.push(entry)
            return { ok: true, el: host, error: null, destroy: () => (entry.destroyed = true) }
        }
        const blocks = new NotationBlocks(
            plugin,
            allOn,
            () => layout,
            () => false,
            render
        )
        blocks.sync()
        const children: MarkdownRenderChild[] = []
        const ctx: Pick<Context, 'addChild'> = {
            addChild: (child) => {
                children.push(child)
                child.onload()
            }
        }
        const draw = (source: string) =>
            void processors.get('chord')!(source, {} as HTMLElement, ctx as Context)
        return { blocks, draw, drawn, children, set: (l: LayoutDefaults) => (layout = l) }
    }

    it('draws with the layout settings', () => {
        const { draw, drawn, set } = setup()
        set({ orientation: { chord: 'horizontal' }, hand: 'left' })
        draw('A x02220')
        expect(drawn[0]!.options.orientation).toEqual({ chord: 'horizontal' })
        expect(drawn[0]!.options.hand).toBe('left')
        expect(drawn[0]!.options.voicings).toBeDefined()
    })

    it('redraws every block on screen in place when the layout changes, and forgets unloaded ones', () => {
        const { blocks, draw, drawn, children, set } = setup()
        draw('A x02220')
        draw('C x32010')
        set({ hand: 'left' })
        blocks.redrawLayout()
        expect(drawn.map((d) => d.destroyed)).toEqual([true, true, false, false])
        expect(drawn.slice(2).map((d) => [d.source, d.options.hand])).toEqual([
            ['A x02220', 'left'],
            ['C x32010', 'left']
        ])
        children[0]!.onunload()
        blocks.redrawLayout()
        expect(drawn.slice(4).map((d) => d.source)).toEqual(['C x32010'])
    })
})

describe('NotationBlocks and note properties', () => {
    type Register = NotationHost['registerMarkdownCodeBlockProcessor']
    type Processor = Parameters<Register>[1]
    type Context = Parameters<Processor>[2]

    function setup(notes: Record<string, Record<string, unknown>>) {
        const processors = new Map<string, Processor>()
        const plugin: NotationHost = {
            registerMarkdownCodeBlockProcessor: (language: string, processor: Processor) => {
                processors.set(language, processor)
                return () => {}
            },
            app: { workspace: { getLeavesOfType: () => [] } }
        }
        const drawn: { source: string; properties: unknown }[] = []
        const render = (
            _language: NotationLanguage,
            source: string,
            host: HTMLElement,
            options: RenderOptions = {}
        ): RenderResult => {
            drawn.push({ source, properties: options.properties })
            return { ok: true, el: host, error: null, destroy: () => {} }
        }
        const blocks = new NotationBlocks(
            plugin,
            allOn,
            () => ({}),
            () => false,
            render,
            (path) => (notes[path] ? { properties: notes[path], instrument: 'guitar' } : null)
        )
        blocks.sync()
        const children: MarkdownRenderChild[] = []
        const draw = (source: string, sourcePath: string) => {
            const ctx: Pick<Context, 'addChild' | 'sourcePath'> = {
                sourcePath,
                addChild: (child) => {
                    children.push(child)
                    child.onload()
                }
            }
            void processors.get('chord')!(source, {} as HTMLElement, ctx as Context)
        }
        return { blocks, draw, drawn, children }
    }

    it('gives empty blocks the note properties, and blocks with content none', () => {
        const notes = { 'A.md': { chord_symbol: 'A', frets: 'x02220' } }
        const { draw, drawn } = setup(notes)
        draw('', 'A.md')
        draw('G 320003', 'A.md')
        expect(drawn[0]!.properties).toEqual(notes['A.md'])
        expect(drawn[1]!.properties).toBeUndefined()
    })

    it('redraws a note blocks only when their properties make another block', () => {
        const notes: Record<string, Record<string, unknown>> = {
            'A.md': { chord_symbol: 'A', frets: 'x02220' }
        }
        const { blocks, draw, drawn } = setup(notes)
        draw('', 'A.md')
        blocks.redrawNote('A.md')
        expect(drawn).toHaveLength(1)
        notes['A.md'] = { chord_symbol: 'A', frets: 'x02220', mastery: '30 - Can play slowly' }
        blocks.redrawNote('A.md')
        expect(drawn).toHaveLength(1)
        notes['A.md'] = { chord_symbol: 'Am', frets: 'x02210' }
        blocks.redrawNote('A.md')
        expect(drawn).toHaveLength(2)
    })

    it('follows a renamed note', () => {
        const notes: Record<string, Record<string, unknown>> = {
            'A.md': { chord_symbol: 'A', frets: 'x02220' }
        }
        const { blocks, draw, drawn } = setup(notes)
        draw('', 'A.md')
        notes['B.md'] = { chord_symbol: 'Am', frets: 'x02210' }
        delete notes['A.md']
        blocks.renamed('A.md', 'B.md')
        blocks.redrawNote('B.md')
        expect(drawn).toHaveLength(2)
        expect(drawn[1]!.properties).toEqual(notes['B.md'])
    })
})
