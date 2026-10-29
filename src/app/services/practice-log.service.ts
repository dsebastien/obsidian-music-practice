import { normalizePath } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { mergeTags, tagsOf } from '../domain/item-reader'
import {
    addTimeEntry,
    applyItemUpdate,
    freshItem,
    itemUpdate,
    levelChange,
    localIso,
    sessionFileName,
    sessionTitle,
    splitMinutes,
    validateLogRequest
} from '../domain/log'
import type { LogItem, LogRequest, TimeEntryResult } from '../domain/log'
import { expandTokens } from '../domain/local-model'
import type { LearningType, NoteModel, SessionType } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import { bodyOf, changedKeys, conflicts, revert, snapshot } from '../domain/undo'
import type { FileChanges, UndoRecord } from '../domain/undo'
import type { PracticeRules } from '../domain/rules'
import { fillSection, renderTemplate } from '../domain/template-render'
import type { ItemRepository } from './item-repository'
import { kapActiveTimer, stopKapTimer } from './kanban-action-planner.service'
import type { KapTimer } from './kanban-action-planner.service'
import {
    resolveNoteTypeAffixes,
    resolveNoteTypeFolder,
    starterKitRunsAutomations
} from './starter-kit.service'

export interface LogContext {
    rules: PracticeRules
    fields: FieldNames
    /** Heading of the session section that receives the log's note. */
    notesHeading: string
    /** Activity note name for a subject; `{subject}` is replaced ("Learn {subject}"). */
    activityName: string
}

/**
 * `missing`: the adopted Kanban Action Planner timer didn't write its entry in time; nothing was
 * added, so the time is never counted twice (check the activity).
 */
export type ActivityResult = TimeEntryResult | 'missing'

export interface LogResult {
    sessionPath: string
    items: string[]
    activity: { path: string; result: ActivityResult } | null
    adoptedTimer: boolean
    /** Things left alone on purpose (minutes that aren't a number…). */
    warnings: string[]
    /** What the log changed, to undo it. */
    undo: UndoRecord
}

/** What undoing the last log did, or why it didn't. */
export type UndoResult =
    | { ok: true; sessionPath: string; keptKapEntry: boolean }
    | { ok: false; reason: string }

const KAP_ENTRY_TIMEOUT_MS = 10_000
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
const titleCase = (s: string) =>
    s.replace(
        /(^|[\s_-])(\w)/g,
        (_m, sep: string, c: string) => `${sep === '_' ? ' ' : sep}${c.toUpperCase()}`
    )

interface Resolved {
    item: LearningItem
    type: LearningType
    log: LogItem
    file: TFile
}

/** Writes a practice log: the session note, the practiced notes and the activity's time entry. */
export class PracticeLogService {
    private busy = false

    constructor(
        private readonly app: App,
        private readonly model: () => NoteModel,
        private readonly repo: ItemRepository,
        private readonly context: () => LogContext,
        /** Remembers the last log, to undo it (every log, from the modal or the API). */
        private readonly onLogged: (record: UndoRecord) => void = () => {}
    ) {}

    /**
     * The session types a log of these items can go to. Items of one instrument: its session type.
     * Instrument-less items only (ear training…): every session type of their domain, to choose from.
     * Items of several instruments: an error, since one log is one session.
     */
    sessionTypesFor(items: readonly LearningItem[]): SessionType[] {
        const model = this.model()
        const types = items
            .map((i) => model.learningTypes.find((t) => t.id === i.typeId))
            .filter((t): t is LearningType => Boolean(t))
        const subjects = [
            ...new Set(types.map((t) => t.subject).filter((s): s is string => Boolean(s)))
        ]
        if (subjects.length > 1)
            throw new Error('Log one instrument at a time: these items belong to several.')
        if (subjects.length === 1) {
            const t = types.find((x) => x.subject === subjects[0])!
            return model.sessionTypes.filter(
                (s) => s.domain === t.domain && s.subject === t.subject
            )
        }
        const domains = new Set(types.map((t) => t.domain))
        return model.sessionTypes.filter((s) => domains.has(s.domain))
    }

    /** The session type for these items, or null when it must be chosen (or doesn't exist). */
    sessionTypeFor(items: readonly LearningItem[], preferredId?: string): SessionType | null {
        const candidates = this.sessionTypesFor(items)
        if (preferredId) return candidates.find((s) => s.id === preferredId) ?? null
        return candidates.length === 1 ? candidates[0]! : null
    }

