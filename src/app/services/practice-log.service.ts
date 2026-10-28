import { TFile, normalizePath } from 'obsidian'
import type { App } from 'obsidian'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { tagsOf } from '../domain/item-reader'
import {
    addTimeEntry,
    applyItemUpdate,
    itemUpdate,
    levelChange,
    localIso,
    minutesPerItem,
    sessionFileName,
    sessionTitle
} from '../domain/log'
import type { LogRequest, TimeEntryResult } from '../domain/log'
import { sessionTypeFor } from '../domain/note-model'
import type { NoteModel, SessionType } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'
import { fillSection, renderTemplate } from '../domain/template-render'
import type { ItemRepository } from './item-repository'
import { kapActiveTimer, stopKapTimer } from './kanban-action-planner.service'
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

export interface LogResult {
    sessionPath: string
    items: string[]
    activity: { path: string; result: TimeEntryResult } | null
    adoptedTimer: boolean
}

const KAP_TIMER_WRITE_DELAY_MS = 1500
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
const title = (s: string) =>
    s.replace(
        /(^|[\s_-])(\w)/g,
        (_m, sep: string, c: string) => `${sep === '_' ? ' ' : sep}${c.toUpperCase()}`
    )

/** Writes a practice log: the practiced notes, the session note and the activity's time entry. */
export class PracticeLogService {
    constructor(
        private readonly app: App,
        private readonly model: () => NoteModel,
        private readonly repo: ItemRepository,
        private readonly context: () => LogContext
    ) {}

    /** The session type a log of these items goes to (the first item with a subject decides). */
    sessionTypeFor(items: readonly LearningItem[]): SessionType | null {
        const model = this.model()
        for (const item of items) {
            const type = model.learningTypes.find((t) => t.id === item.typeId)
            const session = type ? sessionTypeFor(model, type) : null
            if (session) return session
        }
        return null
    }

