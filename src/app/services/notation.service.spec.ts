import { describe, expect, it } from 'bun:test'
import {
    NotationBlocks,
    errorLineOf,
    isTextTab,
    processorExists,
    showSource
} from './notation.service'
import type { NotationHost, NotationToggles, TabHost } from './notation.service'
import type {
    LayoutDefaults,
    NotationLanguage,
    RenderOptions,
    RenderResult
} from '@dsebastien/music-notation'
import type { MarkdownRenderChild } from 'obsidian'
import { textTabToAlphaTex } from '@dsebastien/music-notation'

/** A test double typed as what it stands in for (it only has what the code under test reads). */
const fake = <T>(value: unknown): T => value as T

const allOn = (): NotationToggles => ({
    chord: true,
    chords: true,
    keyboard: true,
    fretboard: true,
    tab: true,
    score: true,
    strum: true,
    progression: true,
    circle: true
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
        expect(calls).toEqual([
            'chord',
            'chords',
            'keyboard',
            'fretboard',
            'strum',
            'progression',
            'circle'
        ])
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

/** A block's element; `migrate()` moves it to another window (Obsidian's onWindowMigrated). */
function hostEl() {
    const listeners: (() => unknown)[] = []
    let win: object | null = null
    const el = fake<HTMLElement>({
        onWindowMigrated: (listener: () => unknown) => {
            listeners.push(listener)
            return () => {}
        }
    })
    // Its window, which `moveTo` changes without an event (a move before the block is loaded).
    Object.defineProperty(el, 'ownerDocument', { get: () => ({ defaultView: win }) })
    return {
        el,
        migrate: () => listeners.forEach((listener) => listener()),
        moveTo: (to: object) => (win = to)
    }
}

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
        const hosts: ReturnType<typeof hostEl>[] = []
        const draw = (source: string) => {
            const host = hostEl()
            hosts.push(host)
            void processors.get('chord')!(source, host.el, ctx as Context)
        }
        return {
            blocks,
            draw,
            drawn,
            children,
            hosts,
            processors,
            set: (l: LayoutDefaults) => (layout = l)
        }
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

    it('redraws a diagram moved to another window before it was loaded (no event fires)', () => {
        const { drawn, processors } = setup()
        const host = hostEl()
        let child: MarkdownRenderChild | null = null
        const later: Pick<Context, 'addChild'> = { addChild: (c) => (child = c) }
        void processors.get('chord')!('A x02220', host.el, later as Context)
        // Drawn in one window, moved to a popout, then loaded.
        host.moveTo({})
        child!.onload()
        expect(drawn.map((d) => d.destroyed)).toEqual([true, false])
        // Loaded where it was drawn: no second drawing.
        const { drawn: again, processors: p2 } = setup()
        const still = hostEl()
        let c2: MarkdownRenderChild | null = null
        const later2: Pick<Context, 'addChild'> = { addChild: (c) => (c2 = c) }
        void p2.get('chord')!('A x02220', still.el, later2 as Context)
        c2!.onload()
        expect(again).toHaveLength(1)
    })

    it('redraws a diagram moved to another window, so it plays through that window', () => {
        const { draw, drawn, hosts } = setup()
        draw('A x02220')
        draw('C x32010')
        hosts[1]!.migrate()
        expect(drawn.map((d) => [d.source, d.destroyed])).toEqual([
            ['A x02220', false],
            ['C x32010', true],
            ['C x32010', false]
        ])
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
            void processors.get('chord')!(source, hostEl().el, ctx as Context)
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

describe('NotationBlocks: tabs and scores', () => {
    type Register = NotationHost['registerMarkdownCodeBlockProcessor']
    type Processor = Parameters<Register>[1]
    type Context = Parameters<Processor>[2]

    /** An element recording what's created in it (Obsidian's createEl). */
    function fakeEl(clicks: (() => void)[] = []) {
        const made: { tag: string; cls?: string; text?: string }[] = []
        const el = {
            createEl: (tag: string, options: { cls?: string; text?: string } = {}) => {
                const { cls, text } = options
                made.push({ tag, ...(cls ? { cls } : {}), ...(text ? { text } : {}) })
                return el
            },
            addEventListener: (type: string, listener: (event: unknown) => void) => {
                const event = { preventDefault: () => {}, stopPropagation: () => {} }
                if (type === 'click') clicks.push(() => listener(event))
            }
        }
        return { el: fake<HTMLElement>(el), made }
    }

    function setup(toggles: NotationToggles = allOn(), taken: string[] = []) {
        const processors = new Map<string, Processor>()
        const plugin: NotationHost = {
            registerMarkdownCodeBlockProcessor: (language: string, processor: Processor) => {
                processors.set(language, processor)
                return () => {}
            },
            app: { workspace: { getLeavesOfType: () => [] } }
        }
        const converted: string[] = []
        const kept: string[] = []
        const tabs: TabHost = {
            runtime: {} as TabHost['runtime'],
            resolveFile: () => Promise.resolve(null),
            convert: (request) => converted.push(request.source),
            keepView: (request, staves) => kept.push(`${request.source} → ${staves}`)
        }
        const blocks = new NotationBlocks(
            plugin,
            () => toggles,
            undefined,
            (l) => taken.includes(l),
            undefined,
            undefined,
            undefined,
            tabs
        )
        blocks.sync()
        const children: MarkdownRenderChild[] = []
        const clicks: (() => void)[] = []
        const draw = (language: string, source: string, sourcePath = 'Song.md') => {
            const { el, made } = fakeEl(clicks)
            const ctx: Pick<Context, 'addChild' | 'sourcePath' | 'getSectionInfo'> = {
                sourcePath,
                addChild: (child) => children.push(child),
                getSectionInfo: () => null
            }
            void processors.get(language)!(source, el, ctx as Context)
            return made
        }
        return { blocks, processors, draw, children, clicks, converted, kept }
    }

    it('registers tab and score only with a tab host, unless another plugin has them', () => {
        expect([...setup().processors.keys()]).toContain('score')
        const { blocks, processors } = setup(allOn(), ['tab'])
        expect(processors.has('tab')).toBe(false)
        expect(blocks.status('tab')).toBe('taken')
        const { plugin, calls } = fakePlugin()
        new NotationBlocks(plugin, allOn, undefined, () => false).sync()
        expect(calls).not.toContain('tab')
    })

    it('draws alphaTex through alphaTab', () => {
        const { draw, children } = setup()
        const made = draw('tab', ':4 0.6 2.5 2.4 1.3')
        expect(made).toEqual([])
        expect(children).toHaveLength(1)
    })

    /** What a tab block drew: its child, with what it draws (TabChild). */
    type Drawn = {
        source: string
        textTab: { text: string; edit: (() => void) | null } | null
        keepView: ((staves: string) => void) | null
    }
    const TEXT =
        'e|-----0---|\nB|---1-----|\nG|-2-------|\nD|---------|\nA|---------|\nE|---------|'

    it('draws a plain-text tab as tablature, converted in memory (#84)', () => {
        const { draw, children, converted } = setup()
        expect(draw('tab', TEXT)).toEqual([])
        expect(children).toHaveLength(1)
        const child = fake<Drawn>(children[0])
        expect(child.source).toBe(textTabToAlphaTex(TEXT)!)
        expect(child.textTab!.text).toBe(TEXT)
        // Edit as alphaTex converts the block as written, in its note.
        child.textTab!.edit!()
        expect(converted).toEqual([TEXT])
    })

    it("keeps a text tab's settings lines above its alphaTex", () => {
        const { draw, children } = setup()
        draw('score', `staves: both\ntracks: 1\n\n${TEXT}`)
        const child = fake<Drawn>(children[0])
        expect(child.source).toBe(`staves: both\ntracks: 1\n${textTabToAlphaTex(TEXT)!}`)
    })

    it('offers no note changes on a canvas card (its text is no note)', () => {
        const { draw, children } = setup()
        draw('tab', TEXT, 'Board.canvas')
        draw('tab', ':4 0.6', 'Board.canvas')
        expect(children.map((c) => fake<Drawn>(c).textTab?.edit ?? null)).toEqual([null, null])
        expect(children.map((c) => fake<Drawn>(c).keepView)).toEqual([null, null])
    })

    it('shows blank staves as code, and draws the text tabs the library reads', () => {
        const { draw, children } = setup()
        const blank = 'e|--------|\nB|--------|\nG|--------|'
        // A blank stave is a template: the library reads it as empty bars, but it stays text.
        expect(draw('tab', blank)).toEqual([
            { tag: 'pre' },
            { tag: 'code', cls: 'language-tab', text: blank }
        ])
        expect(children).toHaveLength(0)
        // Drum tabs and short excerpts the library reads draw.
        draw('tab', 'HH|x-x-x-x-|\nS |----o---|\nBD|o-------|')
        draw('tab', 'A|--0--3--|')
        expect(children.map((c) => fake<Drawn>(c).textTab !== null)).toEqual([true, true])
    })

    it('writes the view kept in the block it was drawn from (#83)', () => {
        const { draw, children, kept } = setup()
        draw('score', ':4 C4 E4')
        draw('tab', TEXT)
        fake<Drawn>(children[0]).keepView!('both')
        fake<Drawn>(children[1]).keepView!('score')
        expect(kept).toEqual([':4 C4 E4 → both', `${TEXT} → score`])
    })

    it('shows a block as code when its language is turned off', () => {
        const toggles = allOn()
        const { draw } = setup(toggles)
        toggles.score = false
        expect(draw('score', ':4 C4')[1]).toEqual({
            tag: 'code',
            cls: 'language-score',
            text: ':4 C4'
        })
    })
})

describe('isTextTab', () => {
    it('tells a plain-text tab from alphaTex', () => {
        expect(isTextTab('e|---0---|\nB|---1---|\nG|---0---|\nD|---2---|')).toBe(true)
        expect(isTextTab('\\title "Song"\n.\n:4 0.6 2.5 | 3.6')).toBe(false)
    })

    it('knows text tabs the converter does not read', () => {
        const blank = 'e|--------|\nB|--------|\nG|--------|\nD|--------|\nA|--------|\nE|--------|'
        expect(isTextTab(blank)).toBe(true)
        expect(isTextTab('e|---0---| let ring\nB|---1---|\nG|---0---|')).toBe(true)
        expect(isTextTab('HH|x-x-x-x-x-x-x-x-|\nSD|----o-------o---|\nBD|o-------o-------|')).toBe(
            true
        )
        expect(isTextTab('e|--5//7--5//7--|\nB|--------------|')).toBe(true)
        expect(isTextTab('Crash |x---------------|\nHi-hat|--x-x-x-x-x-x-x-|')).toBe(true)
        expect(isTextTab('1|-----0-----|\n2|---1---1---|')).toBe(true)
    })

    it('reads alphaTex with a text tab in a comment as alphaTex', () => {
        const tex = '/*\ne|---0---|\nB|---1---|\nG|---0---|\nD|---2---|\n*/\n:4 0.6 2.5 | 3.6'
        expect(isTextTab(tex)).toBe(false)
    })
})

/** A DOM node recording what's made in it (Obsidian's createEl helpers). */
interface Node {
    tag: string
    cls?: string
    text?: string
    children: Node[]
}

function nodeEl(tag = 'div', options: { cls?: string; text?: string } = {}) {
    const node: Node = { tag, ...options, children: [] }
    const make = (t: string, o: { cls?: string; text?: string } = {}) => {
        const child = nodeEl(t, o)
        node.children.push(child.node)
        return child.el
    }
    const el = {
        isConnected: true,
        ownerDocument: { defaultView: {} },
        createEl: make,
        createDiv: (o: { cls?: string; text?: string } = {}) => make('div', o),
        createSpan: (o: { cls?: string; text?: string } = {}) => make('span', o),
        setText: (text: string) => (node.text = text),
        addClass: (cls: string) => (node.cls = `${node.cls ?? ''} ${cls}`.trim()),
        remove: () => {},
        onWindowMigrated: () => () => {}
    }
    return { el: fake<HTMLElement>(el), node }
}

const textOf = (node: Node): string[] =>
    node.children.flatMap((child) => [...(child.text ? [child.text] : []), ...textOf(child)])

describe('Tab and score errors show the block text', () => {
    it('reads the line an alphaTab message points at', () => {
        expect(errorLineOf("line 3, column 5: Unexpected token ')'")).toBe(3)
        expect(errorLineOf("staves: use tab, score or both, got 'x'")).toBeNull()
        expect(errorLineOf(null)).toBeNull()
    })

    it('folds the text under the message, the error line marked', () => {
        const { el, node } = nodeEl()
        showSource(el, ':4 0.6\n\n:4 zz.6', 'line 3, column 4: Unexpected value')
        const details = node.children[0]!
        expect(details.tag).toBe('details')
        expect(details.children[0]).toMatchObject({ tag: 'summary', text: 'Block text' })
        const lines = details.children[1]!.children[0]!.children
        expect(lines.map((l) => l.text)).toEqual([':4 0.6', ' ', ':4 zz.6'])
        expect(lines.map((l) => l.cls?.includes('mp-tab-source-error'))).toEqual([
            false,
            false,
            true
        ])
    })

    it("shows the text when alphaTab can't load", async () => {
        const processors = new Map<
            string,
            Parameters<NotationHost['registerMarkdownCodeBlockProcessor']>[1]
        >()
        const plugin: NotationHost = {
            registerMarkdownCodeBlockProcessor: (language, processor) => {
                processors.set(language, processor)
                return fake(undefined)
            },
            app: { workspace: { getLeavesOfType: () => [] } }
        }
        const tabs: TabHost = {
            runtime: fake({ module: () => Promise.reject(new Error('no alphaTab')) }),
            resolveFile: () => Promise.resolve(null)
        }
        const blocks = new NotationBlocks(
            plugin,
            allOn,
            undefined,
            () => false,
            undefined,
            undefined,
            undefined,
            tabs
        )
        blocks.sync()
        const { el, node } = nodeEl()
        const ctx = {
            sourcePath: 'Song.md',
            addChild: (child: MarkdownRenderChild) => child.onload()
        }
        void processors.get('tab')!(':4 0.6 (', el, fake(ctx))
        await Promise.resolve()
        await Promise.resolve()
        expect(textOf(node)).toEqual(['tab: no alphaTab', 'Block text', ':4 0.6 ('])
    })
})
