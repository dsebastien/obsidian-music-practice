/** Local calendar date as YYYY-MM-DD. */
export function isoDate(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** Whole days from one date to another (YYYY-MM-DD, a longer datetime is cut to its date). */
export function daysBetween(from: string, to: string): number {
    const start = Date.parse(`${from.substring(0, 10)}T00:00:00Z`)
    const end = Date.parse(`${to.substring(0, 10)}T00:00:00Z`)
    return Math.floor((end - start) / 86_400_000)
}
