import { isoDate } from './domain/dates'
import type { LogRequest } from './domain/log'
import { labelFor, levelOf } from './domain/mastery'
import type { NoteModel } from './domain/note-model'
import { buildPlan } from './domain/plan'
import { practiceNext, readyToLearn } from './domain/practice'
import type { LearningItem } from './domain/practice'
import type { PracticeRules } from './domain/rules'
import type { ItemRepository } from './services/item-repository'
import type { LogResult, PracticeLogService, UndoResult } from './services/practice-log.service'

/** A learning item as plain JSON. */
export interface ItemSummary {
    name: string
    path: string
    /** The note type's stable id (an Obsidian Starter Kit id, or `local:<type tag>`). */
    typeId: string
    /** The note type's display name (may change when the type is renamed). */
    type: string
    kind: string
    subject: string | null
    level: number | null
    mastery: string | null
    priority: number | null
    focus: boolean
    review: LearningItem['review']
    reviewInterval: number | null
    daysSincePracticed: number | null
    bpmCurrent: number | null
    bpmTarget: number | null
    bpmProgress: number | null
    ready: boolean
    unlocks: number
    score: number
}

export interface PlanSummary {
    minutes: number
    blocks: { block: string; minutes: number; items: (ItemSummary & { minutes: number })[] }[]
}

export interface ItemFilter {
    /** Instrument or subject ("guitar"). */
    subject?: string
    /** Kind ("chord", "scale"…). */
    kind?: string
}

/**
 * The public API, as `app.plugins.plugins['music-practice'].api`. Scripts and AI skills use it so
 * the practice rules live in one place. Results are plain JSON; writes resolve when the notes are
 * written. `version` changes only on breaking changes.
 */
export interface MusicPracticeApi {
    version: 1
    /** Learning items with their derived state. */
    items(filter?: ItemFilter): ItemSummary[]
    /** Active and due items, highest score first. */
    practiceNext(filter?: ItemFilter, limit?: number): ItemSummary[]
    /** Items ready to learn (every prerequisite at "slow" or above). */
    readyItems(filter?: ItemFilter): ItemSummary[]
    /** A session plan for N minutes. */
    practicePlan(minutes: number, filter?: ItemFilter): PlanSummary
    /** Log a practice session (see the Log practice command for what gets written). */
    logPractice(request: LogRequest, options?: { adoptTimer?: boolean }): Promise<LogResult>
    /** Change an item's mastery, by number (40) or by the type's value ("40 - Can play at tempo"). */
    setMastery(path: string, level: number | string): Promise<void>
    setBpm(path: string, bpm: { current?: number; target?: number }): Promise<void>
    /** The running practice timer's start (epoch ms), or null. */
    timer(): number | null
    /** Start the practice timer; rejects when it is already running. */
    startTimer(): Promise<void>
    /** Clear the timer without logging. */
    clearTimer(): Promise<void>
    /** Undo the last practice log (see the Undo last practice log command). */
    undoLastLog(): Promise<UndoResult>
}

export interface ApiDeps {
    model: () => NoteModel
    rules: () => PracticeRules
    items: ItemRepository
    log: PracticeLogService
    timer: { get: () => number | null; start: () => Promise<void>; clear: () => Promise<void> }
    undoLastLog: () => Promise<UndoResult>
}

export function summarize(model: NoteModel, item: LearningItem): ItemSummary {
    const type = model.learningTypes.find((t) => t.id === item.typeId)
    return {
        name: item.name,
        path: item.path,
        typeId: item.typeId,
        type: type?.name ?? item.typeId,
        kind: item.kind,
        subject: type?.subject ?? null,
        level: item.level,
        mastery: item.level !== null && type ? labelFor(item.level, type.statusValues) : null,
        priority: item.priority,
        focus: item.focus,
        review: item.review,
        reviewInterval: item.reviewInterval,
        daysSincePracticed: item.daysSincePracticed,
        bpmCurrent: item.bpmCurrent,
        bpmTarget: item.bpmTarget,
        bpmProgress: item.bpmProgress,
        ready: item.ready,
        unlocks: item.unlocks,
        score: item.score
    }
}

export function createApi(deps: ApiDeps): MusicPracticeApi {
    const filtered = (filter: ItemFilter = {}): LearningItem[] => {
        const model = deps.model()
        return deps.items.items(isoDate()).filter((i) => {
            const subject = model.learningTypes.find((t) => t.id === i.typeId)?.subject ?? null
            return (
                (!filter.subject || subject === filter.subject) &&
                (!filter.kind || i.kind === filter.kind)
            )
        })
    }
    const find = (path: string): LearningItem => {
        const item = deps.items.items().find((i) => i.path === path)
        if (!item) throw new Error(`Not a learning note: ${path}`)
        return item
    }
    const s = (item: LearningItem) => summarize(deps.model(), item)
    return {
        version: 1,
        items: (filter) => filtered(filter).map(s),
        practiceNext: (filter, limit = 20) =>
            practiceNext(filtered(filter), deps.rules()).slice(0, limit).map(s),
        readyItems: (filter) => readyToLearn(filtered(filter), deps.rules()).map(s),
        practicePlan: (minutes, filter) => {
            const plan = buildPlan(filtered(filter), minutes, deps.rules())
            return {
                minutes: plan.minutes,
                blocks: plan.blocks.map((b) => ({
                    block: b.block,
                    minutes: b.minutes,
                    items: b.items.map((p) => ({ ...s(p.item), minutes: p.minutes }))
                }))
            }
        },
        logPractice: (request, options) => deps.log.log(request, options),
        setMastery: async (path, level) => {
            const n = typeof level === 'number' ? level : levelOf(level)
            if (n === null) throw new Error(`Not a mastery level: ${String(level)}`)
            await deps.log.setLevel(find(path), n)
        },
        setBpm: (path, bpm) => deps.log.setBpmAndLevel(find(path), bpm),
        timer: () => deps.timer.get(),
        startTimer: () => deps.timer.start(),
        clearTimer: () => deps.timer.clear(),
        undoLastLog: () => deps.undoLastLog()
    }
}
