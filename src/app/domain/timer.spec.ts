import { describe, expect, it } from 'bun:test'
import {
    clockTime,
    discardTimerMessage,
    formatDuration,
    formatElapsed,
    isStaleTimer,
    LONG_TIMER_MS,
    minutesBetween,
    staleTimerLabel,
    timerAge,
    timerElapsed,
    timerMinutes,
    timerRunningMessage
} from './timer'

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

describe('forgotten timers', () => {
    const H = 60 * 60_000
    const now = Date.UTC(2026, 10, 3, 12, 0)
    const started = (ago: number, pause?: { at: number; ms?: number }) => ({
        startedAt: now - ago,
        pausedAt: pause ? now - pause.at : 0,
        pausedMs: pause?.ms ?? 0
    })

    it('writes a span in words', () => {
        expect(formatDuration(30_000)).toBe('less than a minute')
        expect(formatDuration(12 * 60_000)).toBe('12 min')
        expect(formatDuration(4 * H + 12 * 60_000)).toBe('4 h 12 min')
        expect(formatDuration(4 * H)).toBe('4 h')
        expect(formatDuration(24 * H)).toBe('1 day')
        expect(formatDuration(5 * 24 * H + 3 * H + 20 * 60_000)).toBe('5 days 3 h')
    })

    it('measures the age on the clock, pauses included', () => {
        // Paused 12 minutes after its start, five days ago: little practice, but forgotten.
        const paused = started(5 * 24 * H + 3 * H, { at: 5 * 24 * H + 3 * H - 12 * 60_000 })
        expect(timerAge(paused, now)).toBe(5 * 24 * H + 3 * H)
        expect(timerElapsed(paused, now)).toBe(12 * 60_000)
        expect(isStaleTimer(paused, now)).toBe(true)
        expect(isStaleTimer(started(LONG_TIMER_MS), now)).toBe(false)
        expect(isStaleTimer(started(LONG_TIMER_MS + 1), now)).toBe(true)
        expect(isStaleTimer({ startedAt: 0, pausedAt: 0, pausedMs: 0 }, now)).toBe(false)
        expect(timerAge({ startedAt: 0, pausedAt: 0, pausedMs: 0 }, now)).toBe(0)
    })

    it('labels a forgotten timer only', () => {
        expect(staleTimerLabel(started(30 * 60_000), now)).toBeNull()
        expect(staleTimerLabel(started(5 * 24 * H + 3 * H), now)).toBe(
            'Started 5 days 3 h ago: forgotten? Discard or log it.'
        )
    })

    it('asks before a discard, with how long it ran', () => {
        expect(discardTimerMessage(started(25 * 60_000), now)).toBe(
            'Discard the practice timer (25 min)? Nothing is logged.'
        )
        const paused = started(5 * 24 * H + 3 * H, { at: 5 * 24 * H + 3 * H - 12 * 60_000 })
        expect(discardTimerMessage(paused, now)).toBe(
            'Discard the practice timer (5 days 3 h, 12 min of practice)? Nothing is logged.'
        )
    })

    it('says how to discard when a start is refused', () => {
        expect(timerRunningMessage(started(5 * 24 * H + 3 * H), now)).toBe(
            'The practice timer is already running (started 5 days 3 h ago). Stop it to log the session, or run Discard practice timer.'
        )
        expect(timerRunningMessage(started(10 * 60_000), now)).toBe(
            'The practice timer is already running (started 10 min ago). Stop it to log the session, or run Discard practice timer.'
        )
    })
})
