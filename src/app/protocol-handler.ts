import type { ObsidianProtocolHandler, Plugin } from 'obsidian'

/**
 * Registers the plugin's obsidian:// handler. When an earlier instance of the plugin still holds
 * the action (an overlapping reload before #90 was fixed), Obsidian throws: say so and go on
 * loading, so one leftover doesn't stop the commands and the notation blocks. Returns whether the
 * handler was registered.
 */
export function registerProtocolHandler(
    plugin: Pick<Plugin, 'registerObsidianProtocolHandler'>,
    action: string,
    handler: ObsidianProtocolHandler,
    warn: (message: string) => void
): boolean {
    try {
        plugin.registerObsidianProtocolHandler(action, handler)
        return true
    } catch (error) {
        warn(
            `obsidian://${action} links stay with an earlier instance of the plugin until Obsidian reloads: ${error instanceof Error ? error.message : String(error)}`
        )
        return false
    }
}
