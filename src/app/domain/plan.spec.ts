import { describe, expect, it } from 'bun:test'
import { buildPlan } from './plan'
import { computeItems } from './practice'
import { input } from './practice.spec'

const TODAY = '2026-10-28'

describe('buildPlan', () => {
    const items = computeItems(
        [
            input('Spider walk', { kind: 'exercise', level: 30 }),
            input('Alternate picking', { kind: 'technique', level: 20 }),
            input('F barre', { level: 20, priority: 10 }),
            input('G Major', { level: 30, priority: 30 }),
            input('Due chord', { level: 40, lastPracticed: '2026-10-10', reviewInterval: 6 }),
            input('Song', { kind: 'arrangement', level: 40, lastPracticed: '2026-09-01' })
        ],
        TODAY
    )

    it('splits a session into warm-up, focus, review and fun', () => {
        const plan = buildPlan(items, 40)
        const names = Object.fromEntries(
            plan.blocks.map((b) => [b.block, b.items.map((p) => p.item.name)])
        )
        expect(names['warm-up']).toEqual(['Alternate picking'])
        expect(names['focus']![0]).toBe('F barre')
        expect(names['review']).toEqual(['Due chord', 'Song'].slice(0, names['review']!.length))
        expect(plan.blocks.map((b) => b.minutes)).toEqual([6, 20, 8, 6])
    })

    it('never plans the same item twice', () => {
        const plan = buildPlan(items, 60)
        const all = plan.blocks.flatMap((b) => b.items.map((p) => p.item.path))
        expect(new Set(all).size).toBe(all.length)
    })

    it('hands the minutes of empty blocks to focus', () => {
        const only = computeItems([input('Solo', { level: 20 })], TODAY)
        const plan = buildPlan(only, 30)
        expect(plan.blocks.find((b) => b.block === 'focus')!.minutes).toBe(30)
        expect(plan.blocks.filter((b) => b.block !== 'focus').every((b) => b.minutes === 0)).toBe(
            true
        )
    })
})
