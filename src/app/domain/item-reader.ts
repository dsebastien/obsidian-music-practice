import type { FieldNames } from './fields'
import { levelOf } from './mastery'
import type { LearningType } from './note-model'
import type { LearningItemInput } from './practice'

/** What the reader needs from a note, independent of Obsidian's cache types. */
export interface NoteSnapshot {
    path: string
    basename: string
    frontmatter: Record<string, unknown>
    /** Resolved link targets (note names) from frontmatter properties, by property name. */
    propertyLinks: Record<string, string[]>
    /** Every resolved link target in the note, frontmatter and body. */
    allLinks: string[]
}

/**
 * Tags of a frontmatter `tags` value, without `#`, lower-cased (Obsidian matches tags regardless of
 * case). A list, or text with tags separated by commas or spaces, as Obsidian accepts both.
 */
export function tagsOf(frontmatter: Record<string, unknown>): string[] {
    const raw = frontmatter['tags'] ?? frontmatter['tag']
    const list: unknown[] = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? raw.split(/[,\s]+/)
          : raw === undefined || raw === null
            ? []
            : [raw]
    return list
        .map((t) => (typeof t === 'string' || typeof t === 'number' ? String(t) : ''))
        .map((t) => t.replace(/^#/, '').trim().toLowerCase())
        .filter((t) => t.length > 0)
}

/**
 * The learning type a note belongs to: it carries every tag of the type and the status property.
 * When several types match, the most specific one (the most tags, then the longest type tag) wins.
 */
export function learningTypeOf(
    types: readonly LearningType[],
    frontmatter: Record<string, unknown>
): LearningType | null {
    const tags = new Set(tagsOf(frontmatter))
    const matches = types.filter(
        (t) => t.statusProperty in frontmatter && t.tags.every((g) => tags.has(g.toLowerCase()))
    )
    matches.sort((a, b) => b.tags.length - a.tags.length || b.typeTag.length - a.typeTag.length)
    return matches[0] ?? null
}

const num = (value: unknown): number | null => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    return Number.isFinite(n) && (typeof value !== 'string' || value.trim() !== '') ? n : null
}

const date = (value: unknown): string | null => {
    const s = typeof value === 'string' ? value.trim() : ''
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.substring(0, 10) : null
}

/** A learning note → the engine's input. Fields the type doesn't define read as empty. */
export function toLearningItemInput(
    note: NoteSnapshot,
    type: LearningType,
    fields: FieldNames
): LearningItemInput {
    const get = (name: string): unknown =>
        type.fields.has(name) ? note.frontmatter[name] : undefined
    const priority = levelOf(get(fields.priority))
    return {
        path: note.path,
        name: note.basename,
        kind: type.kind,
        typeId: type.id,
        level: levelOf(note.frontmatter[type.statusProperty]),
        priority,
        topPriority: type.topPriority,
        lastPracticed: date(get(fields.lastPracticed)),
        lastReviewed: date(get(fields.lastReviewed)),
        reviewInterval: num(get(fields.reviewInterval)),
        reviewCount: num(get(fields.reviewCount)),
        bpmCurrent: num(get(fields.bpmCurrent)),
        bpmTarget: num(get(fields.bpmTarget)),
        prerequisites: type.fields.has(fields.prerequisites)
            ? (note.propertyLinks[fields.prerequisites] ?? [])
            : [],
        links: note.allLinks
    }
}

/**
 * A note's tags with `add` appended when missing (compared regardless of case and `#`). Existing
 * tags are kept as written, also when the note lists them as text.
 */
export function mergeTags(existing: unknown, add: readonly string[]): string[] {
    const current: string[] = Array.isArray(existing)
        ? existing
              .map((t) => (typeof t === 'string' || typeof t === 'number' ? String(t) : ''))
              .filter(Boolean)
        : typeof existing === 'string'
          ? existing.split(/[,\s]+/).filter(Boolean)
          : []
    const have = new Set(current.map((t) => t.replace(/^#/, '').toLowerCase()))
    return [...current, ...add.filter((t) => !have.has(t.replace(/^#/, '').toLowerCase()))]
}
