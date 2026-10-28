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

/** Tags of a frontmatter `tags` value, without `#`. */
export function tagsOf(frontmatter: Record<string, unknown>): string[] {
    const raw = frontmatter['tags']
    const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw]
    return list.map((t) => String(t).replace(/^#/, '').trim()).filter((t) => t.length > 0)
}

/** The learning type a note belongs to: it carries every tag of the type and the status property. */
export function learningTypeOf(
    types: readonly LearningType[],
    frontmatter: Record<string, unknown>
): LearningType | null {
    const tags = new Set(tagsOf(frontmatter))
    return (
        types.find((t) => t.tags.every((g) => tags.has(g)) && t.statusProperty in frontmatter) ??
        null
    )
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