    /**
     * The activity a session of this type counts towards: the one the latest session (by its date)
     * linked to, else a note named after the activity pattern ("Learn Guitar"), or "Learn Guitar (…)"
     * when that note is tagged as an activity.
     */
    findActivity(session: SessionType): TFile | null {
        const { fields, activityName } = this.context()
        const cache = this.app.metadataCache
        const sessions = this.app.vault
            .getMarkdownFiles()
            .map((f) => ({ f, fm: cache.getFileCache(f)?.frontmatter ?? {} }))
            .filter(({ fm }) => tagsOf(fm).includes(session.typeTag.toLowerCase()))
            .sort(
                (a, b) =>
                    String(b.fm[fields.date] ?? '').localeCompare(
                        String(a.fm[fields.date] ?? '')
                    ) || b.f.stat.ctime - a.f.stat.ctime
            )
        for (const { f } of sessions) {
            const link = cache
                .getFileCache(f)
                ?.frontmatterLinks?.find((l) => l.key.split('.')[0] === fields.activities)
            const target = link ? cache.getFirstLinkpathDest(link.link, f.path) : null
            if (target) return target
        }
        const wanted = activityName
            .replaceAll('{subject}', titleCase(session.subject))
            .toLowerCase()
        const files = this.app.vault.getMarkdownFiles()
        const exact = files.filter((f) => f.basename.toLowerCase() === wanted)
        if (exact.length === 1) return exact[0]!
        const affixed = files.filter(
            (f) =>
                f.basename.toLowerCase().startsWith(`${wanted} (`) &&
                tagsOf(cache.getFileCache(f)?.frontmatter ?? {}).some((t) => /activit/.test(t))
        )
        return affixed.length === 1 ? affixed[0]! : null
    }

    /** A Kanban Action Planner timer running on this activity, or null. */
    timerOn(activity: TFile | null): KapTimer | null {
        const timer = kapActiveTimer(this.app)
        return timer && activity && timer.path === activity.path ? timer : null
    }

    async log(request: LogRequest, options: { adoptTimer?: boolean } = {}): Promise<LogResult> {
        if (this.busy) throw new Error('A practice log is already being written.')
        this.busy = true
        try {
            const result = await this.write(request, options)
            this.onLogged(result.undo)
            return result
        } finally {
            this.busy = false
        }
    }

