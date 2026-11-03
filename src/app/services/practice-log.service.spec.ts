import { describe, expect, it } from 'bun:test'
import type { App, TFile } from 'obsidian'
import { createDefaultFieldNames } from '../domain/fields'
import type { FileChanges } from '../domain/undo'
import { revert } from '../domain/undo'
import { PracticeLogService } from './practice-log.service'
import type { ActivityResult, LogContext } from './practice-log.service'

const fields = createDefaultFieldNames()
const ACTIVITY = 'Activities/Learn Guitar (Activity).md'
const SESSION = 'Sessions/2026-11-03 (Guitar Practice Session).md'
const OLD = 'Sessions/2026-11-01 (Guitar Practice Session).md'

const fake = <T>(value: unknown): T => value as T
const file = (path: string) =>
    fake<TFile>({ path, basename: path.substring(path.lastIndexOf('/') + 1).replace(/\.md$/, '') })

/** A vault of an activity and session notes, with Obsidian's link index already up to date. */
function vault(activity: Record<string, unknown>) {
    const notes: Record<string, Record<string, unknown>> = {
        [ACTIVITY]: activity,
        [SESSION]: {
            tags: ['type/session/music/guitar'],
            date: '2026-11-03',
            time_spent: 30,
            related_activities: ['[[Learn Guitar (Activity)]]']
        },
        [OLD]: {
            tags: ['type/session/music/guitar'],
            date: '2026-11-01',
            time_spent: 20,
            related_activities: ['[[Learn Guitar (Activity)]]']
        }
    }
    const byName = (link: string) =>
        Object.keys(notes).find((p) => file(p).basename === link) ?? null
    const app = fake<App>({
        vault: { getFileByPath: (p: string) => (notes[p] ? file(p) : null) },
        metadataCache: {
            resolvedLinks: { [SESSION]: { [ACTIVITY]: 1 }, [OLD]: { [ACTIVITY]: 1 } },
            getFileCache: (f: TFile) => ({ frontmatter: notes[f.path] }),
            getFirstLinkpathDest: (link: string) => {
                const p = byName(link)
                return p ? file(p) : null
            }
        },
        fileManager: {
            processFrontMatter: (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
                fn(notes[f.path]!)
                return Promise.resolve()
            }
        }
    })
    const context = () => ({ fields }) as LogContext
    const service = new PracticeLogService(app, () => ({}) as never, {} as never, context)
    const recompute = (adoptedStartMs: number | null, changes: FileChanges[]) =>
        fake<{
            recomputeActivity: (
                a: TFile,
                s: TFile,
                t: number | null,
                c: FileChanges[]
            ) => Promise<ActivityResult>
        }>(service).recomputeActivity(file(ACTIVITY), file(SESSION), adoptedStartMs, changes)
    return { notes, recompute }
}

describe('practice log: the activity time', () => {
    it('recomputes from the linked sessions, adds no time entry, and undoes', async () => {
        const { notes, recompute } = vault({ time_spent: 20, date_last_session: '2026-11-01' })
        const changes: FileChanges[] = []
        expect(await recompute(null, changes)).toBe('updated')
        expect(notes[ACTIVITY]).toEqual({ time_spent: 50, date_last_session: '2026-11-03' })
        expect(await recompute(null, [])).toBe('unchanged')
        revert(notes[ACTIVITY]!, changes[0]!.keys)
        expect(notes[ACTIVITY]).toEqual({ time_spent: 20, date_last_session: '2026-11-01' })
    })

    it("removes an adopted timer's entry, and undo puts it back", async () => {
        const start = new Date('2026-11-03T18:00:00').getTime()
        const timer = {
            startTime: '2026-11-03T18:00:05',
            endTime: '2026-11-03T18:30:00',
            description: 'Practice'
        }
        const { notes, recompute } = vault({ time_spent: 50, time_entries: [timer] })
        const changes: FileChanges[] = []
        expect(await recompute(start, changes)).toBe('updated')
        expect(notes[ACTIVITY]).toEqual({
            time_spent: 50,
            time_entries: [],
            date_last_session: '2026-11-03'
        })
        revert(notes[ACTIVITY]!, changes[0]!.keys)
        expect(notes[ACTIVITY]!['time_entries']).toEqual([timer])
    })

    it('leaves an activity whose time entries are not a list alone', async () => {
        const { notes, recompute } = vault({ time_spent: 5, time_entries: 'legacy' })
        expect(await recompute(null, [])).toBe('skipped')
        expect(notes[ACTIVITY]).toEqual({ time_spent: 5, time_entries: 'legacy' })
    })
})
