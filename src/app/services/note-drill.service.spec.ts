import { describe, expect, it } from 'bun:test'
import { TFile } from 'obsidian'
import { NoteDrillService, type NoteDrillHost } from './note-drill.service'
import { createDefaultFieldNames } from '../domain/fields'
import type { LearningType, NoteModel } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import { DEFAULT_RULES } from '../domain/rules'
import { DEFAULT_DRILL_RULES, type Answer, type DrillSetting } from '../domain/note-drill'
import type { NewLearningNote } from './note-creator.service'

const fields = createDefaultFieldNames()
const STATUS = [
    '10 - Want to learn',
    '20 - Learning',
    '30 - Can play slowly',
    '40 - Can play at tempo',
    '50 - Rusty',
    '60 - Mastered'
]

const type = (subject: string, kind: string, extra: string[] = []): LearningType => ({
    id: `${subject}-${kind}`,
    name: `${subject} ${kind}`,
    typeTag: `type/music/${subject}/${kind}`,
    domain: 'music',
    subject,
    kind,
    tags: [],
    statusProperty: 'mastery',
    statusValues: STATUS,
    stamps: {},
    fields: new Set([
        'mastery',
        fields.lastReviewed,
        fields.reviewCount,
        fields.reviewInterval,
        ...extra
    ]),
    topPriority: 10,
    templatePath: null,
    allowedValues: {}
})

const drillFields = [fields.drillKind, fields.drillSetting, fields.drillStats, fields.trains]
const types = [
    type('guitar', 'exercise', drillFields),
    type('piano', 'exercise', drillFields),
    type('guitar', 'chord', [fields.chordSymbol, fields.chordRoot, fields.chordQuality]),
    type('guitar', 'scale', [fields.scaleRoot, fields.scaleType]),
    type('guitar', 'arrangement'),
    type('piano', 'chord', [fields.chordSymbol])
]

