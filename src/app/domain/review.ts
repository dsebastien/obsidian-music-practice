import { DEFAULT_RULES } from './rules'
import type { PracticeRules } from './rules'

/** A light SM-2 on the review fields (last reviewed, interval in days, review count). */

export type ReviewStatus = 'overdue' | 'due-soon' | 'current' | 'never' | null
export type ReviewResult = 'good' | 'shaky' | 'failed'

/**
 * Review status of an item at the "slow" level or above with an interval: overdue once the days
 * since the last review (or the last practice when never reviewed) reach the interval; due soon
 * within min(dueSoonMaxDays, interval / dueSoonDivisor) days of it. Mastered items stay in review.
 * Null when the item isn't in review.
 */
export function reviewStatus(
    level: number | null,
    interval: number | null,
    daysSinceReview: number | null,
    rules: PracticeRules = DEFAULT_RULES
): ReviewStatus {
    if (level === null || level < rules.levels.slow || !interval || interval <= 0) return null
    if (daysSinceReview === null) return 'never'
    if (daysSinceReview >= interval) return 'overdue'
    const { dueSoonMaxDays, dueSoonDivisor } = rules.review
    const window = Math.min(dueSoonMaxDays, Math.floor(interval / dueSoonDivisor))
    return daysSinceReview >= interval - window ? 'due-soon' : 'current'
}

export const isDue = (status: ReviewStatus): boolean =>
    status === 'overdue' || status === 'due-soon'

export interface ReviewOutcome {
    lastReviewed: string
    reviewCount: number
    reviewInterval: number
    /** Set when a failed review drops a mastered item to Rusty. */
    level?: number
}

/** Good multiplies the interval (capped), shaky keeps it, failed resets it and drops Mastered to Rusty. */
export function reviewOutcome(
    result: ReviewResult,
    current: { level: number | null; interval: number | null; count: number | null },
    date: string,
    rules: PracticeRules = DEFAULT_RULES
): ReviewOutcome {
    const { firstInterval, maxInterval, goodMultiplier } = rules.review
    const interval = current.interval && current.interval > 0 ? current.interval : firstInterval
    const out: ReviewOutcome = {
        lastReviewed: date,
        reviewCount: (current.count ?? 0) + 1,
        reviewInterval: interval
    }
    if (result === 'good') out.reviewInterval = Math.min(interval * goodMultiplier, maxInterval)
    if (result === 'failed') {
        out.reviewInterval = firstInterval
        if (current.level === rules.levels.mastered) out.level = rules.levels.rusty
    }
    return out
}

/** Reaching the "slow" level starts the review cycle when no interval is set yet. */
export function intervalOnLevelChange(
    newLevel: number,
    interval: number | null,
    rules: PracticeRules = DEFAULT_RULES
): number | null {
    return newLevel >= rules.levels.slow && !interval ? rules.review.firstInterval : null
}
