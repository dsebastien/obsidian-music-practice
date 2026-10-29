import { describe, expect, it } from 'bun:test'
import { panelItemsFrom, toLog, withPaths } from './panel'

describe('practice panel list', () => {
    it('keeps only well-formed items, each path once', () => {
        expect(
            panelItemsFrom([
                { path: 'A.md', done: true, bpm: 80 },
                { path: 'A.md', done: false },
                { path: 'B.md', bpm: -3 },
                'C.md',
                null
            ])
        ).toEqual([
            { path: 'A.md', done: true, bpm: 80 },
            { path: 'B.md', done: false }
        ])
        expect(panelItemsFrom('nope')).toEqual([])
    })

    it('adds a plan without repeating items', () => {
        expect(withPaths([{ path: 'A.md', done: true }], ['A.md', 'B.md', 'B.md'])).toEqual([
            { path: 'A.md', done: true },
            { path: 'B.md', done: false }
        ])
    })

    it('logs the ticked items, or all when none is ticked, with their BPMs', () => {
        const items = [
            { path: 'A.md', done: true, bpm: 90 },
            { path: 'B.md', done: false, bpm: 70 }
        ]
        expect(toLog(items)).toEqual({ paths: ['A.md'], bpms: { 'A.md': 90 } })
        expect(toLog(items.map((i) => ({ ...i, done: false })))).toEqual({
            paths: ['A.md', 'B.md'],
            bpms: { 'A.md': 90, 'B.md': 70 }
        })
    })
})
