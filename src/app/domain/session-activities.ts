/**
 * Which activity a session counts for: an activity lists the session note types that count for it
 * in `session_types` (note type names, "guitar-practice-sessions"). One activity per type: a type
 * listed by two activities is a conflict and maps to neither. The same rule as the vault's learning
 * skills (`osk-learning-shared`, "Which activity a session counts for"). Pure: no Obsidian imports.
 */
import { prop } from './activity-time'

/** An activity note as the mapping needs it. */
export interface ActivityNote {
    path: string
    /** The note's name (its file name without `.md`). */
    name: string
    frontmatter: Record<string, unknown>
}

/** The session types an activity lists: trimmed text values, a single value read as a list. */
export function sessionTypesOf(
    fm: Record<string, unknown> | undefined | null,
    field: string
): string[] {
    const raw = prop(fm, field)
    const values: unknown[] = Array.isArray(raw)
        ? (raw as unknown[])
        : raw === undefined || raw === null
          ? []
          : [raw]
    return values
        .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''))
        .filter(Boolean)
}

/** Which activity a session type maps to. */
export type SessionTypeMapping =
    | { kind: 'mapped'; activity: ActivityNote }
    | { kind: 'conflict'; activities: ActivityNote[] }
    | { kind: 'unmapped' }

/** The activity whose `session_types` lists this type; two or more: a conflict, none mapped. */
export function activityForSessionType(
    activities: readonly ActivityNote[],
    typeName: string,
    field: string
): SessionTypeMapping {
    const owners = activities.filter((a) => sessionTypesOf(a.frontmatter, field).includes(typeName))
    if (owners.length === 1) return { kind: 'mapped', activity: owners[0]! }
    if (owners.length > 1) return { kind: 'conflict', activities: owners }
    return { kind: 'unmapped' }
}

/** Whether any of these notes lists a session type (a vault that uses `session_types`). */
export function usesSessionTypes(
    frontmatters: Iterable<Record<string, unknown> | undefined | null>,
    field: string
): boolean {
    for (const fm of frontmatters) if (sessionTypesOf(fm, field).length > 0) return true
    return false
}

/** The `session_types` value with this type added (at the end, once). */
export function withSessionType(current: unknown, typeName: string): string[] {
    const list = sessionTypesOf({ v: current }, 'v')
    return list.includes(typeName) ? list : [...list, typeName]
}

/** The `session_types` value with this type removed. */
export function withoutSessionType(current: unknown, typeName: string): string[] {
    return sessionTypesOf({ v: current }, 'v').filter((t) => t !== typeName)
}

const titleCase = (s: string): string =>
    s.replace(
        /(^|[\s_-])(\w)/g,
        (_m, sep: string, c: string) => `${sep === '_' ? ' ' : sep}${c.toUpperCase()}`
    )

/** The activity name the plugin proposes for a subject: the pattern with `{subject}` ("Learn Guitar"). */
export function proposedActivityName(pattern: string, subject: string): string {
    return pattern.replaceAll('{subject}', titleCase(subject)).trim()
}

const words = (s: string): string[] =>
    s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1)

/**
 * Activities, closest first to a proposed name and a subject: those whose name holds the subject,
 * then the most words in common with the proposed name, then by name.
 */
export function closestActivities<T extends { name: string }>(
    activities: readonly T[],
    proposed: string,
    subject: string
): T[] {
    const wanted = new Set(words(proposed))
    const subj = subject.toLowerCase()
    const score = (a: T) =>
        (a.name.toLowerCase().includes(subj) ? 100 : 0) +
        words(a.name).filter((w) => wanted.has(w)).length
    return [...activities].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
}
