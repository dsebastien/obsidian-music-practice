import { describe, expect, test } from 'bun:test'
import { produce } from 'immer'
import type { App, PluginManifest } from 'obsidian'
import { MusicPracticePlugin } from './plugin'
import { DEFAULT_SETTINGS, createDefaultSettings } from './types/plugin-settings.intf'

describe('default settings', () => {
    test('constructing the plugin never freezes the shared defaults', () => {
        const plugin = new MusicPracticePlugin({} as App, {} as PluginManifest)
        expect(Object.isFrozen(plugin.settings)).toBe(true)
        expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(false)
    })

    test('loadSettings with no stored data never freezes the shared defaults', async () => {
        // Skip the constructor: its field initializer is the other test's case.
        const settings = produce(createDefaultSettings(), () => {})
        const plugin = Object.assign(
            Object.create(MusicPracticePlugin.prototype) as MusicPracticePlugin,
            {
                settings,
                loadData: (): Promise<unknown> => Promise.resolve(null)
            }
        )

        await plugin.loadSettings()

        // Immer deep-freezes what produce returns, including subtrees shared
        // with its base: producing from DEFAULT_SETTINGS froze the constant
        // for the rest of the process.
        expect(plugin.settings).toBe(settings)
        expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(false)
    })

    test('each default settings object is an independent copy', () => {
        const one = createDefaultSettings()
        one.defaultPlanMinutes = 99
        expect(createDefaultSettings().defaultPlanMinutes).toBe(30)
        expect(DEFAULT_SETTINGS.defaultPlanMinutes).toBe(30)
    })
})

describe('loading and unloading (#90)', () => {
    /** A plugin whose Obsidian calls are recorded; loadSettings runs `during` while it waits. */
    const recorded = (during: (plugin: MusicPracticePlugin) => void) => {
        const calls: string[] = []
        const record =
            (name: string) =>
            (..._args: unknown[]): void => {
                calls.push(name)
            }
        const plugin = Object.assign(
            Object.create(MusicPracticePlugin.prototype) as MusicPracticePlugin,
            {
                manifest: { id: 'music-practice', name: 'Music Practice', version: '0.0.0' },
                app: { workspace: { onLayoutReady: record('onLayoutReady') } },
                loadData: (): Promise<unknown> => Promise.resolve(null),
                registerView: record('registerView'),
                register: record('register'),
                registerEvent: record('registerEvent'),
                registerObsidianProtocolHandler: record('registerObsidianProtocolHandler'),
                registerMarkdownCodeBlockProcessor: record('registerMarkdownCodeBlockProcessor'),
                addCommand: record('addCommand'),
                addRibbonIcon: record('addRibbonIcon'),
                addStatusBarItem: record('addStatusBarItem'),
                addSettingTab: record('addSettingTab')
            }
        )
        plugin.loadSettings = (): Promise<void> => {
            during(plugin)
            return Promise.resolve()
        }
        return { plugin, calls }
    }

    test('an instance unloaded while it waits for its settings stops loading', async () => {
        // Obsidian unloads a plugin whose onload is still running (an overlapping reload). What
        // the rest of onload registered then is never removed: the protocol handler stays taken,
        // every later load fails, and an orphaned instance keeps drawing the code blocks.
        const { plugin, calls } = recorded((p) => p.onunload())
        await plugin.onload()
        expect(calls).not.toContain('registerObsidianProtocolHandler')
        expect(calls).not.toContain('registerEvent')
        expect(calls).not.toContain('addCommand')
        expect(Reflect.get(plugin, 'notation')).toBeUndefined()
    })
})
