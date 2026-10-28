import { describe, expect, it } from 'bun:test'
import { buildPlan } from './plan'
import { computeItems } from './practice'
import { input } from './practice.spec'
import { reviewOutcome, reviewStatus } from './review'
import { createDefaultRules } from './rules'
import type { PracticeRules } from './rules'

/** A 1–6 scale with a longer review cycle and an even plan split. */
function customRules(): PracticeRules {
    const rules = createDefaultRules()
    rules.levels = { want: 1, learning: 2, slow: 3, tempo: 4, rusty: 5, mastered: 6 }
    rules.review.firstInterval = 7
    rules.review.goodMultiplier = 3
    rules.review.maxInterval = 60
    rules.plan.split = [25, 25, 25, 25]
    return rules
}

describe('configurable rules', () => {
    it('reviews on a custom scale and cycle', () => {
        const rules = customRules()
        expect(reviewStatus(3, 7, 7, rules)).toBe('overdue')
        expect(reviewStatus(2, 7, 7, rules)).toBeNull()
        expect(reviewOutcome('good', { level: 4, interval: null, count: 0 }, 'd', rules)).toEqual({
            lastReviewed: 'd',
            reviewCount: 1,
            reviewInterval: 21
        })
        expect(
            reviewOutcome('good', { level: 4, interval: 30, count: 0 }, 'd', rules).reviewInterval
        ).toBe(60)
        expect(
            reviewOutcome('failed', { level: 6, interval: 30, count: 0 }, 'd', rules).level
        ).toBe(5)
    })

    it('computes readiness and the Rusty bonus on a custom scale', () => {
        const rules = customRules()
        const items = computeItems(
            [
                input('Base', { level: 3 }),
                input('Ready', { level: 1, prerequisites: ['Base'] }),
                input('Rusty', { level: 5, lastPracticed: '2026-10-28' })
            ],
            '2026-10-28',
            rules
        )
        expect(items[1]!.ready).toBe(true)
        // TBD 25 + 0 days + Rusty 10
        expect(items[2]!.score).toBe(35)
    })

    it('splits a plan by the configured percentages', () => {
        const rules = customRules()
        const items = computeItems(
            [
                input('Ex', { kind: 'exercise', level: 2 }),
                input('Chord', { level: 2 }),
                input('Song', {
                    kind: 'arrangement',
                    level: 4,
                    lastPracticed: '2026-10-01',
                    reviewInterval: 7
                })
            ],
            '2026-10-28',
            rules
        )
        expect(buildPlan(items, 40, rules).blocks.map((b) => b.minutes)).toEqual([10, 20, 10, 0])
    })
})
