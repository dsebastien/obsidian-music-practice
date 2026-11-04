import { describe, expect, it, mock } from 'bun:test'
import * as obsidian from 'obsidian'
import type { App, TFile } from 'obsidian'
import { createDefaultFieldNames } from '../domain/fields'
import { tagsOf } from '../domain/item-reader'
import { levelOf } from '../domain/mastery'
import type { LearningType, NoteModel, SessionType } from '../domain/note-model'
import { computeItems } from '../domain/practice'
import { createDefaultRules } from '../domain/rules'
import type { FileChanges } from '../domain/undo'
import { mergeChanges, revert } from '../domain/undo'
import type { LogRequest } from '../domain/log'
import type { ItemRepository } from './item-repository'
import { PracticeLogService } from './practice-log.service'
import type { ActivityResult, LogContext } from './practice-log.service'
import { testVault } from './test-vault'

// Undo reads the notes from disk: the test vault writes their frontmatter as JSON (valid YAML).
void mock.module('obsidian', () => ({
    ...obsidian,
    getFrontMatterInfo: (content: string) => {
        const m = /^---\n([\s\S]*?)\n---/.exec(content)
        return { exists: Boolean(m), frontmatter: m?.[1] ?? '' }
    },
    parseYaml: (text: string): unknown => {
        try {
            return JSON.parse(text)
        } catch {
            return {}
        }
    }
}))

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
            ) => Promise<{ result: ActivityResult }>
        }>(service)
            .recomputeActivity(file(ACTIVITY), file(SESSION), adoptedStartMs, changes)
            .then((r) => r.result)
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

// ─── A whole log, in an in-memory vault ───────────────────────────────────────────────

const DAY = '2026-10-28'
const AM = 'Chords/A Minor.md'
const EM = 'Chords/E Minor.md'
const GUITAR_ACTIVITY = 'Activities/Learn Guitar.md'
const OLD_SESSION = 'Sessions/2026-10-01 (Guitar Practice Session).md'
const MASTERY = [
    '10 - Want to learn',
    '20 - Learning',
    '30 - Can play slowly',
    '40 - Can play at tempo',
    '50 - Rusty',
    '60 - Mastered'
]
const chordType: LearningType = {
    id: 'gc',
    name: 'Guitar Chords',
    typeTag: 'type/music/guitar/chord',
    domain: 'music',
    subject: 'guitar',
    kind: 'chord',
    tags: ['type/music/guitar/chord'],
    statusProperty: 'mastery',
    statusValues: MASTERY,
    stamps: {},
    fields: new Set([
        'mastery',
        'date_last_practiced',
        'time_spent',
        'last_reviewed',
        'review_interval',
        'review_count'
    ]),
    topPriority: 10,
    templatePath: null,
    allowedValues: {}
}
const sessionType: SessionType = {
    id: 'gs',
    name: 'Guitar Practice Sessions',
    typeName: 'guitar-practice-sessions',
    typeTag: 'type/session/music/guitar',
    domain: 'music',
    subject: 'guitar',
    tags: ['type/session/music/guitar'],
    fields: new Set([
        'date',
        'start_time',
        'time_spent',
        'session_quality',
        'practiced',
        'practiced_minutes',
        'related_activities',
        'tags'
    ]),
    templatePath: null,
    allowedValues: {},
    naming: { folder: 'Sessions', prefix: '', suffix: ' (Guitar Practice Session)' }
}
const chord = (over: Record<string, unknown> = {}) => ({
    tags: ['type/music/guitar/chord'],
    mastery: '20 - Learning',
    ...over
})

/** The Obsidian Starter Kit's API, just enough for its activities type. */
const starterKit = (folder = 'Activities') => ({
    'obsidian-starter-kit': {
        api: {
            listNoteTypes: () => [
                {
                    id: 'nt-act',
                    name: 'Activities',
                    tags: ['zone/actions', 'type/activity'],
                    associatedFolder: folder,
                    templatePath: null
                }
            ],
            resolveNoteTypeAffixes: () => ({
                prefix: '',
                suffix: ' (Activity)',
                prefixOptional: false,
                suffixOptional: false
            }),
            getNoteTypeStatus: () => ({
                property: 'status',
                explicit: true,
                values: [
                    { value: '99 - Idea', done: false, role: 'backlog', stampsDate: null },
                    { value: '30 - Active', done: false, role: 'active', stampsDate: null }
                ]
            })
        }
    }
})