const item = (path: string, typeId: string, over: Partial<LearningItem> = {}): LearningItem =>
    ({
        path,
        name: path.replace(/^.*\//, '').replace(/\.md$/, ''),
        kind: typeId.split('-')[1]!,
        typeId,
        level: 20,
        priority: null,
        topPriority: 10,
        reviewInterval: null,
        reviewCount: null,
        focus: false,
        missingPrerequisites: [],
        prerequisites: [],
        links: [],
        ...over
    }) as LearningItem

function setup(
    notes: Record<
        string,
        {
            fm: Record<string, unknown>
            body?: string
            item?: Partial<LearningItem> & { typeId: string }
        }
    >,
    model: LearningType[] = types
) {
    const store = new Map(
        Object.entries(notes).map(([p, n]) => [p, { fm: { ...n.fm }, body: n.body ?? '' }])
    )
    const created: { type: string; spec: NewLearningNote }[] = []
    const file = (path: string): TFile =>
        Object.assign(new TFile(), {
            path,
            basename: path.replace(/^.*\//, '').replace(/\.md$/, '')
        })
    const host: NoteDrillHost = {
        vault: {
            getFileByPath: (path: string) => (store.has(path) ? file(path) : null),
            cachedRead: (f: TFile) => Promise.resolve(store.get(f.path)?.body ?? '')
        },
        metadataCache: {
            getFileCache: (f: TFile) => ({ frontmatter: store.get(f.path)?.fm ?? {} })
        },
        fileManager: {
            processFrontMatter: (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
                fn(store.get(f.path)!.fm)
                return Promise.resolve()
            }
        }
    }
    const items = () =>
        Object.entries(notes)
            .filter(([, n]) => n.item)
            .map(([p, n]) => item(p, n.item!.typeId, n.item))
    const service = new NoteDrillService(host, {
        model: () => modelOf(model),
        items: () => [
            ...items(),
            ...created
                .filter((c) => !Object.keys(notes).includes(`${c.spec.title}.md`))
                .map((c) => item(`${c.spec.title}.md`, c.type, { level: c.spec.level ?? 10 }))
        ],
        fields: () => fields,
        rules: () => DEFAULT_RULES,
        drillRules: () => DEFAULT_DRILL_RULES,
        create: (t: LearningType, spec: NewLearningNote) => {
            created.push({ type: t.id, spec })
            store.set(`${spec.title}.md`, { fm: { ...(spec.properties ?? {}) }, body: '' })
            return Promise.resolve(file(`${spec.title}.md`))
        },
        today: () => '2026-11-08'
    })
    return { service, store, created }
}

/** The message a promise rejects with ('' when it resolves). */
const failure = (p: Promise<unknown>): Promise<string> =>
    p.then(
        () => '',
        (e: unknown) => (e instanceof Error ? e.message : String(e))
    )

/** A note model of these types (a test double). */
const modelOf = (learningTypes: LearningType[]): NoteModel => {
    const value: unknown = { learningTypes }
    return value as NoteModel
}

const string5: DrillSetting = { kind: 'fretboard', strings: [5], frets: [0, 5], ask: 'both' }
const answers: Answer[] = [
    { spot: 's5f3', answer: 'C', right: true, seconds: 1.2 },
    { spot: 's5f1', answer: 'A#', right: false, seconds: 4 }
]

describe('NoteDrillService: the drill note', () => {
    it('finds a drill note by its kind and setting, in the instrument exercise type', () => {
        const { service } = setup({
            'Fretboard notes, string 5, frets 0-5 (Guitar Exercise).md': {
                fm: {
                    drill_kind: 'Fretboard notes',
                    drill_setting: 'string 5, frets 0-5',
                    drill_stats: ['s5f3 C: 1/2 3s']
                },
                item: { typeId: 'guitar-exercise' }
            },
            'Other (Guitar Exercise).md': { fm: {}, item: { typeId: 'guitar-exercise' } }
        })
        const note = service.noteFor(string5)
        expect(note?.path).toBe('Fretboard notes, string 5, frets 0-5 (Guitar Exercise).md')
        expect(service.statsOf(note!.path).stats.get('s5f3')?.asked).toBe(2)
        expect(service.noteFor({ ...string5, frets: [0, 12] })).toBeNull()
        expect(service.drillOf(note!.path)).toEqual(string5)
        expect(service.drillOf('Other (Guitar Exercise).md')).toBeNull()
    })

    it('creates the drill note on the first save, then writes kind, setting, map and review', async () => {
        const { service, store, created } = setup({})
        const saved = await service.save(string5, answers)
        expect(created).toHaveLength(1)
        expect(created[0]!.type).toBe('guitar-exercise')
        expect(created[0]!.spec.title).toBe('Fretboard notes, string 5, frets 0-5')
        expect(created[0]!.spec.level).toBe(DEFAULT_RULES.levels.learning)
        const fm = store.get(saved.path)!.fm
        expect(fm['drill_kind']).toBe('Fretboard notes')
        expect(fm['drill_setting']).toBe('string 5, frets 0-5')
        expect(fm['drill_stats']).toEqual(['s5f1 A#: 0/1 4s', 's5f3 C: 1/1 1.2s, 1 in a row'])
        // 1 right out of 2: failed.
        expect(saved.score.share).toBe(0.5)
        expect(saved.review).toBe('failed')
        expect(fm['last_reviewed']).toBe('2026-11-08')
        expect(fm['review_count']).toBe(1)
    })

    it('merges into the map of an existing note, keeping items it does not read', async () => {
        const path = 'Fretboard notes, string 5, frets 0-5 (Guitar Exercise).md'
        const { service, store, created } = setup({
            [path]: {
                fm: {
                    drill_kind: 'Fretboard notes',
                    drill_setting: 'string 5, frets 0-5',
                    drill_stats: ['s5f3 C: 1/2 3s', 'my note'],
                    review_count: 2,
                    review_interval: 3
                },
                item: { typeId: 'guitar-exercise', reviewCount: 2, reviewInterval: 3 }
            }
        })
        const many: Answer[] = Array.from({ length: 10 }, () => ({
            spot: 's5f3',
            answer: 'C',
            right: true,
            seconds: 1
        }))
        const saved = await service.save(string5, many)
        expect(created).toHaveLength(0)
        expect(saved.path).toBe(path)
        const fm = store.get(path)!.fm
        expect(fm['drill_stats']).toEqual(['s5f3 C: 11/12 1.3s, 10 in a row', 'my note'])
        expect(saved.review).toBe('good')
        expect(fm['review_count']).toBe(3)
        expect(fm['review_interval']).toBe(6)
    })

    it('refuses to save when the exercise type lacks a drill property, naming it', async () => {
        const lacking = types.map((t) =>
            t.id === 'guitar-exercise' ? type('guitar', 'exercise', [fields.drillKind]) : t
        )
        const { service } = setup({}, lacking)
        expect(await failure(service.save(string5, answers))).toContain('"drill_setting"')
        const none = setup(
            {},
            types.filter((t) => t.id !== 'guitar-exercise')
        ).service
        expect(await failure(none.save(string5, answers))).toContain('guitar exercise')
    })

    it('keeps keyboard drills in the piano exercise type', async () => {
        const { service, created } = setup({})
        await service.save({ kind: 'keyboard', keys: [48, 71], ask: 'both' }, [
            { spot: 'C3', answer: '', right: true, seconds: 1 }
        ])
        expect(created[0]!.type).toBe('piano-exercise')
        expect(created[0]!.spec.title).toBe('Keyboard notes, keys C3-B4')
    })
})

describe('NoteDrillService: what to ask', () => {
    const chords = {
        'C Major.md': { fm: { chord_symbol: 'C' }, item: { typeId: 'guitar-chord', focus: true } },
        'G Major.md': { fm: { chord_symbol: 'G' }, item: { typeId: 'guitar-chord', focus: true } },
        'G Seventh.md': { fm: { chord_symbol: 'G7' }, item: { typeId: 'guitar-chord', level: 60 } },
        'A Minor.md': { fm: { chord_symbol: 'Am' }, item: { typeId: 'guitar-chord', level: 10 } }
    }

    it('asks the chords of my notes: the focus ones first, a family when given', async () => {
        const { service } = setup(chords)
        expect(
            await service.pool({ kind: 'chords', instrument: 'guitar', source: 'notes' })
        ).toEqual(['C', 'G'])
        expect(
            await service.pool({
                kind: 'chords',
                instrument: 'guitar',
                source: 'notes',
                family: '7th'
            })
        ).toEqual(['G7'])
    })

    it('asks the chords my pieces play without a chord note', async () => {
        const { service } = setup({
            ...chords,
            'Song (Guitar Arrangement).md': {
                fm: {},
                body: '```chords\n[G]a [D]b [Em]c [C]d\n```',
                item: { typeId: 'guitar-arrangement' }
            }
        })
        expect(
            await service.pool({ kind: 'chords', instrument: 'guitar', source: 'pieces' })
        ).toEqual(['D', 'Em'])
    })

    it('asks the chords and scales my focus needs that have no note yet', async () => {
        const { service } = setup({
            ...chords,
            'Song (Guitar Arrangement).md': {
                fm: {},
                item: {
                    typeId: 'guitar-arrangement',
                    focus: true,
                    missingPrerequisites: [
                        'F Major - Barre (Guitar Chord)',
                        'A Minor Pentatonic (Guitar Scale)',
                        'Palm muting'
                    ]
                }
            }
        })
        expect(
            await service.pool({ kind: 'chords', instrument: 'guitar', source: 'focus' })
        ).toEqual(['F'])
        expect(
            await service.pool({
                kind: 'scales',
                instrument: 'guitar',
                source: 'focus',
                ask: 'name'
            })
        ).toEqual(['A minor pentatonic'])
    })

    it('asks a library family, and the scales of my notes', async () => {
        const { service } = setup({
            'A Minor Pentatonic (Guitar Scale).md': {
                fm: { scale_root: 'A', scale_type: 'Minor pentatonic' },
                item: { typeId: 'guitar-scale' }
            }
        })
        expect(
            await service.pool({
                kind: 'chords',
                instrument: 'guitar',
                source: 'library',
                family: 'Minor'
            })
        ).toHaveLength(12)
        expect(
            await service.pool({
                kind: 'scales',
                instrument: 'guitar',
                source: 'notes',
                ask: 'name'
            })
        ).toEqual(['A minor pentatonic'])
        expect(
            (
                await service.pool({
                    kind: 'scales',
                    instrument: 'guitar',
                    source: 'library',
                    ask: 'name'
                })
            ).length
        ).toBeGreaterThan(100)
    })

    it('finds the note of a chord or scale, and creates a missing one through its type', async () => {
        const { service, created } = setup(chords)
        expect(service.noteOf('chords', 'G7', 'guitar')).toBe('G Seventh.md')
        expect(service.noteOf('chords', 'D', 'guitar')).toBeNull()
        const path = await service.createNote('chords', 'F#m7', 'guitar')
        expect(created[0]!.type).toBe('guitar-chord')
        expect(created[0]!.spec.title).toBe('F Sharp Minor 7')
        expect(created[0]!.spec.chordSymbol).toBe('F#m7')
        expect(created[0]!.spec.voicing?.frets).toHaveLength(6)
        expect(created[0]!.spec.block).toBe('chord')
        expect(path).toBe('F Sharp Minor 7.md')
        await service.createNote('scales', 'A minor pentatonic', 'guitar')
        expect(created[1]!.spec.title).toBe('A Minor pentatonic')
        expect(created[1]!.spec.properties).toEqual({
            scale_root: 'A',
            scale_type: 'Minor pentatonic'
        })
        expect(created[1]!.spec.block).toBe('fretboard')
    })
})
