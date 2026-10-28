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
