import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'

/**
 * Settings controls are keyed by their path in the settings ("rules.review.firstInterval"). The
 * default at that path decides how a control value is read and parsed: numbers stay numbers,
 * lists are edited as comma-separated text ("15, 50, 20, 15").
 */

type Tree = Record<string, unknown>

export function getPath(tree: unknown, key: string): unknown {
    return key
        .split('.')
        .reduce<unknown>(
            (node, part) => (node && typeof node === 'object' ? (node as Tree)[part] : undefined),
            tree
        )
}

function setPath(tree: object, key: string, value: unknown): void {
    const parts = key.split('.')
    const last = parts.pop()!
    let node = tree as Tree
    for (const part of parts) node = node[part] as Tree
    node[last] = value
}

/** The control value for a key: lists as comma-separated text, everything else as stored. */
export function readSetting(settings: PluginSettings, key: string): unknown {
    const value = getPath(settings, key)
    return Array.isArray(value) ? value.join(', ') : value
}

export type Parsed = { ok: true; value: unknown } | { ok: false; error: string }

/** Parse a control value by the type of the default at its path. */
export function parseSetting(key: string, raw: unknown): Parsed {
    const def = getPath(DEFAULT_SETTINGS, key)
    if (def === undefined) return { ok: false, error: `Unknown setting "${key}".` }
    if (typeof def === 'number') {
        const n = typeof raw === 'number' ? raw : Number(raw)
        return Number.isFinite(n) && n >= 0
            ? { ok: true, value: n }
            : { ok: false, error: 'Enter a number.' }
    }
    if (typeof def === 'string')
        return typeof raw === 'string'
            ? { ok: true, value: raw }
            : { ok: false, error: 'Enter text.' }
    if (Array.isArray(def)) {
        const parts = (typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '')
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
        if (typeof def[0] === 'number') {
            const numbers = parts.map(Number)
            if (numbers.length !== def.length || numbers.some((n) => !Number.isFinite(n) || n < 0))
                return { ok: false, error: `Enter ${def.length} numbers separated by commas.` }
            return { ok: true, value: numbers }
        }
        return parts.length
            ? { ok: true, value: parts }
            : { ok: false, error: 'Enter at least one value.' }
    }
    return { ok: false, error: `"${key}" can't be edited here.` }
}

const LEVEL_KEYS = ['want', 'learning', 'slow', 'tempo', 'rusty', 'mastered'] as const

/** Checks across fields, on the settings as they would be after the change. Undefined when valid. */
export function crossCheck(next: PluginSettings): string | undefined {
    const split = next.rules.plan.split
    if (split.reduce((a, b) => a + b, 0) !== 100) return 'The four blocks must add up to 100 %.'
    const levels = LEVEL_KEYS.map((k) => next.rules.levels[k])
    if (levels.some((n, i) => i > 0 && n <= levels[i - 1]!))
        return 'Levels must increase: want < learning < slow < tempo < rusty < mastered.'
    if (
        next.rules.review.firstInterval < 1 ||
        next.rules.review.maxInterval < next.rules.review.firstInterval
    )
        return 'The maximum review interval must be at least the first interval (1 day or more).'
    return undefined
}

/** Validate a control value against its type and the cross-field rules; the error, or undefined. */
export function validateSetting(
    settings: PluginSettings,
    key: string,
    raw: unknown
): string | undefined {
    const parsed = parseSetting(key, raw)
    if (!parsed.ok) return parsed.error
    const next = structuredClone(settings)
    setPath(next, key, parsed.value)
    return crossCheck(next)
}

/** Write a parsed value into a settings draft (Immer). */
export function writeSetting(draft: PluginSettings, key: string, value: unknown): void {
    setPath(draft, key, value)
}
