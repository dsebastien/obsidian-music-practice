import { describe, expect, test } from 'bun:test'
import { registerProtocolHandler } from './protocol-handler'

describe('registerProtocolHandler (#90)', () => {
    test('registers the handler', () => {
        const actions: string[] = []
        const warnings: string[] = []
        const ok = registerProtocolHandler(
            { registerObsidianProtocolHandler: (action) => void actions.push(action) },
            'music-practice',
            () => {},
            (m) => void warnings.push(m)
        )
        expect(ok).toBe(true)
        expect(actions).toEqual(['music-practice'])
        expect(warnings).toEqual([])
    })

    test('an action an earlier instance still holds is a warning, not a failed load', () => {
        const warnings: string[] = []
        const ok = registerProtocolHandler(
            {
                registerObsidianProtocolHandler: () => {
                    throw new Error('Action "music-practice" is already registered as a handler.')
                }
            },
            'music-practice',
            () => {},
            (m) => void warnings.push(m)
        )
        expect(ok).toBe(false)
        expect(warnings).toEqual([
            'obsidian://music-practice links stay with an earlier instance of the plugin until Obsidian reloads: Action "music-practice" is already registered as a handler.'
        ])
    })
})
