import { describe, expect, it } from 'bun:test'
import { levelOf, labelFor } from './mastery'
import { computeItems, practiceNext, readyToLearn } from './practice'
import type { LearningItemInput } from './practice'

const TODAY = '2026-10-28'

export function input(name: string, over: Partial<LearningItemInput> = {}): LearningItemInput {
    return {
        path: `${name}.md`,
        name,
        kind: 'chord',
        typeId: 'guitar-chords',
        level: 20,
        priority: null,
        topPriority: 10,
        lastPracticed: null,
        lastReviewed: null,
        reviewInterval: null,
        reviewCount: null,
        bpmCurrent: null,
        bpmTarget: null,
        prerequisites: [],
        links: [],
        ...over
    }
}

describe('levelOf / labelFor', () => {
    it('reads the leading number of a status value', () => {
        expect(levelOf('20 - Learning')).toBe(20)
        expect(levelOf(' 60 - Mastered')).toBe(60)
        expect(levelOf(40)).toBe(40)
        expect(levelOf('Learning')).toBeNull()
        expect(levelOf(null)).toBeNull()
    })

    it("finds a type's own label for a level", () => {
        expect(labelFor(50, ['10 - Want to learn', '50 - Rusty'])).toBe('50 - Rusty')
        expect(labelFor(30, ['10 - Want to learn'])).toBeNull()
    })
})

describe('computeItems', () => {
    it('scores priority, staleness, BPM gap, unlocks and Rusty', () => {
        const [never] = computeItems([input('A')], TODAY)
        // priority TBD 25 + never practiced 30
        expect(never!.score).toBe(55)

        const [top] = computeItems(
            [
                input('B', {
                    priority: 10,
                    lastPracticed: '2026-10-18',
                    bpmCurrent: 60,
                    bpmTarget: 120
                })
            ],
            TODAY
        )
        // 60 + min(10, 30) + (100 - 50) / 5
        expect(top!.score).toBe(80)
        expect(top!.bpmProgress).toBe(50)
        expect(top!.focus).toBe(true)

        const [rusty] = computeItems(
            [
                input('C', {
                    level: 50,
                    priority: 30,
                    lastPracticed: '2026-10-22',
                    reviewInterval: 3
                })
            ],
            TODAY
        )
        // 40 + min(6 / 3, 3) * 10 + 10
        expect(rusty!.score).toBe(70)
    })

    it('counts unlocks from items at Want to learn linking to the item', () => {
        const items = computeItems(
            [
                input('E Major'),
                input('Song', { level: 10, links: ['E Major'] }),
                input('Other', { level: 30, links: ['E Major'] })
            ],
            TODAY
        )
        expect(items[0]!.unlocks).toBe(1)
    })

    it('is ready to learn when every prerequisite is at 30 or above', () => {
        const items = computeItems(
            [
                input('Base', { level: 30 }),
                input('Weak', { level: 20 }),
                input('Ready', { level: 10, prerequisites: ['Base'] }),
                input('Blocked', { level: 10, prerequisites: ['Weak'] }),
                input('Missing', { level: 10, prerequisites: ['Nowhere'] })
            ],
            TODAY
        )
        const byName = new Map(items.map((i) => [i.name, i]))
        expect(byName.get('Ready')!.ready).toBe(true)
        expect(byName.get('Blocked')!.ready).toBe(false)
        expect(byName.get('Missing')!.missingPrerequisites).toEqual(['Nowhere'])
        expect(readyToLearn(items).map((i) => i.name)).toEqual(['Ready'])
    })

    it('uses the last practice for review when never reviewed', () => {
        const [item] = computeItems(
            [input('R', { level: 40, lastPracticed: '2026-10-20', reviewInterval: 6 })],
            TODAY
        )
        expect(item!.daysSinceReview).toBe(8)
        expect(item!.review).toBe('overdue')
    })

    it('ranks active and due items for "practice next"', () => {
        const items = computeItems(
            [
                input('Wish', { level: 10 }),
                input('Low', { level: 20, priority: 60, lastPracticed: TODAY }),
                input('High', { level: 20, priority: 10 }),
                input('Mastered due', { level: 60, lastPracticed: '2026-10-01', reviewInterval: 6 })
            ],
            TODAY
        )
        expect(practiceNext(items).map((i) => i.name)).toEqual(['High', 'Mastered due', 'Low'])
    })
})
