import { describe, expect, it } from 'bun:test'
import type { App, TFile } from 'obsidian'
import { createDefaultFieldNames } from '../domain/fields'
import type { FileChanges } from '../domain/undo'
import { revert } from '../domain/undo'
import type { LogRequest } from '../domain/log'
import { PracticeLogService } from './practice-log.service'
import type { ActivityResult, LogContext } from './practice-log.service'

const fields = createDefaultFieldNames()
const ACTIVITY = 'Activities/Learn Guitar (Activity).md'
const SESSION = 'Sessions/2026-11-03 (Guitar Practice Session).md'
const OLD = 'Sessions/2026-11-01 (Guitar Practice Session).md'

const fake = <T>(value: unknown): T => value as T
const file = (path: string) =>
    fake<TFile>({ path, basename: path.substring(path.lastIndexOf('/') + 1).replace(/\.md$/, '') })

/** A vault of an activity and session notes, with Obsidian's link index already up to date. */
function vault(activity: Record<string, unknown>) {
    const notes: Record<string, Record<string, unknown>> = {
        [ACTIVITY]: activity,
        [SESSION]: {
            tags: ['type/session/music/guitar'],
            date: '2026-11-03',
            time_spent: 30,
            related_activities: ['[[Learn Guitar (Activity)]]']
        },
        [OLD]: {
            tags: ['type/session/music/guitar'],
            date: '2026-11-01',
            time_spent: 20,
            related_activities: ['[[Learn Guitar (Activity)]]']
        }
    }
    const byName = (link: string) =>
        Object.keys(notes).find((p) => file(p).basename === link) ?? null
    const app = fake<App>({
        vault: { getFileByPath: (p: string) => (notes[p] ? file(p) : null) },
        metadataCache: {
            resolvedLinks: { [SESSION]: { [ACTIVITY]: 1 }, [OLD]: { [ACTIVITY]: 1 } },
            getFileCache: (f: TFile) => ({ frontmatter: notes[f.path] }),
            getFirstLinkpathDest: (link: string) => {
                const p = byName(link)
                return p ? file(p) : null
            }
        },
        fileManager: {
            processFrontMatter: (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
                fn(notes[f.path]!)
                return Promise.resolve()
            }
        }
    })
    const context = () => ({ fields }) as LogContext
    const service = new PracticeLogService(app, () => ({}) as never, {} as never, context)
    const recompute = (adoptedStartMs: number | null, changes: FileChanges[]) =>
        fake<{
            recomputeActivity: (
                a: TFile,
                s: TFile,
                t: number | null,
                c: FileChanges[]
            ) => Promise<ActivityResult>
        }>(service).recomputeActivity(file(ACTIVITY), file(SESSION), adoptedStartMs, changes)
    return { notes, recompute }
}

describe('practice log: the activity time', () => {
    it('recomputes from the linked sessions, adds no time entry, and undoes', async () => {
        const { notes, recompute } = vault({ time_spent: 20, date_last_session: '2026-11-01' })
        const changes: FileChanges[] = []
        expect(await recompute(null, changes)).toBe('updated')
        expect(notes[ACTIVITY]).toEqual({ time_spent: 50, date_last_session: '2026-11-03' })
        expect(await recompute(null, [])).toBe('unchanged')
        revert(notes[ACTIVITY]!, changes[0]!.keys)
        expect(notes[ACTIVITY]).toEqual({ time_spent: 20, date_last_session: '2026-11-01' })
    })

    it("removes an adopted timer's entry, and undo puts it back", async () => {
        const start = new Date('2026-11-03T18:00:00').getTime()
        const timer = {
            startTime: '2026-11-03T18:00:05',
            endTime: '2026-11-03T18:30:00',
            description: 'Practice'
        }
        const { notes, recompute } = vault({ time_spent: 50, time_entries: [timer] })
        const changes: FileChanges[] = []
        expect(await recompute(start, changes)).toBe('updated')
        expect(notes[ACTIVITY]).toEqual({
            time_spent: 50,
            time_entries: [],
            date_last_session: '2026-11-03'
        })
        revert(notes[ACTIVITY]!, changes[0]!.keys)
        expect(notes[ACTIVITY]!['time_entries']).toEqual([timer])
    })

    it('leaves an activity whose time entries are not a list alone', async () => {
        const { notes, recompute } = vault({ time_spent: 5, time_entries: 'legacy' })
        expect(await recompute(null, [])).toBe('skipped')
        expect(notes[ACTIVITY]).toEqual({ time_spent: 5, time_entries: 'legacy' })
    })
})

