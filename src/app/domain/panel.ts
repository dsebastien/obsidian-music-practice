/** The practice panel's session list (#37): what to practice now, kept until it's logged. */

export interface PanelItem {
    path: string
    /** Ticked off. */
    done: boolean
    /** A BPM reached (the −/+ nudges), for the log. */
    bpm?: number
}

/** Panel items from stored data, anything malformed dropped, each path once. */
export function panelItemsFrom(value: unknown): PanelItem[] {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    const items: PanelItem[] = []
    for (const v of value as unknown[]) {
        if (!v || typeof v !== 'object') continue
        const { path, done, bpm } = v as Record<string, unknown>
        if (typeof path !== 'string' || !path || seen.has(path)) continue
        seen.add(path)
        items.push({
            path,
            done: done === true,
            ...(typeof bpm === 'number' && Number.isInteger(bpm) && bpm > 0 ? { bpm } : {})
        })
    }
    return items
}

/** The list with these paths added at the end (those already there stay as they are). */
export const withPaths = (items: readonly PanelItem[], paths: readonly string[]): PanelItem[] => [
    ...items,
    ...paths
        .filter((p, i) => paths.indexOf(p) === i && !items.some((it) => it.path === p))
        .map((path) => ({ path, done: false }))
]

/** What to log: the ticked items, or all of them when none is ticked; their BPMs by path. */
export function toLog(items: readonly PanelItem[]): {
    paths: string[]
    bpms: Record<string, number>
} {
    const ticked = items.filter((i) => i.done)
    const chosen = ticked.length ? ticked : items
    const bpms: Record<string, number> = {}
    for (const i of chosen) if (i.bpm !== undefined) bpms[i.path] = i.bpm
    return { paths: chosen.map((i) => i.path), bpms }
}