    /** The activity a session of this type counts towards, or null. */
    findActivity(session: SessionType): TFile | null {
        const { fields, activityName } = this.context()
        const cache = this.app.metadataCache
        // The activity the latest session of this type was linked to.
        const sessions = this.app.vault
            .getMarkdownFiles()
            .filter((f) =>
                tagsOf(cache.getFileCache(f)?.frontmatter ?? {}).includes(session.typeTag)
            )
            .sort((a, b) => b.stat.ctime - a.stat.ctime)
        for (const file of sessions) {
            const link = cache
                .getFileCache(file)
                ?.frontmatterLinks?.find((l) => l.key.split('.')[0] === fields.activities)
            const target = link ? cache.getFirstLinkpathDest(link.link, file.path) : null
            if (target) return target
        }
        // Otherwise by name: "Learn Guitar", "Learn Guitar (Activity)"…
        const wanted = activityName.replace('{subject}', title(session.subject)).toLowerCase()
        return (
            this.app.vault
                .getMarkdownFiles()
                .find((f) => f.basename.toLowerCase().replace(/\s*\([^)]*\)$/, '') === wanted) ??
            null
        )
    }

    async log(request: LogRequest, options: { adoptTimer?: boolean } = {}): Promise<LogResult> {
        const { rules, fields, notesHeading } = this.context()
        const model = this.model()
        const date = request.date || isoDate()
        if (request.items.length === 0) throw new Error('Pick at least one item to log.')
        if (!(request.minutes > 0)) throw new Error('Enter the minutes practiced.')
        const byPath = new Map(this.repo.items(date).map((i) => [i.path, i]))
        const logged = request.items.map((li) => {
            const item = byPath.get(li.path)
            const type = item && model.learningTypes.find((t) => t.id === item.typeId)
            if (!item || !type) throw new Error(`Not a learning note: ${li.path}`)
            return { li, item, type }
        })
        const session = this.sessionTypeFor(logged.map((l) => l.item))
        if (!session) throw new Error('No session type found for these items.')

        // 1. The practiced notes.
        const stampDates = !starterKitRunsAutomations(this.app)
        const share = minutesPerItem(request.minutes, logged.length)
        for (const { li, item, type } of logged) {
            await this.updateItem(item, (fm) =>
                applyItemUpdate(
                    fm,
                    itemUpdate(item, type, li, {
                        date,
                        minutes: share,
                        fields,
                        rules,
                        stampDates,
                        current: fm
                    }),
                    fields
                )
            )
        }

        // 2. A running Kanban Action Planner timer on the same activity is adopted, not doubled.
        const activity = this.findActivity(session)
        const timer = options.adoptTimer ? kapActiveTimer(this.app) : null
        const adopted = timer && activity && timer.path === activity.path ? timer : null
        if (adopted) stopKapTimer(this.app)
        const endMs = adopted ? Date.now() : this.endOf(date, request)
        const startMs = adopted ? adopted.startedAt : endMs - request.minutes * 60_000

        // 3. The session note.
        const file = await this.createSession(session, date, request, notesHeading)
        const startTime = localIso(startMs).substring(11, 16)
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            const put = (name: string, value: unknown) => {
                if (session.fields.has(name) && value !== undefined && value !== '')
                    fm[name] = value
            }
            put(fields.date, date)
            put(
                fields.startTime,
                request.startTime ?? (adopted || date === isoDate() ? startTime : undefined)
            )
            put(fields.timeSpent, request.minutes)
            put(fields.quality, request.quality)
            put(
                fields.practiced,
                logged.map(({ item }) => `[[${item.name}]]`)
            )
            if (activity) put(fields.activities, [`[[${activity.basename}]]`])
        })

        // 4. The activity's time entry (deduplicated by the session link).
        let activityResult: LogResult['activity'] = null
        if (activity) {
            if (adopted) await sleep(KAP_TIMER_WRITE_DELAY_MS) // KAP writes its entry asynchronously
            let result: TimeEntryResult = 'exists'
            await this.app.fileManager.processFrontMatter(
                activity,
                (fm: Record<string, unknown>) => {
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
                        adopted ? adopted.startedAt : null
                    )
                }
            )
            activityResult = { path: activity.path, result }
        }
        return {
            sessionPath: file.path,
            items: logged.map(({ item }) => item.path),
            activity: activityResult,
            adoptedTimer: adopted !== null
        }
    }

    /** Change an item's mastery (with the stamp and first review interval that come with it). */
    async setLevel(item: LearningItem, level: number): Promise<void> {
        const { rules, fields } = this.context()
        const type = this.model().learningTypes.find((t) => t.id === item.typeId)
        if (!type) throw new Error(`Not a learning note: ${item.path}`)
        const stampDates = !starterKitRunsAutomations(this.app)
        await this.updateItem(item, (fm) => {
            Object.assign(
                fm,
                levelChange(item, type, level, {
                    date: isoDate(),
                    fields,
                    rules,
                    stampDates,
                    current: fm
                })
            )
        })
    }

    /** Set an item's current and/or target BPM (only the fields its type defines). */
    async setBpm(item: LearningItem, bpm: { current?: number; target?: number }): Promise<void> {
        const { fields } = this.context()
        const type = this.model().learningTypes.find((t) => t.id === item.typeId)
        if (!type) throw new Error(`Not a learning note: ${item.path}`)
        await this.updateItem(item, (fm) => {
            if (bpm.current !== undefined && type.fields.has(fields.bpmCurrent))
                fm[fields.bpmCurrent] = bpm.current
            if (bpm.target !== undefined && type.fields.has(fields.bpmTarget))
                fm[fields.bpmTarget] = bpm.target
        })
    }

    private async updateItem(
        item: LearningItem,
        mutate: (fm: Record<string, unknown>) => void
    ): Promise<void> {
        const file = this.app.vault.getFileByPath(item.path)
        if (!file) throw new Error(`Note not found: ${item.path}`)
        await this.app.fileManager.processFrontMatter(file, mutate)
    }

    /** End of the session: now for today without a start time, else start time + minutes. */
    private endOf(date: string, request: LogRequest): number {
        if (request.startTime)
            return new Date(`${date}T${request.startTime}:00`).getTime() + request.minutes * 60_000
        return date === isoDate() ? Date.now() : new Date(`${date}T12:00:00`).getTime()
    }

    private async createSession(
        session: SessionType,
        date: string,
        request: LogRequest,
        notesHeading: string
    ): Promise<TFile> {
        const folder = resolveNoteTypeFolder(this.app, session.id, date)
        if (!folder) throw new Error(`${session.name} has no folder.`)
        const affixes = resolveNoteTypeAffixes(this.app, session.id, date)
        const naming = {
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
        const heading = path.substring(path.lastIndexOf('/') + 1, path.length - 3)
        const template = session.templatePath
            ? this.app.vault.getFileByPath(session.templatePath)
            : null
        let content = template
            ? renderTemplate(
                  await this.app.vault.read(template),
                  heading.replace(naming.suffix, '').replace(naming.prefix, '')
              )
            : `---\n---\n# ${heading}\n`
        if (request.note) content = fillSection(content, notesHeading, `- ${request.note}`)
        if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder)
        return this.app.vault.create(path, content)
    }
}
