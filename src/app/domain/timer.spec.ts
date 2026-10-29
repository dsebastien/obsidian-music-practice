import { describe, expect, it } from 'bun:test'
import { clockTime, formatElapsed, minutesBetween, timerElapsed, timerMinutes } from './timer'

describe('timer', () => {
    it('formats elapsed time', () => {
        expect(formatElapsed(0)).toBe('0:00')
        expect(formatElapsed(65_000)).toBe('1:05')
        expect(formatElapsed(3_725_000)).toBe('1:02:05')
        expect(formatElapsed(-5)).toBe('0:00')
    })

    it('rounds to whole minutes, at least one', () => {
        expect(minutesBetween(0, 20_000)).toBe(1)
        expect(minutesBetween(0, 29 * 60_000 + 40_000)).toBe(30)
    })

    it('gives the local clock time', () => {
        expect(clockTime(new Date(2026, 9, 28, 7, 5).getTime())).toBe('07:05')
    })
})

describe('timer pauses', () => {
    it('counts practiced time only', () => {
        const t = { startedAt: 1000, pausedAt: 0, pausedMs: 0 }
        expect(timerElapsed(t, 61_000)).toBe(60_000)
        expect(timerElapsed({ ...t, pausedAt: 31_000 }, 999_000)).toBe(30_000)
        expect(timerElapsed({ ...t, pausedMs: 20_000 }, 61_000)).toBe(40_000)
        expect(timerMinutes({ ...t, pausedMs: 20_000 }, 61_000)).toBe(1)
        expect(timerElapsed({ startedAt: 0, pausedAt: 0, pausedMs: 0 }, 5)).toBe(0)
    })
})
