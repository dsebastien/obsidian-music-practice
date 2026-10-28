import { daysBetween } from './dates'
import { LEVEL, PRIORITY_TBD, isActiveLevel } from './mastery'
import { isDue, reviewStatus } from './review'
import type { ReviewStatus } from './review'

/** A learning note as the engine sees it: numbers and links only, read from the note's frontmatter. */
export interface LearningItemInput {
    path: string
    /** File name without extension: what wikilinks point at. */
    name: string
    /** The kind from the type tag (`type/<domain>/<subject>/<kind>`): chord, scale, arrangement… */
    kind: string
    /** The note type (OSK type id, or the local kind id). */
    typeId: string
    level: number | null
    /** Priority number (10 Top … 60 Very low); null when TBD or missing. */
    priority: number | null
    /** The type's highest priority number (its "current focus" value); null when the type has no priority. */
    topPriority: number | null
    lastPracticed: string | null
    lastReviewed: string | null
    reviewInterval: number | null
    reviewCount: number | null
    bpmCurrent: number | null
    bpmTarget: number | null
    /** Prerequisite link targets (note names). */
    prerequisites: readonly string[]
    /** Every link target in the note (frontmatter and body), for unlocks. */
    links: readonly string[]
}

export interface LearningItem extends LearningItemInput {
    daysSincePracticed: number | null
    daysSinceReview: number | null
    review: ReviewStatus
    /** Current BPM as a percentage of the target; null unless both are set. */
    bpmProgress: number | null
    prerequisitesOpen: number
    missingPrerequisites: string[]
    /** Want to learn, with every prerequisite at 30 or above. */
    ready: boolean
    /** Items still at Want to learn that link to this one. */
    unlocks: number
    /** Current focus: at the type's top priority, not mastered. */
    focus: boolean
    /** Higher means practice sooner. */
    score: number
}

const MAX_UNLOCKS_COUNTED = 5

/**
 * Practice score, sum of: priority (70 − number; 25 when TBD), staleness (days since practiced
 * relative to the review interval, capped; 30 when never practiced), BPM gap, 3 per unlock (max 5)
 * and 10 for Rusty items.
 */
export function practiceScore(item: Omit<LearningItem, 'score'>): number {
    const priority =
        item.priority === null || item.priority >= PRIORITY_TBD ? 25 : 70 - item.priority
    const interval = item.reviewInterval ?? 0
    const staleness =
        item.daysSincePracticed === null
            ? 30
            : interval > 0
              ? Math.min(item.daysSincePracticed / interval, 3) * 10
              : Math.min(item.daysSincePracticed, 30)
    const bpmGap = item.bpmProgress === null ? 0 : (100 - Math.min(item.bpmProgress, 100)) / 5
    const unlocks = Math.min(item.unlocks, MAX_UNLOCKS_COUNTED) * 3
    const rusty = item.level === LEVEL.RUSTY ? 10 : 0
    return Math.round(priority + staleness + bpmGap + unlocks + rusty)
}

/** Derive review, readiness, unlocks, focus and score for every item, as of `today` (YYYY-MM-DD). */
export function computeItems(inputs: readonly LearningItemInput[], today: string): LearningItem[] {
    const byName = new Map(inputs.map((i) => [i.name, i]))
    const items = inputs.map((input) => {
        const daysSincePracticed = input.lastPracticed
            ? daysBetween(input.lastPracticed, today)
            : null
        const daysSinceReview = input.lastReviewed
            ? daysBetween(input.lastReviewed, today)
            : daysSincePracticed
        const missingPrerequisites: string[] = []
        let prerequisitesOpen = 0
        for (const name of input.prerequisites) {
            const pre = byName.get(name)
            if (!pre) missingPrerequisites.push(name)
            if (!pre || pre.level === null || pre.level < LEVEL.SLOW) prerequisitesOpen++
        }
        const bpmProgress =
            input.bpmCurrent && input.bpmTarget
                ? Math.round((input.bpmCurrent / input.bpmTarget) * 100)
                : null
        const unlocks = inputs.filter(
            (o) => o !== input && o.level === LEVEL.WANT && o.links.includes(input.name)
        ).length
        const focus =
            input.priority !== null &&
            input.topPriority !== null &&
            input.priority === input.topPriority &&
            (input.level ?? 0) < LEVEL.MASTERED
        const item = {
            ...input,
            daysSincePracticed,
            daysSinceReview,
            review: reviewStatus(input.level, input.reviewInterval, daysSinceReview),
            bpmProgress,
            prerequisitesOpen,
            missingPrerequisites,
            ready: input.level === LEVEL.WANT && prerequisitesOpen === 0,
            unlocks,
            focus
        }
        return { ...item, score: practiceScore(item) }
    })
    return items
}

export const isActive = (item: LearningItem): boolean => isActiveLevel(item.level)
export const isDueForReview = (item: LearningItem): boolean => isDue(item.review)

/** Days past the review interval (negative when not yet due). */
export const overdueBy = (item: LearningItem): number =>
    (item.daysSinceReview ?? 0) - (item.reviewInterval ?? 0)

/** "What next": active and due items, highest score first. */
export function practiceNext(items: readonly LearningItem[]): LearningItem[] {
    return items
        .filter((i) => isActive(i) || isDueForReview(i))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

/** Ready to learn, by priority then by what they unlock. */
export function readyToLearn(items: readonly LearningItem[]): LearningItem[] {
    return items
        .filter((i) => i.ready)
        .sort(
            (a, b) =>
                (a.priority ?? PRIORITY_TBD) - (b.priority ?? PRIORITY_TBD) ||
                b.unlocks - a.unlocks ||
                a.name.localeCompare(b.name)
        )
}