    private async write(
        request: LogRequest,
        options: { adoptTimer?: boolean }
    ): Promise<LogResult> {
        // 1. Check and resolve everything before the first write.
        const invalid = validateLogRequest(request)
        if (invalid) throw new Error(invalid)
        const { rules, fields, notesHeading } = this.context()
        const model = this.model()
        const date = request.date
        const byPath = new Map(this.repo.items(date).map((i) => [i.path, i]))
        const resolved: Resolved[] = request.items.map((log) => {
            const item = byPath.get(log.path)
            const type = item && model.learningTypes.find((t) => t.id === item.typeId)
            const file = this.app.vault.getFileByPath(log.path)
            if (!item || !type || !file) throw new Error(`Not a learning note: ${log.path}`)
            return { item, type, log, file }
        })
        const session = this.sessionTypeFor(
            resolved.map((r) => r.item),
            request.sessionTypeId
        )
        if (!session) throw new Error('Choose which instrument this session is for.')
        const stampDates = !starterKitRunsAutomations(this.app)
        const shares = splitMinutes(request.minutes, resolved.length)
        // Fails now (before writing) when a requested level has no value in its type.
        for (const [n, r] of resolved.entries())
            itemUpdate(r.item, r.type, r.log, {
                date,
                minutes: shares[n]!,
                fields,
                rules,
                stampDates,
                current: {}
            })
        const target = await this.sessionTarget(session, date, request)
        const activity = this.findActivity(session)
        const timer = this.timerOn(activity)
        if (timer && !options.adoptTimer)
            throw new Error(
                `A Kanban Action Planner timer is running on ${activity!.basename}: use it for this log, or stop it first, so the time isn't counted twice.`
            )

        // 2. The session note.
        const adopted = timer !== null
        if (adopted && !stopKapTimer(this.app))
            throw new Error('Could not stop the Kanban Action Planner timer.')
        const endMs = adopted ? Date.now() : this.endOf(date, request)
        const startMs = adopted ? timer.startedAt : endMs - request.minutes * 60_000
        const file = await this.createSession(target, request, notesHeading)
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            const put = (name: string, value: unknown) => {
                if (session.fields.has(name) && value !== undefined && value !== '')
                    fm[name] = value
            }
            fm['tags'] = mergeTags(fm['tags'], session.tags)
            put(fields.date, date)
            put(
                fields.startTime,
                request.startTime ??
                    (adopted || date === isoDate()
                        ? localIso(startMs).substring(11, 16)
                        : undefined)
            )
            put(fields.timeSpent, request.minutes)
            put(fields.quality, request.quality)
            put(
                fields.practiced,
                resolved.map(({ item }) => `[[${item.name}]]`)
            )
            if (activity) put(fields.activities, [`[[${activity.basename}]]`])
        })

        // 3. The practiced notes, each computed from its own current frontmatter.
        const warnings: string[] = []
        const changes: FileChanges[] = []
        for (const [n, { item, type, log, file: note }] of resolved.entries()) {
            await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
                const before = snapshot(fm)
                const current = freshItem(item, type, fm, fields)
                const update = itemUpdate(current, type, log, {
                    date,
                    minutes: shares[n]!,
                    fields,
                    rules,
                    stampDates,
                    current: fm
                })
                for (const field of applyItemUpdate(fm, update, fields))
                    warnings.push(`${item.name}: "${field}" isn't a number, minutes not added.`)
                changes.push({ path: note.path, keys: changedKeys(before, snapshot(fm)) })
            })
        }

        // 4. The activity's time entry.
        let activityResult: LogResult['activity'] = null
        if (activity) {
            if (adopted && !(await this.waitForKapEntry(activity, timer.startedAt))) {
                activityResult = { path: activity.path, result: 'missing' }
            } else {
                let result: TimeEntryResult = 'skipped'
                await this.app.fileManager.processFrontMatter(
                    activity,
                    (fm: Record<string, unknown>) => {
                        const before = snapshot(fm)
                        result = addTimeEntry(
                            fm,
                            {
                                startTime: localIso(startMs),
                                endTime: localIso(startMs + request.minutes * 60_000),
                                description: `[[${file.basename}]]`
                            },
                            request.minutes,
                            date,
                            fields,
                            adopted ? timer.startedAt : null
                        )
                        changes.push({
                            path: activity.path,
                            keys: changedKeys(before, snapshot(fm))
                        })
                    }
                )
                activityResult = { path: activity.path, result }
                if (result === 'skipped')
                    warnings.push(
                        `${activity.basename}: its time entries or minutes have an unexpected shape, nothing was added.`
                    )
            }
        }
        return {
            sessionPath: file.path,
            items: resolved.map(({ item }) => item.path),
            activity: activityResult,
            adoptedTimer: adopted,
            warnings,
            undo: {
                at: Date.now(),
                sessionPath: file.path,
                sessionBody: bodyOf(await this.app.vault.read(file)),
                files: changes.filter((c) => c.keys.length > 0),
                adoptedTimer: adopted
            }
        }
    }

    /**
     * Undo a log: put back the keys it changed in the practiced notes and the activity, and trash
     * its session note. Refuses, naming the notes, when any of it changed since.
     */
    async undo(record: UndoRecord): Promise<UndoResult> {
        if (this.busy) return { ok: false, reason: 'A practice log is being written.' }
        this.busy = true
        try {
            const session = this.app.vault.getFileByPath(record.sessionPath)
            const changed: string[] = []
            if (session && bodyOf(await this.app.vault.read(session)) !== record.sessionBody)
                changed.push(session.basename)
            const files = record.files.map((f) => ({
                f,
                file: this.app.vault.getFileByPath(f.path)
            }))
            for (const { f, file } of files) {
                if (!file) {
                    changed.push(`${f.path} (moved or deleted)`)
                    continue
                }
                const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}
                if (conflicts(fm, f.keys).length) changed.push(file.basename)
            }
            if (changed.length)
                return {
                    ok: false,
                    reason: `Changed since the log, nothing was undone: ${changed.join(', ')}.`
                }
            for (const { f, file } of files) {
                await this.app.fileManager.processFrontMatter(
                    file!,
                    (fm: Record<string, unknown>) => revert(fm, f.keys)
                )
            }
            if (session) await this.app.fileManager.trashFile(session)
            return { ok: true, sessionPath: record.sessionPath, keptKapEntry: record.adoptedTimer }
        } finally {
            this.busy = false
        }
    }

    /** Wait until the stopped Kanban Action Planner timer's entry shows up on the activity. */
    private async waitForKapEntry(activity: TFile, startedAt: number): Promise<boolean> {
        const { fields } = this.context()
        const deadline = Date.now() + KAP_ENTRY_TIMEOUT_MS
        while (Date.now() < deadline) {
            const fm: Record<string, unknown> =
                this.app.metadataCache.getFileCache(activity)?.frontmatter ?? {}
            const entries = fm[fields.timeEntries]
            if (
                Array.isArray(entries) &&
                entries.some(
                    (e: unknown) =>
                        typeof e === 'object' &&
                        e !== null &&
                        Math.abs(
                            new Date(String((e as { startTime?: unknown }).startTime)).getTime() -
                                startedAt
                        ) < 60_000
                )
            )
                return true
            await sleep(250)
        }
        return false
    }

    /** Change an item's mastery (with the stamp and first review interval that come with it). */
    async setLevel(item: LearningItem, level: number): Promise<void> {
        await this.setBpmAndLevel(item, {}, level)
    }

    /** Set an item's BPMs and, optionally, its level, in one write. */
    async setBpmAndLevel(
        item: LearningItem,
        bpm: { current?: number; target?: number },
        level?: number
    ): Promise<void> {
        const { rules, fields } = this.context()
        const type = this.model().learningTypes.find((t) => t.id === item.typeId)
        const file = this.app.vault.getFileByPath(item.path)
        if (!type || !file) throw new Error(`Not a learning note: ${item.path}`)
        for (const value of [bpm.current, bpm.target])
            if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 1000))
                throw new Error('BPM must be a whole number between 1 and 1000.')
        const stampDates = !starterKitRunsAutomations(this.app)
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            if (bpm.current !== undefined && type.fields.has(fields.bpmCurrent))
                fm[fields.bpmCurrent] = bpm.current
            if (bpm.target !== undefined && type.fields.has(fields.bpmTarget))
                fm[fields.bpmTarget] = bpm.target
            if (level !== undefined)
                Object.assign(
                    fm,
                    levelChange(freshItem(item, type, fm, fields), type, level, {
                        date: isoDate(),
                        fields,
                        rules,
                        stampDates,
                        current: fm
                    })
                )
        })
    }

    /** End of the session: now for today without a start time, else start time + minutes. */
    private endOf(date: string, request: LogRequest): number {
        if (request.startTime)
            return new Date(`${date}T${request.startTime}:00`).getTime() + request.minutes * 60_000
        return date === isoDate() ? Date.now() : new Date(`${date}T12:00:00`).getTime()
    }

    /** The session note's folder and free path, resolved before anything is written. */
    private async sessionTarget(session: SessionType, date: string, request: LogRequest) {
        const own = session.naming
        const expand = (pattern: string) =>
            expandTokens(pattern, date, session.domain, session.subject)
        const folder = own
            ? normalizePath(expand(own.folder))
            : resolveNoteTypeFolder(this.app, session.id, date)
        if (!folder) throw new Error(`${session.name} has no folder.`)
        const affixes = own ? null : resolveNoteTypeAffixes(this.app, session.id, date)
        const naming = own
            ? { prefix: expand(own.prefix), suffix: expand(own.suffix) }
            : {
                  prefix: affixes && !affixes.prefixOptional ? affixes.prefix : '',
                  suffix: affixes && !affixes.suffixOptional ? affixes.suffix : ''
              }
        const base = sessionTitle(date, request.focus)
        let path = ''
        for (let n = 1; n < 100 && !path; n++) {
            const candidate = normalizePath(`${folder}/${sessionFileName(base, n, naming)}`)
            if (!this.app.vault.getAbstractFileByPath(candidate)) path = candidate
        }
        if (!path) throw new Error(`No free name for "${base}".`)
        const template = session.templatePath
            ? this.app.vault.getFileByPath(session.templatePath)
            : null
        const templateText = template ? await this.app.vault.read(template) : null
        return { folder, path, naming, templateText }
    }

    private async createSession(
        target: Awaited<ReturnType<PracticeLogService['sessionTarget']>>,
        request: LogRequest,
        notesHeading: string
    ): Promise<TFile> {
        const { folder, path, naming, templateText } = target
        const heading = path.substring(path.lastIndexOf('/') + 1, path.length - 3)
        // The H1 is the bare title, without the type's prefix and suffix.
        const bare =
            heading.slice(naming.prefix.length, heading.length - naming.suffix.length) || heading
        let content =
            templateText !== null ? renderTemplate(templateText, bare) : `---\n---\n# ${bare}\n`
        if (request.note) {
            const filled = fillSection(content, notesHeading, `- ${request.note}`)
            // No such section (no template): add it, so the note is never lost.
            content =
                filled !== content
                    ? filled
                    : `${content.trimEnd()}\n\n## ${notesHeading}\n- ${request.note}\n`
        }
        if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder)
        return this.app.vault.create(path, content)
    }
}
