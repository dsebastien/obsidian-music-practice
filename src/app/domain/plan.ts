import { LEVEL } from './mastery'
import { isActive, isDueForReview, overdueBy } from './practice'
import type { LearningItem } from './practice'

export type BlockName = 'warm-up' | 'focus' | 'review' | 'fun'

/** Warm-up, focus, review, fun, in percent of the session. */
export const DEFAULT_SPLIT: readonly [number, number, number, number] = [15, 50, 20, 15]
const MIN_MINUTES_PER_ITEM = 5
const MAX_ITEMS_PER_BLOCK = 3
const WARM_UP_KINDS = /technique|exercise/

export interface PlannedItem {
    item: LearningItem
    minutes: number
}

export interface PlanBlock {
    block: BlockName
    minutes: number
    items: PlannedItem[]
}

export interface PracticePlan {
    minutes: number
    blocks: PlanBlock[]
}

/**
 * A practice session for N minutes. Warm-up: active techniques and exercises, lowest level first.
 * Focus: active items, current focus first, then by score. Review: due items, most overdue first.
 * Fun: items at 40 or above, least recently played first. Up to three items per block, five minutes
 * each at least; a block with nothing to offer hands its minutes to focus. Review and warm-up pick
 * first so focus doesn't take their items.
 */
export function buildPlan(
    items: readonly LearningItem[],
    minutes: number,
    split: readonly number[] = DEFAULT_SPLIT
): PracticePlan {
    const used = new Set<string>()
    const pick = (pool: LearningItem[], blockMinutes: number): PlannedItem[] => {
        const max = Math.min(
            Math.max(1, Math.floor(blockMinutes / MIN_MINUTES_PER_ITEM)),
            MAX_ITEMS_PER_BLOCK
        )
        const chosen = pool.filter((i) => !used.has(i.path)).slice(0, max)
        chosen.forEach((i) => used.add(i.path))
        const each = chosen.length ? Math.round(blockMinutes / chosen.length) : 0
        return chosen.map((item) => ({ item, minutes: each }))
    }
    // Focus takes the rounding remainder so the blocks always add up to the session.
    const [w = 0, , r = 0, u = 0] = split.map((p) => Math.round((minutes * p) / 100))
    const f = minutes - w - r - u
    const byScore = (a: LearningItem, b: LearningItem) => b.score - a.score
    const warmUpPool = items
        .filter((i) => isActive(i) && WARM_UP_KINDS.test(i.kind))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || byScore(a, b))
    const reviewPool = items.filter(isDueForReview).sort((a, b) => overdueBy(b) - overdueBy(a))
    const focusPool = items
        .filter(isActive)
        .sort((a, b) => Number(b.focus) - Number(a.focus) || byScore(a, b))
    const funPool = items
        .filter((i) => i.level !== null && i.level >= LEVEL.TEMPO)
        .sort((a, b) => (b.daysSincePracticed ?? 9999) - (a.daysSincePracticed ?? 9999))

    const review = pick(reviewPool, r)
    const warmUp = pick(warmUpPool, w)
    const funLeft = funPool.some((i) => !used.has(i.path))
    const spare = (warmUp.length ? 0 : w) + (review.length ? 0 : r) + (funLeft ? 0 : u)
    const focusMinutes = f + spare
    const focus = pick(focusPool, focusMinutes)
    const fun = pick(funPool, u)
    return {
        minutes,
        blocks: [
            { block: 'warm-up', minutes: warmUp.length ? w : 0, items: warmUp },
            { block: 'focus', minutes: focusMinutes, items: focus },
            { block: 'review', minutes: review.length ? r : 0, items: review },
            { block: 'fun', minutes: fun.length ? u : 0, items: fun }
        ]
    }
}
