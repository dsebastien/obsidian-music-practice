import { LEVEL } from './mastery'

/** A light SM-2 on the review fields (last reviewed, interval in days, review count). */
export const REVIEW_FIRST_INTERVAL = 3
export const REVIEW_MAX_INTERVAL = 90
const DUE_SOON_MAX_DAYS = 3

export type ReviewStatus = 'overdue' | 'due-soon' | 'current' | 'never' | null
export type ReviewResult = 'good' | 'shaky' | 'failed'

/**
 * Review status of an item at level 30 or above with an interval: overdue once the days since the
 * last review (or the last practice when never reviewed) reach the interval; due soon within
 * min(3, interval / 3) days of it. Mastered items stay in review. Null when the item isn't in review.
 */
export function reviewStatus(
    level: number | null,
    interval: number | null,
    daysSinceReview: number | null
): ReviewStatus {
    if (level === null || level < LEVEL.SLOW || !interval || interval <= 0) return null
    if (daysSinceReview === null) return 'never'
    if (daysSinceReview >= interval) return 'overdue'
    const window = Math.min(DUE_SOON_MAX_DAYS, Math.floor(interval / 3))
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

/** Good doubles the interval (cap 90), shaky keeps it, failed resets it to 3 and drops Mastered to Rusty. */
export function reviewOutcome(
    result: ReviewResult,
    current: { level: number | null; interval: number | null; count: number | null },
    date: string
): ReviewOutcome {
    const interval =
        current.interval && current.interval > 0 ? current.interval : REVIEW_FIRST_INTERVAL
    const out: ReviewOutcome = {
        lastReviewed: date,
        reviewCount: (current.count ?? 0) + 1,
        reviewInterval: interval
    }
    if (result === 'good') out.reviewInterval = Math.min(interval * 2, REVIEW_MAX_INTERVAL)
    if (result === 'failed') {
        out.reviewInterval = REVIEW_FIRST_INTERVAL
        if (current.level === LEVEL.MASTERED) out.level = LEVEL.RUSTY
    }
    return out
}

/** Reaching level 30 starts the review cycle when no interval is set yet. */
export function intervalOnLevelChange(newLevel: number, interval: number | null): number | null {
    return newLevel >= LEVEL.SLOW && !interval ? REVIEW_FIRST_INTERVAL : null
}
