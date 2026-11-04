import { describe, expect, test } from 'bun:test'
import { claimInstance, releaseInstance, type Unloadable } from './single-instance'

const instance = (log: string[], name: string, holder?: object): Unloadable => ({
    unload: () => {
        log.push(`unload ${name}`)
        if (holder) releaseInstance(instance(log, name), holder)
    }
})

describe('one live instance per window (#90)', () => {
    test('the first instance claims the window and unloads nothing', () => {
        const holder = {}
        const log: string[] = []
        expect(claimInstance(instance(log, 'a'), holder)).toBeNull()
        expect(log).toEqual([])
    })

    test('a second instance unloads the first, which keeps no claim', () => {
        const holder = {}
        const log: string[] = []
        const a: Unloadable = {
            unload: () => {
                log.push('unload a')
                releaseInstance(a, holder)
            }
        }
        const b = instance(log, 'b')
        claimInstance(a, holder)
        expect(claimInstance(b, holder)).toBe(a)
        expect(log).toEqual(['unload a'])
        // a released only its own claim: b still holds the window, so a third replaces b.
        const c = instance(log, 'c')
        expect(claimInstance(c, holder)).toBe(b)
        expect(log).toEqual(['unload a', 'unload b'])
    })

    test('an instance unloaded normally frees the window', () => {
        const holder = {}
        const log: string[] = []
        const a = instance(log, 'a')
        claimInstance(a, holder)
        releaseInstance(a, holder)
        expect(claimInstance(instance(log, 'b'), holder)).toBeNull()
        expect(log).toEqual([])
    })

    test('claiming twice is a no-op', () => {
        const holder = {}
        const log: string[] = []
        const a = instance(log, 'a')
        claimInstance(a, holder)
        expect(claimInstance(a, holder)).toBeNull()
        expect(log).toEqual([])
    })
})
