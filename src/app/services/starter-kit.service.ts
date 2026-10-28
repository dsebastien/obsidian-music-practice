import { debounce } from 'obsidian'
import type { App, EventRef, Events } from 'obsidian'
import { STARTER_KIT_PLUGIN_ID } from '../constants'

/**
 * Adapter for the optional Obsidian Starter Kit (OSK) plugin, ported from the Kanban Action
 * Planner's. OSK is the read-only source of truth for note types when installed. Its API has no
 * version guarantee, so every method is feature-detected and every result normalized; when OSK is
 * absent or its shape differs, callers get `null` / `[]` and fall back to the plugin's own model.
 */

export interface SkPropertyDefinition {
    name: string
    type?: string
    allowedValues?: unknown
}

export interface SkNoteType {
    id: string
    name: string
    properties?: SkPropertyDefinition[]
    associatedFolder?: string | null
    templatePath?: string | null
    noteNamePrefix?: string | null
    noteNameSuffix?: string | null
    /** The type's mandatory tags. */
    tags?: string[]
}

export type SkStatusRole = 'backlog' | 'scheduled' | 'active' | 'waiting'

export interface SkStatusValue {
    value: string
    done: boolean
    role: SkStatusRole | null
    /** Date property stamped when a note enters this status. */
    stampsDate: string | null
}

export interface SkResolvedStatus {
    property: string
    /** True when configured on the type; false = OSK's own fallback (a `status` field). */
    explicit: boolean
    values: SkStatusValue[]
}

export interface SkAffixes {
    prefix: string
    suffix: string
    prefixOptional: boolean
    suffixOptional: boolean
}

interface SkApiLike {
    listNoteTypes?: () => unknown
    listGlobalProperties?: () => unknown
    getNoteTypeStatus?: (ref: string) => unknown
    resolveNoteTypeFolder?: (ref: string, date?: string) => unknown
    resolveNoteTypeAffixes?: (ref: string, date?: string) => unknown
    getSettings?: () => unknown
}

/** Normalize either a raw value or an `ApiResult<T>` wrapper into `T | null`. */
function unwrap<T>(res: unknown): T | null {
    if (res === null || res === undefined) return null
    if (typeof res === 'object' && 'success' in res) {
        const r = res as { success: boolean; data?: T }
        return r.success ? (r.data ?? null) : null
    }
    return res as T
}

function getApi(app: App): SkApiLike | null {
    const plugin = app.plugins?.plugins?.[STARTER_KIT_PLUGIN_ID] as { api?: unknown } | undefined
    const api = plugin?.api as SkApiLike | undefined
    return api && typeof api.listNoteTypes === 'function' ? api : null
}

/** True when OSK is installed, enabled, and exposes its API. */
export function isStarterKitAvailable(app: App): boolean {
    return getApi(app) !== null
}

/**
 * True when OSK runs its own automation rules ("Run automation rules" on). It then stamps the
 * mastery dates itself, so this plugin must not (one writer per rule).
 */
export function starterKitRunsAutomations(app: App): boolean {
    const api = getApi(app)
    if (!api?.getSettings) return false
    try {
        const s = unwrap<{ globalSettings?: { enableAutomations?: unknown } }>(api.getSettings())
        return s?.globalSettings?.enableAutomations === true
    } catch {
        return false
    }
}

export function listNoteTypes(app: App): SkNoteType[] {
    const api = getApi(app)
    if (!api?.listNoteTypes) return []
    try {
        const types = unwrap<SkNoteType[]>(api.listNoteTypes())
        return Array.isArray(types) ? types.filter((t) => typeof t?.id === 'string') : []
    } catch {
        return []
    }
}

/** Properties OSK applies to every note type (review fields, description…), by name. */
export function listGlobalPropertyNames(app: App): string[] {
    const api = getApi(app)
    if (!api?.listGlobalProperties) return []
    try {
        const props = unwrap<{ name?: unknown }[]>(api.listGlobalProperties())
        return Array.isArray(props)
            ? props.map((p) => p?.name).filter((n): n is string => typeof n === 'string')
            : []
    } catch {
        return []
    }
}

export function getNoteTypeStatus(app: App, id: string): SkResolvedStatus | null {
    const api = getApi(app)
    if (!api?.getNoteTypeStatus) return null
    try {
        const raw = unwrap<Partial<SkResolvedStatus>>(api.getNoteTypeStatus(id))
        if (!raw || typeof raw.property !== 'string' || !Array.isArray(raw.values)) return null
        return {
            property: raw.property,
            explicit: raw.explicit === true,
            values: raw.values
                .filter((v): v is SkStatusValue => typeof v?.value === 'string')
                .map((v) => ({
                    value: v.value,
                    done: v.done === true,
                    role:
                        v.role === 'backlog' ||
                        v.role === 'scheduled' ||
                        v.role === 'active' ||
                        v.role === 'waiting'
                            ? v.role
                            : null,
                    stampsDate:
                        typeof v.stampsDate === 'string' && v.stampsDate ? v.stampsDate : null
                }))
        }
    } catch {
        return null
    }
}

/** The type's folder for a date (`{{year}}`-style tokens expanded); null when none. */
export function resolveNoteTypeFolder(app: App, id: string, date?: string): string | null {
    const api = getApi(app)
    if (!api?.resolveNoteTypeFolder) return null
    try {
        const data = unwrap<{ folder?: unknown }>(api.resolveNoteTypeFolder(id, date))
        return typeof data?.folder === 'string' && data.folder.trim() ? data.folder.trim() : null
    } catch {
        return null
    }
}

/** The type's name prefix and suffix for a date; null when unavailable. */
export function resolveNoteTypeAffixes(app: App, id: string, date?: string): SkAffixes | null {
    const api = getApi(app)
    if (!api?.resolveNoteTypeAffixes) return null
    try {
        const d = unwrap<Partial<SkAffixes>>(api.resolveNoteTypeAffixes(id, date))
        if (!d) return null
        return {
            prefix: typeof d.prefix === 'string' ? d.prefix : '',
            suffix: typeof d.suffix === 'string' ? d.suffix : '',
            prefixOptional: d.prefixOptional === true,
            suffixOptional: d.suffixOptional === true
        }
    } catch {
        return null
    }
}

/** OSK triggers this workspace event after any note type change. */
export const STARTER_KIT_NOTE_TYPES_CHANGED = 'obsidian-starter-kit:note-types-changed'

/** Subscribe to OSK note type changes, debounced so a burst triggers one rebuild. */
export function onStarterKitNoteTypesChanged(
    workspace: Pick<Events, 'on'>,
    onChange: () => void,
    wait = 300
): EventRef {
    const debounced = debounce(onChange, wait, false)
    return workspace.on(STARTER_KIT_NOTE_TYPES_CHANGED, () => debounced())
}
