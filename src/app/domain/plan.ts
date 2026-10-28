import { splitMinutes } from './log'
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
 * Fun: items at the "tempo" level or above, least recently played first. Each block holds up to
 * `maxItemsPerBlock` items of at least `minMinutesPerItem` minutes; a block shorter than that, or with
 * nothing to offer, hands its minutes to focus. Review, warm-up and fun pick first (an item is
 * planned once); focus takes the rest, and always gets an item when there is one, so even a very
 * short session has something to do. The blocks add up to the session.
 */
export function buildPlan(
    items: readonly LearningItem[],
    minutes: number,
    rules: PracticeRules = DEFAULT_RULES
): PracticePlan {
    const { split, minMinutesPerItem, maxItemsPerBlock, warmUpKinds } = rules.plan
    const used = new Set<string>()
    const pick = (pool: LearningItem[], blockMinutes: number, force = false): PlannedItem[] => {
        const fit = Math.floor(blockMinutes / Math.max(1, minMinutesPerItem))
        const max = Math.min(force ? Math.max(1, fit) : fit, maxItemsPerBlock)
        if (max <= 0 || blockMinutes <= 0) return []
        const chosen = pool.filter((i) => !used.has(i.path)).slice(0, max)
        chosen.forEach((i) => used.add(i.path))
        const split = splitMinutes(blockMinutes, chosen.length)
        return chosen.map((item, i) => ({ item, minutes: split[i]! }))
    }
    const total = Math.max(0, Math.round(minutes))
    // Focus takes the rounding remainder so the blocks always add up to the session.
    const [w = 0, , r = 0, u = 0] = split.map((p) => Math.round((total * p) / 100))
    const f = Math.max(0, total - w - r - u)
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
    const fun = pick(funPool, u)
    const spare = (warmUp.length ? 0 : w) + (review.length ? 0 : r) + (fun.length ? 0 : u)
    const focusMinutes = f + spare
    const focus = pick(focusPool, focusMinutes, true)
    // Nothing for focus either: its minutes go back to the first block that has items.
    const blocks: PlanBlock[] = [
        { block: 'warm-up', minutes: warmUp.length ? w : 0, items: warmUp },
        { block: 'focus', minutes: focus.length ? focusMinutes : 0, items: focus },
        { block: 'review', minutes: review.length ? r : 0, items: review },
        { block: 'fun', minutes: fun.length ? u : 0, items: fun }
    ]
    const planned = blocks.reduce((sum, b) => sum + b.minutes, 0)
    const receiver = blocks.find((b) => b.items.length > 0)
    if (receiver && planned < total) {
        receiver.minutes += total - planned
        const extra = splitMinutes(receiver.minutes, receiver.items.length)
        receiver.items.forEach((p, i) => (p.minutes = extra[i]!))
    }
    return { minutes: total, blocks }
}