function logVault(
    initial: Record<string, Record<string, unknown>>,
    plugins: Record<string, unknown> = {}
) {
    const v = testVault(initial, plugins)
    const model: NoteModel = { learningTypes: [chordType], sessionTypes: [sessionType] }
    const repo = fake<ItemRepository>({
        items: () =>
            computeItems(
                [...v.notes.entries()]
                    .filter(([, n]) => tagsOf(n.fm).includes('type/music/guitar/chord'))
                    .map(([path, n]) => ({
                        path,
                        name: path.substring(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
                        kind: 'chord',
                        typeId: 'gc',
                        level: levelOf(n.fm['mastery']),
                        priority: null,
                        topPriority: 10,
                        lastPracticed: null,
                        lastReviewed: (n.fm['last_reviewed'] as string | undefined) ?? null,
                        reviewInterval: (n.fm['review_interval'] as number | undefined) ?? null,
                        reviewCount: (n.fm['review_count'] as number | undefined) ?? null,
                        bpmCurrent: null,
                        bpmTarget: null,
                        prerequisites: [],
                        links: []
                    })),
                DAY,
                createDefaultRules()
            )
    })
    const context = (): LogContext => ({
        rules: createDefaultRules(),
        fields,
        notesHeading: 'Notes',
        activityName: 'Learn {subject}'
    })
    // Old notes: undo doesn't wait for them to settle.
    const clock = { now: () => 1e12, sleep: () => Promise.resolve() }
    const service = new PracticeLogService(
        v.app,
        () => model,
        repo,
        context,
        () => {},
        clock
    )
    const sessions = () => [...v.notes.keys()].filter((p) => p.startsWith('Sessions/'))
    return { ...v, service, sessions }
}

/** The message a promise is rejected with ('' when it resolves). */
const failure = (p: Promise<unknown>): Promise<string> =>
    p.then(
        () => '',
        (e: unknown) => (e instanceof Error ? e.message : String(e))
    )

const request = (over: Partial<LogRequest> = {}): LogRequest => ({
    date: DAY,
    minutes: 25,
    items: [{ path: AM }, { path: EM }],
    ...over
})

describe('practice log: minutes per item and item time', () => {
    const vaultNotes = () => ({
        [AM]: chord({ time_spent: 0 }),
        [EM]: chord({ time_spent: 40 }),
        // An older session (before minutes per item): E Minor got its 40 minutes from it.
        [OLD_SESSION]: {
            tags: ['type/session/music/guitar'],
            date: '2026-10-01',
            time_spent: 40,
            practiced: ['[[E Minor]]'],
            related_activities: ['[[Learn Guitar]]']
        },
        [GUITAR_ACTIVITY]: { tags: ['type/activity'], time_spent: 40 }
    })

    it('writes the session note first, with the minutes each item got', async () => {
        const v = logVault(vaultNotes())
        const result = await v.service.log(request())
        expect(result.reused).toBe(false)
        const session = v.notes.get(result.sessionPath)!.fm
        expect(session['practiced']).toEqual(['[[A Minor]]', '[[E Minor]]'])
        expect(session['practiced_minutes']).toEqual(['13 [[A Minor]]', '12 [[E Minor]]'])
        expect(session['related_activities']).toEqual(['[[Learn Guitar]]'])
        // The session note is created and written before any item.
        const first = (p: string) => v.writes.indexOf(p)
        expect(first(result.sessionPath)).toBeLessThan(first(AM))
        expect(v.writes.lastIndexOf(result.sessionPath)).toBeLessThan(first(AM))
        expect(first(AM)).toBeLessThan(first(GUITAR_ACTIVITY))
    })

    it("recomputes each item's time from its session notes, never adding to it", async () => {
        const v = logVault(vaultNotes())
        await v.service.log(request())
        expect(v.notes.get(AM)!.fm['time_spent']).toBe(13)
        // 40 from the old session (listed in practiced only) + 12 now.
        expect(v.notes.get(EM)!.fm['time_spent']).toBe(52)
        // The activity: recomputed from its linked sessions (40 + 25).
        expect(v.notes.get(GUITAR_ACTIVITY)!.fm['time_spent']).toBe(65)
    })

    it('leaves a higher item time as it is and reports it', async () => {
        const v = logVault({ ...vaultNotes(), [AM]: chord({ time_spent: 500 }) })
        const result = await v.service.log(request())
        expect(v.notes.get(AM)!.fm['time_spent']).toBe(500)
        expect(result.warnings.join('\n')).toMatch(/A Minor: "time_spent" is 500 min/)
    })

    it('leaves an item time that is not a number alone', async () => {
        const v = logVault({ ...vaultNotes(), [AM]: chord({ time_spent: '1h' }) })
        const result = await v.service.log(request())
        expect(v.notes.get(AM)!.fm['time_spent']).toBe('1h')
        expect(result.warnings.join('\n')).toMatch(/isn't a number/)
    })

    it('skips the minutes per item when the session type has no such field', async () => {
        const fieldsWithout = new Set(
            [...sessionType.fields].filter((f) => f !== 'practiced_minutes')
        )
        const own = { ...sessionType, fields: fieldsWithout }
        const v = logVault(vaultNotes())
        const model: NoteModel = { learningTypes: [chordType], sessionTypes: [own] }
        Object.assign(v.service, { model: () => model })
        const result = await v.service.log(request())
        expect(v.notes.get(result.sessionPath)!.fm).not.toHaveProperty('practiced_minutes')
        // The even share of the session's minutes, as before.
        expect(v.notes.get(AM)!.fm['time_spent']).toBe(13)
    })
})

describe('practice log: a run again of the same log', () => {
    const notes = () => ({
        [AM]: chord({
            mastery: '30 - Can play slowly',
            review_interval: 3,
            review_count: 1,
            last_reviewed: '2026-10-20'
        }),
        [EM]: chord(),
        [GUITAR_ACTIVITY]: { tags: ['type/activity'] }
    })
    const reviewed = () =>
        request({ items: [{ path: AM, review: 'good' }, { path: EM }], startTime: '18:30' })

    it('reuses the session note and counts nothing twice', async () => {
        const v = logVault(notes())
        const first = await v.service.log(reviewed())
        const state = () => JSON.stringify([...v.notes.entries()].map(([p, n]) => [p, n.fm]))
        const after = state()
        const again = await v.service.log(reviewed())
        expect(again.reused).toBe(true)
        expect(again.sessionPath).toBe(first.sessionPath)
        expect(v.sessions()).toHaveLength(1)
        // The review counted once; the times and the activity didn't move.
        expect(v.notes.get(AM)!.fm['review_count']).toBe(2)
        expect(v.notes.get(AM)!.fm['review_interval']).toBe(6)
        expect(state()).toBe(after)
    })

    it('reuses it for the same items in another order, not for other minutes or start', async () => {
        const v = logVault(notes())
        await v.service.log(request())
        const swapped = await v.service.log(request({ items: [{ path: EM }, { path: AM }] }))
        expect(swapped.reused).toBe(true)
        expect((await v.service.log(request({ minutes: 30 }))).reused).toBe(false)
        expect((await v.service.log(request({ startTime: '07:00' }))).reused).toBe(false)
        expect(v.sessions()).toHaveLength(3)
    })

    it('undoing a run again keeps the session note it reused', async () => {
        const v = logVault(notes())
        const first = await v.service.log(request())
        const again = await v.service.log(request())
        expect(again.undo.reused).toBe(true)
        expect((await v.service.undo(again.undo)).ok).toBe(true)
        expect(v.notes.has(first.sessionPath)).toBe(true)
    })
})

describe('practice log: which activity', () => {
    const base = () => ({
        [AM]: chord(),
        [EM]: chord()
    })

    it('without the Starter Kit and session_types: the note named after the setting', async () => {
        const v = logVault({ ...base(), [GUITAR_ACTIVITY]: { tags: ['type/activity'] } })
        expect(v.service.activities.choiceFor(sessionType)).toMatchObject({ kind: 'fallback' })
        const result = await v.service.log(request())
        expect(result.activity?.path).toBe(GUITAR_ACTIVITY)
    })

    it('the activity whose session_types lists the session type', async () => {
        const v = logVault(
            {
                ...base(),
                'Activities/Learn Guitar (Activity).md': { tags: ['type/activity'] },
                'Activities/Guitar Club (Activity).md': {
                    tags: ['type/activity'],
                    session_types: ['guitar-practice-sessions']
                }
            },
            starterKit()
        )
        const choice = v.service.activities.choiceFor(sessionType)
        expect(choice.kind).toBe('mapped')
        const result = await v.service.log(request())
        expect(result.activity?.path).toBe('Activities/Guitar Club (Activity).md')
        expect(v.notes.get(result.sessionPath)!.fm['related_activities']).toEqual([
            '[[Guitar Club (Activity)]]'
        ])
    })

    it('ignores archived activities (outside the activities folder)', () => {
        const v = logVault(
            {
                ...base(),
                'Archives/Old Guitar (Activity).md': {
                    tags: ['type/activity'],
                    session_types: ['guitar-practice-sessions']
                },
                'Activities/Learn Piano (Activity).md': { tags: ['type/activity'] }
            },
            starterKit()
        )
        const choice = v.service.activities.choiceFor(sessionType)
        expect(choice.kind).toBe('ask')
        if (choice.kind === 'ask')
            expect(choice.candidates.map((f) => f.path)).toEqual([
                'Activities/Learn Piano (Activity).md'
            ])
    })

    it('asks when no activity lists the type, and logs for none through the API', async () => {
        const v = logVault(
            {
                ...base(),
                'Activities/Run (Activity).md': { tags: ['type/activity'] },
                'Activities/Guitar Lessons (Activity).md': { tags: ['type/activity'] }
            },
            starterKit()
        )
        const choice = v.service.activities.choiceFor(sessionType)
        expect(choice).toMatchObject({
            kind: 'ask',
            typeName: 'guitar-practice-sessions',
            proposedName: 'Learn Guitar',
            conflict: []
        })
        if (choice.kind === 'ask')
            expect(choice.candidates.map((f) => f.basename)).toEqual([
                'Guitar Lessons (Activity)',
                'Run (Activity)'
            ])
        const result = await v.service.log(request())
        expect(result.activity).toBeNull()
        expect(v.notes.get(result.sessionPath)!.fm).not.toHaveProperty('related_activities')
        expect(result.warnings.join('\n')).toMatch(/No activity lists guitar-practice-sessions/)
        // Nothing was created.
        expect([...v.notes.keys()].filter((p) => p.startsWith('Activities/'))).toHaveLength(2)
    })

    it('maps a type listed by two activities to neither, and asks', () => {
        const listed = { tags: ['type/activity'], session_types: ['guitar-practice-sessions'] }
        const v = logVault(
            {
                ...base(),
                'Activities/A (Activity).md': listed,
                'Activities/B (Activity).md': { ...listed }
            },
            starterKit()
        )
        const choice = v.service.activities.choiceFor(sessionType)
        expect(choice.kind).toBe('ask')
        if (choice.kind === 'ask')
            expect(choice.conflict.map((f) => f.basename)).toEqual(['A (Activity)', 'B (Activity)'])
    })

    it('asks too in a standalone vault that uses session_types', () => {
        const v = logVault({
            ...base(),
            [GUITAR_ACTIVITY]: { tags: ['type/activity'] },
            'Activities/Run.md': { tags: ['type/activity'], session_types: 'running-sessions' }
        })
        expect(v.service.activities.choiceFor(sessionType).kind).toBe('ask')
    })

    it('counts the type for the activity the user picks, moving it from the others', async () => {
        const listed = { tags: ['type/activity'], session_types: ['guitar-practice-sessions'] }
        const v = logVault(
            {
                ...base(),
                'Activities/A (Activity).md': listed,
                'Activities/B (Activity).md': {
                    tags: ['type/activity'],
                    session_types: ['guitar-practice-sessions', 'piano-practice-sessions']
                }
            },
            starterKit()
        )
        const result = await v.service.log(request(), { mapTo: 'Activities/A (Activity).md' })
        expect(result.activity?.path).toBe('Activities/A (Activity).md')
        expect(v.notes.get('Activities/B (Activity).md')!.fm['session_types']).toEqual([
            'piano-practice-sessions'
        ])
        expect(v.service.activities.choiceFor(sessionType).kind).toBe('mapped')
    })

    it('creates the activity the user names, listing the type, and links the session', async () => {
        const v = logVault(base(), starterKit())
        const result = await v.service.log(request(), { createActivity: 'Learn Guitar' })
        const path = 'Activities/Learn Guitar (Activity).md'
        expect(result.createdActivity).toBe(path)
        expect(v.notes.get(path)!.fm).toMatchObject({
            tags: ['zone/actions', 'type/activity'],
            session_types: ['guitar-practice-sessions'],
            status: '30 - Active',
            time_spent: 25
        })
        expect(v.notes.get(result.sessionPath)!.fm['related_activities']).toEqual([
            '[[Learn Guitar (Activity)]]'
        ])
        expect(v.service.activities.choiceFor(sessionType).kind).toBe('mapped')
    })

    it('refuses to create an activity that exists, before writing anything', async () => {
        const v = logVault(
            { ...base(), 'Activities/Learn Guitar (Activity).md': { tags: ['type/activity'] } },
            starterKit()
        )
        expect(await failure(v.service.log(request(), { createActivity: 'Learn Guitar' }))).toMatch(
            /already exists/
        )
        expect(await failure(v.service.log(request(), { createActivity: 'A/B' }))).toMatch(
            /can't hold/
        )
        expect(v.sessions()).toHaveLength(0)
    })

    it('takes the activity a request names, or none', async () => {
        const v = logVault({ ...base(), [GUITAR_ACTIVITY]: { tags: ['type/activity'] } })
        expect((await v.service.log(request({ activity: 'Learn Guitar' }))).activity?.path).toBe(
            GUITAR_ACTIVITY
        )
        const none = await v.service.log(request({ activity: null, minutes: 5 }))
        expect(none.activity).toBeNull()
        expect(await failure(v.service.log(request({ activity: 'Nowhere', minutes: 7 })))).toMatch(
            /No activity note/
        )
        expect(v.sessions()).toHaveLength(2)
    })
})

describe('practice log: an activity storing more than it counts', () => {
    const notes = () => ({
        [AM]: chord(),
        [EM]: chord(),
        [GUITAR_ACTIVITY]: {
            tags: ['type/activity'],
            created: '2026-09-01T08:00:00',
            time_spent: 300,
            time_entries: []
        }
    })

    it('is not lowered: the log reports it', async () => {
        const v = logVault(notes())
        const result = await v.service.log(request())
        expect(result.activity?.decision).toEqual({ stored: 300, computed: 25, difference: 275 })
        expect(v.notes.get(GUITAR_ACTIVITY)!.fm['time_spent']).toBe(300)
    })

    it('Keep adds a "Manual adjustment" entry; undo takes it back with the log', async () => {
        const v = logVault(notes())
        const result = await v.service.log(request())
        const keys = await v.service.settleActivityTime(GUITAR_ACTIVITY, 'keep')
        const fm = v.notes.get(GUITAR_ACTIVITY)!.fm
        expect(fm['time_spent']).toBe(300)
        expect(fm['time_entries']).toEqual([
            {
                startTime: new Date('2026-09-01T00:00:00').toISOString(),
                endTime: new Date(
                    new Date('2026-09-01T00:00:00').getTime() + 275 * 60_000
                ).toISOString(),
                description: 'Manual adjustment'
            }
        ])
        const record = {
            ...result.undo,
            files: result.undo.files.map((f) =>
                f.path === GUITAR_ACTIVITY ? { ...f, keys: mergeChanges(f.keys, keys) } : f
            )
        }
        expect(await v.service.undo(record)).toMatchObject({ ok: true })
        expect(v.notes.get(GUITAR_ACTIVITY)!.fm).toEqual(notes()[GUITAR_ACTIVITY])
    })

    it('Drop lowers it to what its entries and sessions give', async () => {
        const v = logVault(notes())
        await v.service.log(request())
        await v.service.settleActivityTime(GUITAR_ACTIVITY, 'drop')
        expect(v.notes.get(GUITAR_ACTIVITY)!.fm['time_spent']).toBe(25)
    })
})

describe('practice log: undo', () => {
    it('trashes the new session note and puts the item times back; a created activity stays', async () => {
        const v = logVault({ [AM]: chord({ time_spent: 5 }), [EM]: chord() }, starterKit())
        const before = JSON.stringify([v.notes.get(AM)!.fm, v.notes.get(EM)!.fm])
        const result = await v.service.log(request(), { createActivity: 'Learn Guitar' })
        expect(v.notes.get(AM)!.fm['time_spent']).toBe(13)
        expect(await v.service.undo(result.undo)).toMatchObject({ ok: true })
        expect(v.notes.has(result.sessionPath)).toBe(false)
        expect(JSON.stringify([v.notes.get(AM)!.fm, v.notes.get(EM)!.fm])).toBe(before)
        expect(v.notes.get(result.createdActivity!)!.fm['session_types']).toEqual([
            'guitar-practice-sessions'
        ])
    })
})
