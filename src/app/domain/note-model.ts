import { SESSION_TAG_ROOT } from '../constants'
import type { FieldNames } from './fields'
import { levelOf } from './mastery'
import type { PracticeRules } from './rules'

/** A note type whose notes are learning items (chords, scales, arrangements…). */
export interface LearningType {
    id: string
    name: string
    /** The type tag, `type/<domain>/<subject>/<kind>` (or `type/<domain>/<kind>`). */
    typeTag: string
    domain: string
    /** The instrument or subject; null for subject-agnostic types (`type/music/exercise`). */
    subject: string | null
    kind: string
    /** Every tag a note must carry to belong to the type. */
    tags: string[]
    statusProperty: string
    /** The type's own status values ("20 - Learning"…), in order. */
    statusValues: string[]
    /** Status value → the date property entering it stamps. */
    stamps: Record<string, string>
    /** Properties the type defines; the plugin writes only these. */
    fields: Set<string>
    /** The type's highest priority number (current focus), or null without a priority field. */
    topPriority: number | null
}

/** A note type whose notes record practice sessions of a subject. */
export interface SessionType {
    id: string
    name: string
    /** `type/session/<domain>/<subject>`. */
    typeTag: string
    domain: string
    subject: string
    tags: string[]
    fields: Set<string>
    /** The type's template (vault path), rendered headlessly for new sessions. */
    templatePath: string | null
    /** Allowed values of the properties that constrain them (session quality…). */
    allowedValues: Record<string, string[]>
    /**
     * Folder and name affixes with tokens ({year}, {Subject}…), for types the plugin defines itself.
     * Absent for Obsidian Starter Kit types, which resolve their own.
     */
    naming?: { folder: string; prefix: string; suffix: string }
}

export interface NoteModel {
    learningTypes: LearningType[]
    sessionTypes: SessionType[]
}

/** A note type as the model needs it, whatever its source (OSK or the plugin's own settings). */
export interface TypeDescriptor {
    id: string
    name: string
    tags: string[]
    properties: { name: string; allowedValues?: unknown }[]
    /** The explicit status, when configured. */
    status: { property: string; values: string[]; stamps?: Record<string, string> } | null
    templatePath?: string | null
}

const toStrings = (raw: unknown): string[] =>
    Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []

/**
 * Learning types: an explicit status using the mastery scale (both the "want" and the "mastered"
 * levels present) plus the last-practiced field. Session types: a `type/session/<domain>/<subject>`
 * tag.
 */
export function buildNoteModel(
    types: readonly TypeDescriptor[],
    rules: PracticeRules,
    fields: FieldNames
): NoteModel {
    const learningTypes: LearningType[] = []
    const sessionTypes: SessionType[] = []
    for (const t of types) {
        const props = new Set(t.properties.map((p) => p.name))
        const sessionTag = t.tags.find((g) => g.startsWith(SESSION_TAG_ROOT))
        if (sessionTag) {
            const [domain, subject] = sessionTag.slice(SESSION_TAG_ROOT.length).split('/')
            if (domain && subject)
                sessionTypes.push({
                    id: t.id,
                    name: t.name,
                    typeTag: sessionTag,
                    domain,
                    subject,
                    tags: [...t.tags],
                    fields: props,
                    templatePath: t.templatePath ?? null,
                    allowedValues: Object.fromEntries(
                        t.properties
                            .map((p) => [p.name, toStrings(p.allowedValues)] as const)
                            .filter(([, v]) => v.length > 0)
                    )
                })
            continue
        }
        if (!t.status || !props.has(fields.lastPracticed)) continue
        const levels = new Set(t.status.values.map(levelOf))
        if (!levels.has(rules.levels.want) || !levels.has(rules.levels.mastered)) continue
        const typeTag = t.tags.find((g) => g.startsWith('type/') && g.split('/').length >= 3)
        if (!typeTag) continue
        const segments = typeTag.split('/').slice(1)
        const domain = segments[0]!
        const kind = segments[segments.length - 1]!
        const subject = segments.length >= 3 ? segments[1]! : null
        const priorities = toStrings(
            t.properties.find((p) => p.name === fields.priority)?.allowedValues
        )
            .map(levelOf)
            .filter((n): n is number => n !== null && n < rules.score.priorityTbd)
        learningTypes.push({
            id: t.id,
            name: t.name,
            typeTag,
            domain,
            subject,
            kind,
            tags: [...t.tags],
            statusProperty: t.status.property,
            statusValues: [...t.status.values],
            stamps: { ...(t.status.stamps ?? {}) },
            fields: props,
            topPriority: priorities.length ? Math.min(...priorities) : null
        })
    }
    return { learningTypes, sessionTypes }
}

/**
 * The session type for a learning type: same domain and subject (`type/<domain>/<subject>/<kind>`
 * pairs with `type/session/<domain>/<subject>`). Null for subject-agnostic types or when none exists.
 */
export function sessionTypeFor(model: NoteModel, learning: LearningType): SessionType | null {
    if (!learning.subject) return null
    return (
        model.sessionTypes.find(
            (s) => s.domain === learning.domain && s.subject === learning.subject
        ) ?? null
    )
}
