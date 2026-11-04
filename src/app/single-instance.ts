/**
 * One live instance of the plugin per window (#90). Obsidian's plugin manager can start a second
 * instance while the first one is still loading (two reloads close together: an update, a quick
 * disable and enable, Hot Reload). It then tracks only the second one and never unloads the
 * first, which keeps its view type, protocol handler and code block processors: the second one
 * fails to register them. So an instance claims the App first, and unloads an earlier one
 * that is still live before it registers anything.
 */

/** What a plugin instance must offer to be replaced (Obsidian's Component). */
export interface Unloadable {
    unload(): void
}

const KEY = Symbol.for('music-practice.live-instance')

type Holder = Record<symbol, Unloadable | undefined>

/**
 * Makes `instance` the live one in `holder` (Obsidian's App: one per window, shared by every instance of the plugin), and unloads the one it
 * replaces. Returns the replaced instance, or null.
 */
export function claimInstance(instance: Unloadable, holder: object): Unloadable | null {
    const slots = holder as Holder
    const previous = slots[KEY]
    // Claimed before the unload: the earlier instance's onunload must not release the new claim.
    slots[KEY] = instance
    if (!previous || previous === instance) return null
    previous.unload()
    return previous
}

/** Frees the claim, when `instance` still holds it. */
export function releaseInstance(instance: Unloadable, holder: object): void {
    const slots = holder as Holder
    if (slots[KEY] === instance) delete slots[KEY]
}
