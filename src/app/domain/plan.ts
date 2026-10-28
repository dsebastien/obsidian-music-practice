import { isActive, isDueForReview, overdueBy } from './practice'
import type { LearningItem } from './practice'
import { DEFAULT_RULES } from './rules'
import type { PracticeRules } from './rules'

export type BlockName = 'warm-up' | 'focus' | 'review' | 'fun'

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
 * A practice session for N minutes. Warm-up: active items of the warm-up kinds, lowest level first.
 * Focus: active items, current focus first, then by score. Review: due items, most overdue first.
 * Fun: items at the "tempo" level or above, least recently played first. A capped number of items
 * per block with a minimum of minutes each; a block with nothing to offer hands its minutes to
 * focus. Review and warm-up pick first so focus doesn't take their items.
 */
export function buildPlan(
    items: readonly LearningItem[],
    minutes: number,
    rules: PracticeRules = DEFAULT_RULES
): PracticePlan {
    const { split, minMinutesPerItem, maxItemsPerBlock, warmUpKinds } = rules.plan
    const used = new Set<string>()
    const pick = (pool: LearningItem[], blockMinutes: number): PlannedItem[] => {
        const max = Math.min(
            Math.max(1, Math.floor(blockMinutes / minMinutesPerItem)),
            maxItemsPerBlock
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
    const active = (i: LearningItem) => isActive(i, rules)
    const warmUpPool = items
        .filter((i) => active(i) && warmUpKinds.includes(i.kind))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || byScore(a, b))
    const reviewPool = items.filter(isDueForReview).sort((a, b) => overdueBy(b) - overdueBy(a))
    const focusPool = items
        .filter(active)
        .sort((a, b) => Number(b.focus) - Number(a.focus) || byScore(a, b))
    const funPool = items
        .filter((i) => i.level !== null && i.level >= rules.levels.tempo)
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
