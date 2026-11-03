import { describe, expect, it } from 'bun:test'
import { SETTLE, isSettled, waitUntilSettled } from './settle'

const clockAt = (start: number) => {
    let now = start
    return {
        now: () => now,
        sleep: (ms: number) => {
            now += ms
            return Promise.resolve()
        }
    }
}

describe('settle: a new note before it is trashed', () => {
    it('is settled 2 s after its creation and 1 s after its last write', () => {
        expect(isSettled({ ctime: 0, mtime: 0 }, 1_999)).toBe(false)
        expect(isSettled({ ctime: 0, mtime: 0 }, 2_000)).toBe(true)
        expect(isSettled({ ctime: 0, mtime: 1_500 }, 2_000)).toBe(false)
        expect(isSettled({ ctime: 0, mtime: 1_500 }, 2_500)).toBe(true)
    })

    it('waits until settled, and returns at once for an old note or a gone one', async () => {
        const clock = clockAt(0)
        expect(await waitUntilSettled(() => ({ ctime: 0, mtime: 0 }), clock)).toBe(true)
        expect(clock.now()).toBe(2_000)
        const old = clockAt(60_000)
        expect(await waitUntilSettled(() => ({ ctime: 0, mtime: 0 }), old)).toBe(true)
        expect(old.now()).toBe(60_000)
        expect(await waitUntilSettled(() => null, clockAt(0))).toBe(true)
    })

    it('gives up after the longest wait when the note keeps being written', async () => {
        const clock = clockAt(0)
        expect(await waitUntilSettled(() => ({ ctime: 0, mtime: clock.now() }), clock)).toBe(false)
        expect(clock.now()).toBe(SETTLE.maxWaitMs)
    })
})
