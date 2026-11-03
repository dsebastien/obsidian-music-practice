/** Elapsed time for the status bar: `m:ss`, or `h:mm:ss` past an hour. */
export function formatElapsed(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = String(total % 60).padStart(2, '0')
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Whole minutes practiced between two instants, at least 1. */
export const minutesBetween = (startMs: number, endMs: number): number =>
    Math.max(1, Math.round((endMs - startMs) / 60_000))

/** Local `HH:MM` of an instant. */
export function clockTime(ms: number): string {
    const d = new Date(ms)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** The practice timer as stored: its start, and the time spent paused. */
export interface TimerState {
    /** Epoch ms; 0 when no timer runs. */
    startedAt: number
    /** Epoch ms of the pause; 0 when running. */
    pausedAt: number
    /** Paused time before the current pause. */
    pausedMs: number
}

/** Time practiced so far: from the start to now (or to the pause), minus the pauses. */
export const timerElapsed = (timer: TimerState, now: number): number =>
    timer.startedAt ? Math.max(0, (timer.pausedAt || now) - timer.startedAt - timer.pausedMs) : 0

/** Whole minutes practiced, at least 1. */
export const timerMinutes = (timer: TimerState, now: number): number =>
    Math.max(1, Math.round(timerElapsed(timer, now) / 60_000))

/**
 * A timer that started longer ago than this (on the clock, pauses included) was most likely
 * forgotten: the panel and the status bar say so, and Stop warns before logging its minutes.
 */
export const LONG_TIMER_MS = 4 * 60 * 60_000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A span in words: "12 min", "4 h 12 min", "5 days 3 h", "less than a minute". */
export function formatDuration(ms: number): string {
    const total = Math.max(0, ms)
    if (total < MINUTE) return 'less than a minute'
    const days = Math.floor(total / DAY)
    const hours = Math.floor((total % DAY) / HOUR)
    const minutes = Math.floor((total % HOUR) / MINUTE)
    if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'}${hours ? ` ${hours} h` : ''}`
    if (hours > 0) return `${hours} h${minutes ? ` ${minutes} min` : ''}`
    return `${minutes} min`
}

/** Time on the clock since the timer started, pauses included; 0 when no timer runs. */
export const timerAge = (timer: TimerState, now: number): number =>
    timer.startedAt ? Math.max(0, now - timer.startedAt) : 0

/** Whether a timer started so long ago that it was most likely forgotten. */
export const isStaleTimer = (timer: TimerState, now: number): boolean =>
    timerAge(timer, now) > LONG_TIMER_MS

/** "Started 5 days 3 h ago: forgotten? Discard or log it.", or null for a recent timer. */
export function staleTimerLabel(timer: TimerState, now: number): string | null {
    if (!isStaleTimer(timer, now)) return null
    return `Started ${formatDuration(timerAge(timer, now))} ago: forgotten? Discard or log it.`
}

/** The question before a discard, with how long the timer ran (and its practice when paused). */
export function discardTimerMessage(timer: TimerState, now: number): string {
    const age = timerAge(timer, now)
    const practiced = timerElapsed(timer, now)
    const extra = age - practiced >= MINUTE ? `, ${formatDuration(practiced)} of practice` : ''
    return `Discard the practice timer (${formatDuration(age)}${extra})? Nothing is logged.`
}

/** Why a new timer can't start, and how to get rid of the running one. */
export const timerRunningMessage = (timer: TimerState, now: number): string =>
    `The practice timer is already running (started ${formatDuration(timerAge(timer, now))} ago). Stop it to log the session, or run Discard practice timer.`
