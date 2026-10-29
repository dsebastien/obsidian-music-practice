import { describe, expect, it } from 'bun:test'
import { bodyOf, changedKeys, conflicts, isUndoRecord, revert, snapshot } from './undo'

describe('undo', () => {
    const before = { mastery: '20 - Learning', bpm_current: 60, time_spent: 30 }
    const after = {
        mastery: '30 - Can play slowly',
        bpm_current: 60,
        time_spent: 45,
        date_last_practiced: '2026-10-29'
    }

    it('records the keys a log changed, added ones included', () => {
        expect(changedKeys(before, after)).toEqual([
            {
                key: 'mastery',
                existed: true,
                before: '20 - Learning',
                after: '30 - Can play slowly'
            },
            { key: 'time_spent', existed: true, before: 30, after: 45 },
            { key: 'date_last_practiced', existed: false, before: null, after: '2026-10-29' }
        ])
    })

    it('puts them back, removing the keys the log added', () => {
        const fm = snapshot(after)
        revert(fm, changedKeys(before, after))
        expect(fm).toEqual(before)
    })

    it('finds what changed since the log', () => {
        const changes = changedKeys(before, after)
        expect(conflicts(snapshot(after), changes)).toEqual([])
        expect(conflicts({ ...after, time_spent: 50 }, changes)).toEqual(['time_spent'])
        const { date_last_practiced: _gone, ...without } = after
        // A key the log added and that's gone again is already as before: no conflict.
        expect(conflicts(without, changes)).toEqual([])
    })

    it('lets an undo that stopped halfway run again', () => {
        const changes = changedKeys(before, after)
        // Already reverted: no conflict, and reverting again changes nothing.
        expect(conflicts(snapshot(before), changes)).toEqual([])
        const fm = snapshot(before)
        revert(fm, changes)
        expect(fm).toEqual(before)
    })

    it('keeps only the item a log appended to a list, and removes just that one', () => {
        const entries = [{ start: 'a' }, { start: 'b' }]
        const changes = changedKeys(
            { time_entries: entries },
            { time_entries: [...entries, { start: 'c' }] }
        )
        expect(changes).toEqual([
            {
                key: 'time_entries',
                existed: true,
                before: null,
                after: null,
                appended: { start: 'c' }
            }
        ])
        const fm: Record<string, unknown> = { time_entries: [...entries, { start: 'c' }] }
        expect(conflicts(fm, changes)).toEqual([])
        revert(fm, changes)
        expect(fm).toEqual({ time_entries: entries })
        // Another entry added since: the log's isn't last anymore.
        expect(
            conflicts({ time_entries: [...entries, { start: 'c' }, { start: 'd' }] }, changes)
        ).toEqual(['time_entries'])
    })

    it('survives being stored as JSON (keys the log removed have no value after)', () => {
        const changes = JSON.parse(
            JSON.stringify(changedKeys({ a: 1, b: 2 }, { a: 1 }))
        ) as ReturnType<typeof changedKeys>
        expect(conflicts({ a: 1 }, changes)).toEqual([])
        expect(conflicts({ a: 1, b: 3 }, changes)).toEqual(['b'])
        const fm: Record<string, unknown> = { a: 1 }
        revert(fm, changes)
        expect(fm).toEqual({ a: 1, b: 2 })
    })

    it("compares a session note by its body, which plugins don't stamp", () => {
        expect(bodyOf('---\nupdated: 1\n---\n# Session\ntext\n')).toBe(
            bodyOf('---\nupdated: 2\n---\r\n# Session\r\ntext')
        )
        expect(bodyOf('# No frontmatter')).toBe('# No frontmatter')
    })

    it('accepts only well-formed stored records', () => {
        const record = {
            at: 1,
            sessionPath: 'S.md',
            sessionBody: '',
            adoptedTimer: false,
            files: [{ path: 'A.md', keys: [{ key: 'mastery' }] }]
        }
        expect(isUndoRecord(record)).toBe(true)
        expect(isUndoRecord({ ...record, files: [{ path: 1 }] })).toBe(false)
        expect(isUndoRecord(null)).toBe(false)
    })
})