/**
 * A vault where a plugin writes every new note again a while after its creation (Templater's
 * "trigger on file creation"): a write to a trashed note creates the file again.
 */
function lateWriteVault(lateWriteAt: number) {
    let now = 0
    const due: { at: number; run: () => void }[] = []
    /** Runs what is due up to `ms` from now, in time order, then sets the clock there. */
    const advance = (ms: number) => {
        const until = now + ms
        for (;;) {
            due.sort((a, b) => a.at - b.at)
            const next = due[0]
            if (!next || next.at > until) break
            due.shift()
            now = next.at
            next.run()
        }
        now = until
    }
    // Short waits (undo's polling) pass at once; long ones (the watch) wait for the spec to move
    // time forward, as real timers do.
    const clock = {
        now: () => now,
        sleep: (ms: number) => {
            if (ms <= 1_000) {
                advance(ms)
                return Promise.resolve()
            }
            return new Promise<void>((resolve) => due.push({ at: now + ms, run: resolve }))
        }
    }
    const content = '---\ntime_spent: 2\n---\n\nPracticed G.'
    const files = new Map<string, { content: string; ctime: number; mtime: number }>()
    // The log added date_last_session to the activity (the obsidian mock reads no frontmatter from
    // disk, so a key the log added is what passes undo's conflict check here).
    const fm: Record<string, Record<string, unknown>> = {
        [ACTIVITY]: { time_spent: 20, date_last_session: '2026-11-03' }
    }
    const listeners: ((f: TFile) => void)[] = []
    const tfile = (path: string) =>
        fake<TFile>({
            ...file(path),
            get stat() {
                return files.get(path) ?? { ctime: 0, mtime: 0 }
            }
        })
    files.set(SESSION, { content, ctime: 0, mtime: 0 })
    let trashed = 0
    let trashedAt = -1
    let frontmatterWrites = 0
    /** The next log creates its session note at the same path, with the same body. */
    const nextLogCreates = () => {
        files.set(SESSION, { content, ctime: now, mtime: now })
        for (const l of listeners) l(tfile(SESSION))
    }
    due.push({
        at: lateWriteAt,
        run: () => {
            const existed = files.get(SESSION)
            files.set(SESSION, {
                content,
                ctime: existed?.ctime ?? lateWriteAt,
                mtime: lateWriteAt
            })
            if (!existed) for (const l of listeners) l(tfile(SESSION))
        }
    })
    const app = fake<App>({
        vault: {
            getFileByPath: (p: string) => (files.has(p) || fm[p] ? tfile(p) : null),
            read: (f: TFile) => Promise.resolve(files.get(f.path)?.content ?? '---\n---\n'),
            on: (_name: string, cb: (f: TFile) => void) => {
                listeners.push(cb)
                return cb
            },
            offref: (ref: (f: TFile) => void) => listeners.splice(listeners.indexOf(ref), 1)
        },
        metadataCache: { getFileCache: (f: TFile) => ({ frontmatter: fm[f.path] }) },
        fileManager: {
            processFrontMatter: (f: TFile, fn: (x: Record<string, unknown>) => void) => {
                frontmatterWrites++
                fn(fm[f.path]!)
                return Promise.resolve()
            },
            trashFile: (f: TFile) => {
                trashed++
                if (trashedAt < 0) trashedAt = now
                files.delete(f.path)
                return Promise.resolve()
            }
        }
    })
    const context = () => ({ fields }) as LogContext
    const service = new PracticeLogService(
        app,
        () => ({}) as never,
        {} as never,
        context,
        () => {},
        clock
    )
    const record = {
        at: 0,
        sessionPath: SESSION,
        sessionCtime: 0,
        sessionBody: 'Practiced G.',
        files: [
            {
                path: ACTIVITY,
                keys: [
                    { key: 'date_last_session', existed: false, before: null, after: '2026-11-03' }
                ]
            }
        ],
        adoptedTimer: false
    }
    const settle = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve()
        advance(10_000)
        for (let i = 0; i < 10; i++) await Promise.resolve()
    }
    return {
        service,
        record,
        files,
        fm,
        settle,
        trashed: () => trashed,
        trashedAt: () => trashedAt,
        frontmatterWrites: () => frontmatterWrites,
        nextLogCreates,
        advance,
        clock
    }
}

