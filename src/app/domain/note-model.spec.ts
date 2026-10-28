import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import { learningTypeOf, mergeTags, tagsOf, toLearningItemInput } from './item-reader'
import { buildNoteModel, sessionTypeFor } from './note-model'
import type { TypeDescriptor } from './note-model'
import { createDefaultRules } from './rules'

const MASTERY = [
    '10 - Want to learn',
    '20 - Learning',
    '30 - Can play slowly',
    '40 - Can play at tempo',
    '50 - Rusty',
    '60 - Mastered'
]
const props = (...names: string[]) => names.map((name) => ({ name }))

const types: TypeDescriptor[] = [
    {
        id: 'gc',
        name: 'Guitar Chords',
        tags: ['zone/areas', 'type/music/guitar/chord'],
        properties: [
            ...props('mastery', 'date_last_practiced', 'bpm_current', 'prerequisites'),
            { name: 'priority', allowedValues: ['10 - Top', '20 - High', '99 - TBD'] }
        ],
        status: { property: 'mastery', values: MASTERY }
    },
    {
        id: 'me',
        name: 'Music Exercises',
        tags: ['type/music/exercise'],
        properties: props('mastery', 'date_last_practiced'),
        status: { property: 'mastery', values: MASTERY }
    },
    {
        id: 'tasks',
        name: 'Tasks',
        tags: ['type/task'],
        properties: props('status', 'date_last_practiced'),
        status: { property: 'status', values: ['10 - Backlog', '80 - Done'] }
    },
    {
        id: 'nopractice',
        name: 'Music Theory',
        tags: ['type/music/theory'],
        properties: props('mastery'),
        status: { property: 'mastery', values: MASTERY }
    },
    {
        id: 'gs',
        name: 'Guitar Practice Sessions',
        tags: ['zone/journal', 'type/session/music/guitar'],
        properties: props('date', 'time_spent', 'practiced'),
        status: null
    }
]

describe('buildNoteModel', () => {
    const model = buildNoteModel(types, createDefaultRules(), createDefaultFieldNames())

    it('keeps types on the mastery scale with the last-practiced field', () => {
        expect(model.learningTypes.map((t) => t.id)).toEqual(['gc', 'me'])
    })

    it('reads domain, subject and kind from the type tag', () => {
        const [chords, exercises] = model.learningTypes
        expect([chords!.domain, chords!.subject, chords!.kind]).toEqual([
            'music',
            'guitar',
            'chord'
        ])
        expect([exercises!.domain, exercises!.subject, exercises!.kind]).toEqual([
            'music',
            null,
            'exercise'
        ])
    })

    it("takes the type's top priority from its allowed values (TBD excluded)", () => {
        expect(model.learningTypes[0]!.topPriority).toBe(10)
        expect(model.learningTypes[1]!.topPriority).toBeNull()
    })

    it('pairs a learning type with the session type of its subject', () => {
        expect(model.sessionTypes.map((s) => s.id)).toEqual(['gs'])
        expect(sessionTypeFor(model, model.learningTypes[0]!)?.id).toBe('gs')
        expect(sessionTypeFor(model, model.learningTypes[1]!)).toBeNull()
    })
})

describe('item reader', () => {
    const fields = createDefaultFieldNames()
    const model = buildNoteModel(types, createDefaultRules(), fields)
    const fm = {
        tags: ['zone/areas', '#type/music/guitar/chord'],
        mastery: '30 - Can play slowly',
        priority: '10 - Top',
        date_last_practiced: '2026-10-20',
        bpm_current: '80',
        review_interval: 6,
        frets: '022100'
    }

    it('finds the learning type by tags and status property', () => {
        expect(tagsOf(fm)).toContain('type/music/guitar/chord')
        expect(learningTypeOf(model.learningTypes, fm)?.id).toBe('gc')
        expect(learningTypeOf(model.learningTypes, { tags: fm.tags })).toBeNull()
    })

    it('reads only the fields the type defines', () => {
        const input = toLearningItemInput(
            {
                path: 'E.md',
                basename: 'E',
                frontmatter: fm,
                propertyLinks: { prerequisites: ['A'] },
                allLinks: ['A', 'Theory']
            },
            model.learningTypes[0]!,
            fields
        )
        expect(input).toMatchObject({
            level: 30,
            priority: 10,
            topPriority: 10,
            lastPracticed: '2026-10-20',
            bpmCurrent: 80,
            // review_interval isn't a field of this type
            reviewInterval: null,
            prerequisites: ['A'],
            kind: 'chord'
        })
    })
})

describe('tags', () => {
    it('reads tags written as text, any case, with or without #', () => {
        expect(tagsOf({ tags: '#Type/Music/Guitar/Chord, zone/areas' })).toEqual([
            'type/music/guitar/chord',
            'zone/areas'
        ])
        expect(tagsOf({ tags: 'a b' })).toEqual(['a', 'b'])
        expect(tagsOf({})).toEqual([])
    })

    it('merges tags without dropping text tags or duplicating', () => {
        expect(mergeTags('zone/journal, #Mine', ['type/session/music/guitar', 'mine'])).toEqual([
            'zone/journal',
            '#Mine',
            'type/session/music/guitar'
        ])
        expect(mergeTags(undefined, ['a'])).toEqual(['a'])
    })

    it('prefers the most specific type when several match', () => {
        const model = buildNoteModel(
            [
                ...types,
                {
                    id: 'broad',
                    name: 'Broad',
                    tags: ['type/music/guitar/chord'],
                    properties: props('mastery', 'date_last_practiced'),
                    status: { property: 'mastery', values: MASTERY }
                }
            ],
            createDefaultRules(),
            createDefaultFieldNames()
        )
        const fm = { tags: ['zone/areas', 'type/music/guitar/chord'], mastery: '20 - Learning' }
        expect(learningTypeOf(model.learningTypes, fm)?.id).toBe('gc')
    })
})
