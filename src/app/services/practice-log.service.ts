import { getFrontMatterInfo, normalizePath, parseYaml } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { mergeTags, tagsOf } from '../domain/item-reader'
import {
    applyActivityTime,
    keyOf,
    linkedSessionOf,
    planActivityTime,
    prop,
    sessionDay
} from '../domain/activity-time'
import type { LinkedSession, LowerChoice, LowerDecision } from '../domain/activity-time'
import {
    firstLinkPath,
    planItemTime,
    practicedMinutesValues,
    sessionItemMinutes
} from '../domain/item-time'
import {
    applyItemUpdate,
    freshItem,
    holdsLog,
    itemUpdate,
    RERUN_WINDOW_MS,
    levelChange,
    localIso,
    sessionFileName,
    sessionTitle,
    splitMinutes,
    validateLogRequest
} from '../domain/log'
import type { LogItem, LogRequest } from '../domain/log'
import { expandTokens } from '../domain/local-model'
import type { LearningType, NoteModel, SessionType } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import { bodyOf, changedKeys, conflicts, revert, snapshot } from '../domain/undo'
import { SETTLE, waitUntilSettled } from '../domain/settle'
import type { Clock } from '../domain/settle'
import type { FileChanges, KeyChange, UndoRecord } from '../domain/undo'
import type { PracticeRules } from '../domain/rules'
import { fillSection, renderTemplate } from '../domain/template-render'
import { ActivityService, folderBase } from './activity.service'
import type { ActivityEntry } from './activity.service'
import type { ItemRepository } from './item-repository'
import { kapActiveTimer, stopKapTimer } from './kanban-action-planner.service'
import type { KapTimer } from './kanban-action-planner.service'
import {
    listNoteTypes,
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
 * How the dialog settles a session type that no activity lists in `session_types` (the user's
 * answer, never the plugin's guess): count it for an existing activity (`mapTo`, a path: the type
 * is added to its `session_types` and dropped from any other activity listing it), or create a new
 * activity (`createActivity`, a name) that lists it. Logging without an activity is the request's
 * `activity: null`.
 */
export interface LogOptions {
    adoptTimer?: boolean
    mapTo?: string
    createActivity?: string
}

/**
 * What a log did to its activity's time, which is recomputed from the activity's time entries and
 * the session notes linked to it (never added to). `updated` / `unchanged`: recomputed.
 * `missing`: recomputed, but the adopted Kanban Action Planner timer's entry didn't appear in time,
 * so it couldn't be removed (if it appears later, it counts twice until removed). `not-linked`:
 * Obsidian's link index didn't see the new session in time; nothing was written on the activity.
 * `skipped`: its time entries aren't a list; nothing was written.
 */
export type ActivityResult = 'updated' | 'unchanged' | 'missing' | 'not-linked' | 'skipped'

export interface LogResult {
    sessionPath: string
    /** The session note already held this log (a run again): it was reused, not created. */
    reused: boolean
    items: string[]
    /**
     * The activity and what happened to its time. `decision`: its stored minutes are above what
     * its entries and sessions give; they were left as they are (see `settleActivityTime`).
     */
    activity: { path: string; result: ActivityResult; decision: LowerDecision | null } | null
    /** An activity created for this log, on the user's request. */
    createdActivity: string | null
    adoptedTimer: boolean
    /** Things left alone on purpose (a duration above the computed one…). */
    warnings: string[]
    /** What the log changed, to undo it. */
    undo: UndoRecord
}

/**
 * What undoing the last log did, or why it didn't. `keptKapEntry`: the log had adopted a Kanban
 * Action Planner timer, whose time entry is on the activity again after the undo (put back when the
 * log removed it).
 */
export type UndoResult =
    { ok: true; sessionPath: string; keptKapEntry: boolean } | { ok: false; reason: string }

const KAP_ENTRY_TIMEOUT_MS = 10_000
const LINK_TIMEOUT_MS = 10_000
const CACHE_TIMEOUT_MS = 5_000
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
const realClock: Clock = { now: () => Date.now(), sleep: (ms) => sleep(ms).then(() => {}) }

interface Resolved {
    item: LearningItem
    type: LearningType
    log: LogItem
    file: TFile
}

/** The activity a log counts for, settled before anything is written. */
interface ActivityPlan {
    /** The activity note (null for a new one, until it is created). */
    file: TFile | null
    /** Its note name, which the session note links to. */
    name: string | null
    /** Create this activity (path checked) and count the session type for it. */
    create: string | null
    /** Count the session type for this existing activity. */
    map: TFile | null
    /** The activities as read once for this log. */
    list: ActivityEntry[]
}

/** Writes a practice log: the session note, the practiced notes and the activity's time. */
export class PracticeLogService {
    private busy = false
    /** Session notes this plugin created, by path, with when (a run again without a start time). */
    private readonly createdSessions = new Map<string, number>()
    /** Activities and the session types they count. */
    readonly activities: ActivityService

    constructor(
        private readonly app: App,
        private readonly model: () => NoteModel,
        private readonly repo: ItemRepository,
        private readonly context: () => LogContext,
        /** Remembers the last log, to undo it (every log, from the modal or the API). */
        private readonly onLogged: (record: UndoRecord) => Promise<void> | void = () => {},
        /** Time, for the waits around a new session note (specs pass their own). */
        private readonly clock: Clock = realClock
    ) {
        this.activities = new ActivityService(app, () => {
            const { fields, activityName } = this.context()
            return { fields, activityName }
        })
    }

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

    /** A Kanban Action Planner timer running on this activity, or null. */
    timerOn(activity: TFile | null): KapTimer | null {
        const timer = kapActiveTimer(this.app)
        return timer && activity && timer.path === activity.path ? timer : null
    }

    async log(request: LogRequest, options: LogOptions = {}): Promise<LogResult> {
        if (this.busy) throw new Error('A practice log is already being written.')
        this.busy = true
        // The previous undo's watch ends here: this log's session note can have the trashed one's
        // path and body (same day, same request), and must not be taken for a late re-creation.
        this.endUndoWatch()
        try {
            const result = await this.write(request, options)
            // Saved before returning, so an undo right after sees this log. A run again keeps the
            // original log's record: that one is what undo takes back.
            if (!result.reused) await this.onLogged(result.undo)
            return result
        } finally {
            this.busy = false
        }
    }

    /**
     * The activity of a log, checked before any write: the dialog's answer (`mapTo`,
     * `createActivity`), the request's (`activity`: a note, or null for none), else the activity
     * whose `session_types` lists the session type (the previous rules in a vault without
     * `session_types`). No activity lists it: the log counts for none, with a warning. `mapTo` and
     * `activity` must be activities; `mapTo` moves the type from any other activity listing it.
     */
    private planActivity(
        session: SessionType,
        request: LogRequest,
        options: LogOptions,
        warnings: string[]
    ): ActivityPlan {
        const none: ActivityPlan = { file: null, name: null, create: null, map: null, list: [] }
        const list = this.activities.activities()
        if (options.createActivity !== undefined) {
            const target = this.activities.newActivityPath(options.createActivity, list)
            if ('error' in target) throw new Error(target.error)
            const name = target.path.substring(
                target.path.lastIndexOf('/') + 1,
                target.path.length - 3
            )
            return { ...none, name, create: options.createActivity.trim(), list }
        }
        if (options.mapTo !== undefined) {
            const file = this.activities.findActivity(options.mapTo, list)
            if (!file) throw new Error(`Not an activity: ${options.mapTo}.`)
            return { ...none, file, name: file.basename, map: file, list }
        }
        if (request.activity === null) return none
        if (typeof request.activity === 'string') {
            const file = this.activities.findActivity(request.activity, list)
            if (!file) throw new Error(`No activity note named "${request.activity.trim()}".`)
            return { ...none, file, name: file.basename, list }
        }
        const choice = this.activities.choiceFor(session, list)
        if (choice.kind !== 'ask')
            return { ...none, file: choice.file, name: choice.file?.basename ?? null, list }
        const { fields } = this.context()
        warnings.push(
            choice.conflict.length
                ? `${choice.typeName} is listed in "${fields.sessionTypes}" by ${choice.conflict.map((f) => f.basename).join(' and ')}: the session counts for no activity until one of them drops it.`
                : `No activity lists ${choice.typeName} in "${fields.sessionTypes}": the session counts for no activity. Log practice asks which one to use.`
        )
        return none
    }

    private async write(request: LogRequest, options: LogOptions): Promise<LogResult> {
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
        for (const r of resolved)
            itemUpdate(r.item, r.type, r.log, { date, fields, rules, stampDates, current: {} })
        const warnings: string[] = []
        const plan = this.planActivity(session, request, options, warnings)
        const timer = this.timerOn(plan.file)
        if (timer && !options.adoptTimer)
            throw new Error(
                `A Kanban Action Planner timer is running on ${plan.file!.basename}: use it for this log, or stop it first, so the time isn't counted twice.`
            )
        const adopted = timer !== null
        const endMs = adopted ? Date.now() : this.endOf(date, request)
        const startMs = adopted ? timer.startedAt : endMs - request.minutes * 60_000
        // A run again of the same log (same type, date, items, minutes, and start time when given)
        // reuses its session note: nothing is counted twice.
        const givenStart =
            request.startTime ?? (adopted ? localIso(startMs).substring(11, 16) : null)
        const existing = this.findLoggedSession(session, {
            date,
            minutes: request.minutes,
            items: resolved.map((r) => r.item.name),
            startTime: givenStart
        })
        const target = existing ? null : await this.sessionTarget(session, date, request)
        // A run again changes no item: a request with other values (level, review, BPM) than what
        // the notes hold is another log of the same session, refused.
        if (existing) {
            const differs = resolved
                .filter((r) => this.itemWouldChange(r, date, stampDates))
                .map((r) => r.item.name)
            if (differs.length)
                throw new Error(
                    `Already logged in ${existing.basename}, with other values for ${differs.join(', ')}: nothing was written. Change them with Change mastery or Set BPM, or delete that session note to log again.`
                )
        }

        // 2. The session note, before the items (and before any change to an activity).
        if (adopted && !stopKapTimer(this.app))
            throw new Error('Could not stop the Kanban Action Planner timer.')
        let file: TFile
        if (existing) file = existing
        else {
            file = await this.createSession(target!, request, notesHeading)
            this.createdSessions.set(file.path, this.clock.now())
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
                put(
                    fields.practicedMinutes,
                    practicedMinutesValues(
                        resolved.map(({ item }) => item.name),
                        shares
                    )
                )
                if (plan.name) put(fields.activities, [`[[${plan.name}]]`])
            })
        }

        // 3. The activity the user chose: created or mapped to this session type, once the timer is
        // stopped and the session note written. Undo never takes this choice back.
        let activity = plan.file
        let choice: UndoRecord['activityChoice'] = undefined
        if (plan.create !== null) {
            activity = await this.activities.create(plan.create, session.typeName, {
                stampCreated: stampDates,
                list: plan.list
            })
            choice = { kind: 'created', path: activity.path }
        } else if (plan.map) {
            await this.activities.mapSessionType(session.typeName, plan.map, plan.list)
            choice = { kind: 'mapped', path: plan.map.path }
        }

        // 4. The practiced notes, each computed from its own current frontmatter; their time is
        // recomputed from their session notes (never added to) once Obsidian sees the new links.
        const timed = resolved.filter(({ type }) => type.fields.has(fields.timeSpent))
        const linked = await this.waitForLinks(
            file,
            timed.map((r) => r.file)
        )
        const contributionsOf = this.itemContributions(
            timed.filter((r) => linked.has(r.file.path)).map((r) => r.file.path)
        )
        const changes: FileChanges[] = []
        for (const { item, type, log, file: note } of resolved) {
            const contributions =
                type.fields.has(fields.timeSpent) && linked.has(note.path)
                    ? (contributionsOf.get(note.path) ?? [])
                    : null
            await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
                const before = snapshot(fm)
                const current = freshItem(item, type, fm, fields)
                // A review counts once: a run again of the same log doesn't review it twice.
                const reviewed =
                    existing !== null && sessionDay(prop(fm, fields.lastReviewed)) === date
                const once: LogItem = { ...log }
                if (reviewed) delete once.review
                const update = itemUpdate(current, type, once, {
                    date,
                    fields,
                    rules,
                    stampDates,
                    current: fm
                })
                // A run again only recomputes the time (its values match, checked above).
                if (!existing) applyItemUpdate(fm, update, fields)
                if (contributions) {
                    const time = planItemTime(prop(fm, fields.timeSpent), contributions)
                    if (time.write !== null) fm[keyOf(fm, fields.timeSpent)] = time.write
                    if (time.decision)
                        warnings.push(
                            `${item.name}: "${fields.timeSpent}" is ${time.decision.stored} min and its session notes give ${time.decision.computed}: left as it is.`
                        )
                    if (time.notANumber)
                        warnings.push(
                            `${item.name}: "${fields.timeSpent}" isn't a number, so its time wasn't recomputed.`
                        )
                } else if (type.fields.has(fields.timeSpent))
                    warnings.push(
                        `${item.name}: Obsidian hadn't indexed the session's link yet, so its time wasn't recomputed (its next log does it).`
                    )
                changes.push({ path: note.path, keys: changedKeys(before, snapshot(fm)) })
            })
        }

        // 5. The activity's time: recomputed from its entries and linked sessions, never added to.
        // A reused session note that links to another activity (or none) is left as it is.
        let activityResult: LogResult['activity'] = null
        const linksActivity = (): boolean => {
            if (!existing || !activity) return true
            const fm: Record<string, unknown> =
                this.app.metadataCache.getFileCache(existing)?.frontmatter ?? {}
            const raw = prop(fm, fields.activities)
            const links = (Array.isArray(raw) ? (raw as unknown[]) : raw ? [raw] : [])
                .map((v) => firstLinkPath(v))
                .filter((l): l is string => l !== null)
            return links.some(
                (l) =>
                    l === activity.basename ||
                    this.app.metadataCache.getFirstLinkpathDest(l, existing.path)?.path ===
                        activity.path
            )
        }
        if (activity && !linksActivity()) {
            warnings.push(
                `The session note of that log (${existing!.basename}) counts for another activity or none, not ${activity.basename}: its activity was left as it is.`
            )
        } else if (activity) {
            const linkable = session.fields.has(fields.activities)
            const outcome = linkable
                ? await this.recomputeActivity(
                      activity,
                      file,
                      adopted ? timer.startedAt : null,
                      changes
                  )
                : { result: 'not-linked' as const, decision: null }
            activityResult = { path: activity.path, ...outcome }
            const result = outcome.result
            if (!linkable)
                warnings.push(
                    `${activity.basename}: the session note has no "${fields.activities}" field, so its time can't count for the activity.`
                )
            else if (result === 'not-linked')
                warnings.push(
                    `${activity.basename}: Obsidian hadn't indexed the session's link yet, so the activity's time wasn't recomputed${adopted ? " and the timer's time entry is still on it (delete it: the session holds that time)" : ''}. Use the Kanban Action Planner's Recompute tracked time on it in a moment.`
                )
            if (result === 'skipped')
                warnings.push(
                    `${activity.basename}: its time entries aren't a list, so its time wasn't recomputed.`
                )
        }
        // A run again right after must find this note: wait until the cache holds it.
        if (!existing) await this.waitForCache(file, session.typeTag)
        return {
            sessionPath: file.path,
            reused: existing !== null,
            items: resolved.map(({ item }) => item.path),
            activity: activityResult,
            createdActivity: choice?.kind === 'created' ? choice.path : null,
            adoptedTimer: adopted,
            warnings,
            undo: {
                at: Date.now(),
                sessionPath: file.path,
                sessionCtime: file.stat.ctime,
                sessionBody: bodyOf(await this.app.vault.read(file)),
                files: changes.filter((c) => c.keys.length > 0),
                adoptedTimer: adopted,
                ...(existing ? { reused: true } : {}),
                ...(choice ? { activityChoice: choice } : {})
            }
        }
    }

    /** Whether logging this item (a review already recorded that day aside) changes its note. */
    private itemWouldChange(r: Resolved, date: string, stampDates: boolean): boolean {
        const { fields, rules } = this.context()
        const cached: Record<string, unknown> =
            this.app.metadataCache.getFileCache(r.file)?.frontmatter ?? {}
        const fm = snapshot(cached)
        const before = snapshot(fm)
        const once: LogItem = { ...r.log }
        if (sessionDay(prop(fm, fields.lastReviewed)) === date) delete once.review
        const update = itemUpdate(freshItem(r.item, r.type, fm, fields), r.type, once, {
            date,
            fields,
            rules,
            stampDates,
            current: fm
        })
        applyItemUpdate(fm, update, fields)
        return changedKeys(before, fm).length > 0
    }

    /** Wait (5 s at most) until Obsidian's cache holds the session note's frontmatter. */
    private async waitForCache(file: TFile, tag: string): Promise<void> {
        const deadline = Date.now() + CACHE_TIMEOUT_MS
        const ready = () =>
            tagsOf(this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}).includes(
                tag.toLowerCase()
            )
        while (!ready() && Date.now() < deadline) await sleep(100)
    }

    /**
     * A session note of this type that already holds this log (see `holdsLog`), or null. Only the
     * notes in the session type's folder (without its date tokens) are read.
     */
    private findLoggedSession(
        session: SessionType,
        key: Parameters<typeof holdsLog>[1]
    ): TFile | null {
        const { fields } = this.context()
        const cache = this.app.metadataCache
        const tag = session.typeTag.toLowerCase()
        const base = session.naming
            ? folderBase(session.naming.folder)
            : folderBase(listNoteTypes(this.app).find((t) => t.id === session.id)?.associatedFolder)
        const now = this.clock.now()
        const recent = (path: string) => {
            const at = this.createdSessions.get(path)
            return at !== undefined && now - at < RERUN_WINDOW_MS
        }
        for (const f of this.app.vault.getMarkdownFiles()) {
            if (base && !f.path.startsWith(`${base}/`)) continue
            const fm = cache.getFileCache(f)?.frontmatter
            if (fm && tagsOf(fm).includes(tag) && holdsLog(fm, key, fields, recent(f.path)))
                return f
        }
        return null
    }

    /**
     * The minutes each session note gives each of these learning notes (its minutes-per-item entry,
     * else an even share when only listed as practiced), in one pass over Obsidian's link index.
     */
    private itemContributions(paths: readonly string[]): Map<string, number[]> {
        const { fields } = this.context()
        const cache = this.app.metadataCache
        const out = new Map<string, number[]>(paths.map((p) => [p, []]))
        if (paths.length === 0) return out
        for (const [source, targets] of Object.entries(cache.resolvedLinks)) {
            if (!paths.some((p) => p !== source && targets[p])) continue
            const f = this.app.vault.getFileByPath(source)
            if (!f) continue
            const given = sessionItemMinutes(
                cache.getFileCache(f)?.frontmatter,
                fields,
                (link) => cache.getFirstLinkpathDest(link, source)?.path ?? null
            )
            for (const p of paths) {
                const minutes = p !== source && targets[p] ? given.get(p) : undefined
                if (minutes !== undefined) out.get(p)!.push(minutes)
            }
        }
        return out
    }

    /** Wait (10 s at most in all) until Obsidian's link index sees the session link to each note. */
    private async waitForLinks(session: TFile, notes: readonly TFile[]): Promise<Set<string>> {
        const deadline = Date.now() + LINK_TIMEOUT_MS
        const seen = () =>
            new Set(
                notes
                    .map((n) => n.path)
                    .filter((p) => this.app.metadataCache.resolvedLinks[session.path]?.[p])
            )
        let found = seen()
        while (found.size < notes.length && Date.now() < deadline) {
            await sleep(250)
            found = seen()
        }
        return found
    }

    /**
     * Settle an activity whose stored minutes are above the computed ones (a log left them as they
     * were): `keep` the difference as a "Manual adjustment" time entry from the activity's
     * `created` day, or `drop` it. Returns the keys it changed (for the last log's undo) and the
     * difference as recomputed now (0 when nothing was left to settle).
     */
    async settleActivityTime(
        path: string,
        choice: Exclude<LowerChoice, null>
    ): Promise<{ keys: KeyChange[]; difference: number; minutes: number | null }> {
        const activity = this.app.vault.getFileByPath(path)
        if (!activity) throw new Error(`The activity is gone: ${path}`)
        const { fields } = this.context()
        const linked = this.linkedSessions(activity, fields)
        const cache = this.app.metadataCache
        const resolve = (link: string) =>
            cache.getFirstLinkpathDest(link, activity.path)?.path ?? null
        const out: { keys: KeyChange[]; difference: number; minutes: number | null } = {
            keys: [],
            difference: 0,
            minutes: null
        }
        await this.app.fileManager.processFrontMatter(activity, (fm: Record<string, unknown>) => {
            const before = snapshot(fm)
            const now = Date.now()
            const pending = planActivityTime(fm, fields, linked, resolve)
            if (!pending) throw new Error(`${activity.basename}: its time entries aren't a list.`)
            const plan = planActivityTime(
                fm,
                fields,
                linked,
                resolve,
                null,
                choice,
                now,
                activity.stat.ctime
            )!
            applyActivityTime(fm, plan, fields)
            out.keys = changedKeys(before, snapshot(fm))
            out.difference = pending.decision?.difference ?? 0
            out.minutes = plan.minutes
        })
        return out
    }

    /**
     * Undo a log: put back the keys it changed in the practiced notes and the activity, and trash
     * its session note. Refuses, naming the notes, when any of it changed since.
     */
    async undo(record: UndoRecord): Promise<UndoResult> {
        if (this.busy) return { ok: false, reason: 'A practice log is being written.' }
        if (record.reused)
            return {
                ok: false,
                reason: 'That run reused the session note of an earlier log: it changed nothing to undo.'
            }
        this.busy = true
        try {
            // A session note just created is written again by plugins that run on file creation
            // (Templater): wait for that write, or it would create the trashed note again.
            await waitUntilSettled(() => {
                const f = this.app.vault.getFileByPath(record.sessionPath)
                return f ? f.stat : null
            }, this.clock)
            // Checked against the notes as they are on disk now, not the metadata cache.
            const session = this.app.vault.getFileByPath(record.sessionPath)
            if (!session || (record.sessionCtime && session.stat.ctime !== record.sessionCtime))
                return {
                    ok: false,
                    reason: `The session note of that log was moved or deleted (${record.sessionPath}): nothing was undone.`
                }
            const changed: string[] = []
            if (bodyOf(await this.app.vault.read(session)) !== record.sessionBody)
                changed.push(session.basename)
            const files: { keys: UndoRecord['files'][number]['keys']; file: TFile }[] = []
            for (const f of record.files) {
                const file = this.app.vault.getFileByPath(f.path)
                if (!file) {
                    changed.push(`${f.path} (moved or deleted)`)
                    continue
                }
                if (conflicts(await this.frontmatterOf(file), f.keys).length)
                    changed.push(file.basename)
                files.push({ keys: f.keys, file })
            }
            if (changed.length)
                return {
                    ok: false,
                    reason: `Changed since the log, nothing was undone: ${changed.join(', ')}.`
                }
            try {
                for (const { keys, file } of files) {
                    await this.app.fileManager.processFrontMatter(
                        file,
                        (fm: Record<string, unknown>) => revert(fm, keys)
                    )
                }
                await this.app.fileManager.trashFile(session)
                this.watchForRecreation(record)
            } catch (error: unknown) {
                // What was put back stays put back; undoing again finishes the job.
                return {
                    ok: false,
                    reason: `The undo stopped halfway (${error instanceof Error ? error.message : String(error)}): run it again to finish.`
                }
            }
            return { ok: true, sessionPath: record.sessionPath, keptKapEntry: record.adoptedTimer }
        } finally {
            this.busy = false
        }
    }

    /** Stops the last undo's watch, if one runs. */
    private endUndoWatch: () => void = () => {}

    /**
     * After an undo, watch the session note's path for a while: a late write by another plugin
     * (Templater's trigger on file creation) can create it again. A note created there with the body
     * the log wrote is that session: it is trashed again. The watch only trashes: the practiced notes
     * and the activity were put back before undo returned, and the next log ends the watch, so it
     * never touches what that log writes.
     */
    private watchForRecreation(record: UndoRecord): void {
        this.endUndoWatch()
        const vault = this.app.vault
        let watching = true
        const ref = vault.on('create', (created) => {
            if (!watching || created.path !== record.sessionPath) return
            void (async () => {
                const file = vault.getFileByPath(record.sessionPath)
                if (!watching || !file || bodyOf(await vault.read(file)) !== record.sessionBody)
                    return
                await this.app.fileManager.trashFile(file)
            })()
        })
        const end = () => {
            if (!watching) return
            watching = false
            vault.offref(ref)
            if (this.endUndoWatch === end) this.endUndoWatch = () => {}
        }
        this.endUndoWatch = end
        void this.clock.sleep(SETTLE.watchMs).then(end)
    }

    /** A note's frontmatter read from the file itself (the metadata cache can lag a write). */
    private async frontmatterOf(file: TFile): Promise<Record<string, unknown>> {
        const info = getFrontMatterInfo(await this.app.vault.read(file))
        if (!info.exists) return {}
        const parsed: unknown = parseYaml(info.frontmatter)
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    }

    /**
     * Recompute an activity's stored time after a log (the rule in `domain/activity-time`): wait until
     * Obsidian's link index sees the session link to it, then, for an adopted timer, until the timer's
     * entry is on the activity (that entry is removed: the session holds the time). The entries are
     * read again inside `processFrontMatter`, so a stale cache never drops or keeps the wrong entry.
     */
    private async recomputeActivity(
        activity: TFile,
        session: TFile,
        adoptedStartMs: number | null,
        changes: FileChanges[]
    ): Promise<{ result: ActivityResult; decision: LowerDecision | null }> {
        const { fields } = this.context()
        if (!(await this.waitForLink(session, activity)))
            return { result: 'not-linked', decision: null }
        const found =
            adoptedStartMs === null || (await this.waitForKapEntry(activity, adoptedStartMs))
        const linked = this.linkedSessions(activity, fields)
        const cache = this.app.metadataCache
        const resolve = (link: string) =>
            cache.getFirstLinkpathDest(link, activity.path)?.path ?? null
        let result: ActivityResult = 'skipped'
        let decision: LowerDecision | null = null
        await this.app.fileManager.processFrontMatter(activity, (fm: Record<string, unknown>) => {
            const before = snapshot(fm)
            const plan = planActivityTime(
                fm,
                fields,
                linked,
                resolve,
                found ? adoptedStartMs : null
            )
            if (!plan) {
                result = 'skipped'
                return
            }
            applyActivityTime(fm, plan, fields)
            decision = plan.decision
            result = !found ? 'missing' : plan.changed ? 'updated' : 'unchanged'
            changes.push({ path: activity.path, keys: changedKeys(before, snapshot(fm)) })
        })
        return { result, decision }
    }

    /** The session notes that link to an activity, by path (from Obsidian's link index). */
    private linkedSessions(activity: TFile, fields: FieldNames): Map<string, LinkedSession> {
        const cache = this.app.metadataCache
        const linked = new Map<string, LinkedSession>()
        for (const [source, targets] of Object.entries(cache.resolvedLinks)) {
            if (source === activity.path || !targets[activity.path]) continue
            const file = this.app.vault.getFileByPath(source)
            if (!file) continue
            const counted = linkedSessionOf(
                cache.getFileCache(file)?.frontmatter,
                fields,
                (link) => cache.getFirstLinkpathDest(link, source)?.path === activity.path
            )
            if (counted) linked.set(source, counted)
        }
        return linked
    }

    /** Wait until Obsidian's link index sees the session link to the activity. */
    private async waitForLink(session: TFile, activity: TFile): Promise<boolean> {
        const deadline = Date.now() + LINK_TIMEOUT_MS
        while (Date.now() < deadline) {
            if (this.app.metadataCache.resolvedLinks[session.path]?.[activity.path]) return true
            await sleep(250)
        }
        return false
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
