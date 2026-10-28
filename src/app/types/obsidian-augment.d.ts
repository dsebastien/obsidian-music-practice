import 'obsidian'

/**
 * `app.plugins` ships in Obsidian's runtime but not in its published types. Declared here so other
 * plugins (Obsidian Starter Kit, Kanban Action Planner, Templater) are reached without casts; every
 * plugin found there is still treated as `unknown` and feature-detected before use. `app.commands`
 * runs another plugin's command (stopping the Kanban Action Planner timer).
 */
declare module 'obsidian' {
    interface App {
        plugins: {
            plugins: Record<string, unknown>
            enabledPlugins: Set<string>
        }
        commands: {
            executeCommandById(id: string): boolean
        }
    }
}
