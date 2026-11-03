/**
 * Obsidian URI actions (#47): `obsidian://music-practice?do=<action>[&minutes=<n>]`, for
 * shortcuts outside Obsidian (phone shortcuts, a Stream Deck, an NFC tag). Obsidian keeps the
 * handler's name in `action`, so the action is `do`; a query `action` that isn't the handler's
 * name is read too. Pure: no Obsidian imports.
 */

/** The handler's name: `obsidian://music-practice`. */
export const URI_HANDLER = 'music-practice'

/** What a URI can do. Only the timer writes without a modal; the rest open the usual modals. */
export const URI_ACTIONS = ['start-timer', 'stop-timer', 'log', 'practice-next', 'plan'] as const

export type UriAction = (typeof URI_ACTIONS)[number]

/** Actions that take `minutes`: Log practice's minutes, the plan's length. */
const WITH_MINUTES: readonly UriAction[] = ['log', 'plan']

export const URI_MAX_MINUTES = 1440

export type UriRequest =
    | { ok: true; action: UriAction; minutes: number | null }
    | { ok: false; error: string }

/** Parameters Obsidian adds itself, never an error. */
const OBSIDIAN_PARAMS = new Set(['action', 'vault', 'do', 'minutes'])

/** Reads and checks a URI's parameters; anything unexpected is an error that says what to write. */
export function parseUriRequest(params: Record<string, string | undefined>): UriRequest {
    const queryAction = params['action'] !== URI_HANDLER ? params['action'] : undefined
    const raw = (params['do'] ?? queryAction ?? '').trim()
    const list = URI_ACTIONS.join(', ')
    if (!raw) return { ok: false, error: `Music Practice URI: add do=<action> (${list}).` }
    const action = URI_ACTIONS.find((a) => a === raw)
    if (!action)
        return { ok: false, error: `Music Practice URI: unknown action "${raw}". Use ${list}.` }
    const unknown = Object.keys(params).filter((k) => !OBSIDIAN_PARAMS.has(k))
    if (unknown.length)
        return {
            ok: false,
            error: `Music Practice URI: unknown parameter ${unknown.map((k) => `"${k}"`).join(', ')}.`
        }
    const text = params['minutes']
    if (text === undefined) return { ok: true, action, minutes: null }
    if (!WITH_MINUTES.includes(action))
        return { ok: false, error: `Music Practice URI: minutes only work with log and plan.` }
    const minutes = /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : NaN
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > URI_MAX_MINUTES)
        return {
            ok: false,
            error: `Music Practice URI: minutes must be a whole number from 1 to ${URI_MAX_MINUTES}, not "${text}".`
        }
    return { ok: true, action, minutes }
}

/** A URI for an action, for the guide and the settings ("obsidian://music-practice?do=log&minutes=30"). */
export function uriFor(action: UriAction, minutes?: number, vault?: string): string {
    // encodeURIComponent, not URLSearchParams: Obsidian reads %20 for a space, not "+".
    const parts: [string, string][] = []
    if (vault) parts.push(['vault', vault])
    parts.push(['do', action])
    if (minutes !== undefined) parts.push(['minutes', String(minutes)])
    const query = parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `obsidian://${URI_HANDLER}?${query}`
}
