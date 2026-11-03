/**
 * Undo the last practice log: what a log changed, recorded before and after each write, and how
 * to put it back without overwriting anything changed since.
 */

/** One frontmatter key a log changed. */
export interface KeyChange {
    key: string
    /** Whether the key was there before the log. */
    existed: boolean
    before: unknown
    after: unknown
    /**
     * A list the log only appended one item to (an activity's time entries): just that item is
     * kept, not the whole list twice; `before` and `after` are then null.
     */
    appended?: unknown
}

/** The keys a log changed in one note. */
export interface FileChanges {
    path: string
    keys: KeyChange[]
}

/** What the last log did, enough to undo it. */
export interface UndoRecord {
    /** When the log was written (epoch ms). */
    at: number
    /** The session note it created, its creation time, and its body then. */
    sessionPath: string
    sessionCtime?: number
    sessionBody: string
    /** Practiced notes and the activity. */
    files: FileChanges[]
    /** The log adopted a Kanban Action Planner timer, whose entry undo leaves in place. */
    adoptedTimer: boolean
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** A copy of frontmatter values, safe to keep after the write. */
export const snapshot = (fm: Record<string, unknown>): Record<string, unknown> =>
    JSON.parse(JSON.stringify(fm)) as Record<string, unknown>

/** The keys whose values differ between two snapshots of a note's frontmatter. */
export function changedKeys(
    before: Record<string, unknown>,
    after: Record<string, unknown>
): KeyChange[] {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changes: KeyChange[] = []
    for (const key of keys) {
        if (same(before[key], after[key]) && key in before === key in after) continue
        const b = before[key]
        const a = after[key]
        if (
            Array.isArray(b) &&
            Array.isArray(a) &&
            a.length === b.length + 1 &&
            same(b, a.slice(0, -1))
        ) {
            changes.push({
                key,
                existed: true,
                before: null,
                after: null,
                appended: a[a.length - 1]
            })
            continue
        }
        changes.push({
            key,
            existed: key in before,
            before: before[key] ?? null,
            after: key in after ? after[key] : undefined
        })
    }
    return changes
}

/** The keys changed since the log (their value is no longer what the log wrote). */
/** Whether a key is as the log left it. */
function asLogged(fm: Record<string, unknown>, c: KeyChange): boolean {
    if ('appended' in c) {
        const list = fm[c.key]
        return Array.isArray(list) && list.length > 0 && same(list[list.length - 1], c.appended)
    }
    return c.after === undefined ? !(c.key in fm) : c.key in fm && same(fm[c.key], c.after)
}

/** Whether a key is already back as it was before the log (an undo that stopped halfway). */
function asBefore(fm: Record<string, unknown>, c: KeyChange): boolean {
    if ('appended' in c) return false
    return c.existed ? c.key in fm && same(fm[c.key], c.before) : !(c.key in fm)
}

/** The keys changed since the log: neither as the log left them, nor already put back. */
export function conflicts(fm: Record<string, unknown>, changes: KeyChange[]): string[] {
    return changes.filter((c) => !asLogged(fm, c) && !asBefore(fm, c)).map((c) => c.key)
}

/** Puts the keys back as they were before the log. */
export function revert(fm: Record<string, unknown>, changes: KeyChange[]): void {
    for (const c of changes) {
        // Already back (a retried undo): leave it.
        if (!asLogged(fm, c)) continue
        if ('appended' in c) (fm[c.key] as unknown[]).pop()
        else if (c.existed) fm[c.key] = c.before
        else delete fm[c.key]
    }
}

/** A note's body (after its frontmatter), the part a person edits; plugins stamp the frontmatter. */
export function bodyOf(content: string): string {
    const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content)
    return (m ? content.slice(m[0].length) : content).replace(/\r\n/g, '\n').trim()
}

/** Whether a stored value looks like an undo record (plugin data can be edited by hand). */
export function isUndoRecord(value: unknown): value is UndoRecord {
    if (!value || typeof value !== 'object') return false
    const r = value as Partial<UndoRecord>
    return (
        typeof r.at === 'number' &&
        typeof r.sessionPath === 'string' &&
        typeof r.sessionBody === 'string' &&
        typeof r.adoptedTimer === 'boolean' &&
        Array.isArray(r.files) &&
        r.files.every(
            (f) =>
                typeof f?.path === 'string' &&
                Array.isArray(f.keys) &&
                f.keys.every((k) => typeof k?.key === 'string')
        )
    )
}
