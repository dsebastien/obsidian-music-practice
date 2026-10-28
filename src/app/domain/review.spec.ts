import { describe, expect, it } from 'bun:test'
import { intervalOnLevelChange, reviewOutcome, reviewStatus } from './review'

describe('reviewStatus', () => {
    it('ignores items below level 30 or without an interval', () => {
        expect(reviewStatus(20, 3, 10)).toBeNull()
        expect(reviewStatus(40, null, 10)).toBeNull()
        expect(reviewStatus(null, 3, 10)).toBeNull()
    })

    it('is never when the item was neither reviewed nor practiced', () => {
        expect(reviewStatus(30, 3, null)).toBe('never')
    })

    it('is overdue once the days reach the interval', () => {
        expect(reviewStatus(30, 6, 6)).toBe('overdue')
        expect(reviewStatus(60, 6, 9)).toBe('overdue')
    })

    it('is due soon within min(3, interval / 3) days of the interval', () => {
        expect(reviewStatus(40, 6, 4)).toBe('due-soon')
        expect(reviewStatus(40, 6, 3)).toBe('current')
        expect(reviewStatus(40, 30, 27)).toBe('due-soon')
        expect(reviewStatus(40, 30, 26)).toBe('current')
        expect(reviewStatus(40, 3, 2)).toBe('due-soon')
    })
})

describe('reviewOutcome', () => {
    const item = { level: 40, interval: 6, count: 2 }

    it('doubles the interval on good, capped at 90', () => {
        expect(reviewOutcome('good', item, '2026-10-28')).toEqual({
            lastReviewed: '2026-10-28',
            reviewCount: 3,
            reviewInterval: 12
        })
        expect(reviewOutcome('good', { ...item, interval: 60 }, 'd').reviewInterval).toBe(90)
    })

    it('keeps the interval on shaky', () => {
        expect(reviewOutcome('shaky', item, 'd').reviewInterval).toBe(6)
    })

    it('resets to 3 on failed and drops Mastered to Rusty', () => {
        expect(reviewOutcome('failed', item, 'd')).toEqual({
            lastReviewed: 'd',
            reviewCount: 3,
            reviewInterval: 3
        })
        expect(reviewOutcome('failed', { ...item, level: 60 }, 'd').level).toBe(50)
    })

    it('starts from 3 days when no interval is set', () => {
        expect(reviewOutcome('good', { level: 30, interval: null, count: null }, 'd')).toEqual({
            lastReviewed: 'd',
            reviewCount: 1,
            reviewInterval: 6
        })
    })
})

describe('intervalOnLevelChange', () => {
    it('sets 3 days when an item reaches 30 without an interval', () => {
        expect(intervalOnLevelChange(30, null)).toBe(3)
        expect(intervalOnLevelChange(30, 12)).toBeNull()
        expect(intervalOnLevelChange(20, null)).toBeNull()
    })
})