describe('practice log: undo right after a log', () => {
    it('waits for the late write before trashing, so the session note stays gone', async () => {
        const v = lateWriteVault(1_000)
        const result = await v.service.undo(v.record)
        expect(result.ok).toBe(true)
        await v.settle()
        expect(v.files.has(SESSION)).toBe(false)
        expect(v.fm[ACTIVITY]).toEqual({ time_spent: 20 })
    })

    it('trashes the session note again when a later write creates it again', async () => {
        const v = lateWriteVault(3_500)
        const result = await v.service.undo(v.record)
        expect(result.ok).toBe(true)
        const writes = v.frontmatterWrites()
        await v.settle()
        expect(v.files.has(SESSION)).toBe(false)
        expect(v.trashed()).toBe(2)
        // The watch only trashes the note: the practiced notes were put back before undo returned.
        expect(v.frontmatterWrites()).toBe(writes)
        expect(v.fm[ACTIVITY]).toEqual({ time_spent: 20 })
    })

    it("a log right after an undo ends that undo's watch: its new session note stays", async () => {
        const v = lateWriteVault(60_000)
        expect((await v.service.undo(v.record)).ok).toBe(true)
        // The next log: an invalid request is refused, but it still ends the watch first.
        await v.service
            .log(fake<LogRequest>({ date: 'not a date', minutes: 0, items: [] }))
            .catch(() => {})
        v.nextLogCreates()
        for (let i = 0; i < 10; i++) await Promise.resolve()
        expect(v.files.has(SESSION)).toBe(true)
        expect(v.trashed()).toBe(1)
    })

    it('two log and undo cycles within the watch: each undo trashes only its own note', async () => {
        const v = lateWriteVault(60_000)
        expect((await v.service.undo(v.record)).ok).toBe(true)
        await v.service
            .log(fake<LogRequest>({ date: 'not a date', minutes: 0, items: [] }))
            .catch(() => {})
        v.nextLogCreates()
        for (let i = 0; i < 10; i++) await Promise.resolve()
        expect(v.files.has(SESSION)).toBe(true)
        // The second undo: its own note, created just now.
        v.advance(4_000)
        const second = { ...v.record, sessionCtime: v.files.get(SESSION)!.ctime }
        v.fm[ACTIVITY]!['date_last_session'] = '2026-11-03'
        expect((await v.service.undo(second)).ok).toBe(true)
        await v.settle()
        expect(v.files.has(SESSION)).toBe(false)
        expect(v.trashed()).toBe(2)
        expect(v.fm[ACTIVITY]).toEqual({ time_spent: 20 })
    })

    it('does not wait for a session note created long ago', async () => {
        const v = lateWriteVault(1_000)
        v.advance(60_000)
        const before = v.clock.now()
        expect((await v.service.undo(v.record)).ok).toBe(true)
        expect(v.trashedAt() - before).toBeLessThan(100)
    })
})
