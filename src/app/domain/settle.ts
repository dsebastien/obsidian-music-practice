/**
 * A new note is not finished when it is created: plugins that run on file creation (Templater's
 * "trigger on file creation") write it again about a second later. Trashing it before that write
 * lets the write create the file again. Pure: no Obsidian imports; the clock is passed in.
 */

/** When a note counts as settled, and how long to wait for it at most. */
export interface SettleOptions {
    /** Time since the note was created. */
    afterCreateMs: number
    /** Time since its last write. */
    quietMs: number
    /** The longest wait; past it, the caller goes on anyway. */
    maxWaitMs: number
    /** How often to look again. */
    pollMs: number
    /** How long to watch a trashed note's path for a late write that creates it again. */
    watchMs: number
}

export const SETTLE: SettleOptions = {
    afterCreateMs: 2_000,
    quietMs: 1_000,
    maxWaitMs: 5_000,
    pollMs: 100,
    watchMs: 5_000
}

export interface Clock {
    now(): number
    sleep(ms: number): Promise<void>
}

/** A note's creation and last write times (epoch ms), or null when it no longer exists. */
export type StatOf = () => { ctime: number; mtime: number } | null

/** Whether a note is settled at `now`. */
export function isSettled(
    stat: { ctime: number; mtime: number },
    now: number,
    options: SettleOptions = SETTLE
): boolean {
    return now - stat.ctime >= options.afterCreateMs && now - stat.mtime >= options.quietMs
}

/**
 * Wait until the note is settled. `true`: settled (or gone); `false`: still being written when the
 * longest wait ran out. A note created long ago returns at once.
 */
export async function waitUntilSettled(
    stat: StatOf,
    clock: Clock,
    options: SettleOptions = SETTLE
): Promise<boolean> {
    const deadline = clock.now() + options.maxWaitMs
    for (;;) {
        const s = stat()
        if (!s || isSettled(s, clock.now(), options)) return true
        if (clock.now() >= deadline) return false
        await clock.sleep(options.pollMs)
    }
}
