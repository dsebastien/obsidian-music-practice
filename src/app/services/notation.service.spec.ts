import { describe, expect, it } from 'bun:test'
import { NotationBlocks, processorExists } from './notation.service'
import type { NotationHost, NotationToggles } from './notation.service'

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
