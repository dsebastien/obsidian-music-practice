import { describe, expect, it } from 'bun:test'
import { clockTime, formatElapsed, minutesBetween } from './timer'

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
