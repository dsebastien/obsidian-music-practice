import { describe, expect, it } from 'bun:test'
import { createDefaultFieldNames } from './fields'
import {
    buildLocalModel,
    createDefaultLocalModel,
    expandTokens,
    localStatusValues
} from './local-model'
import { createDefaultRules } from './rules'

const rules = createDefaultRules()
const fields = createDefaultFieldNames()
const local = createDefaultLocalModel()

describe('standalone note model', () => {
    const model = buildLocalModel(
        [
            { tags: ['type/music/guitar/chord', 'zone/areas'], level: 20 },
            { tags: ['type/music/guitar/chord'], level: 60 },
            { tags: ['type/music/piano/scale'], level: 10 },
            { tags: ['type/music/exercise'], level: 30 },
            // No level: not a learning note.
            { tags: ['type/media/book'], level: null },
            // Session tags never become learning types.
            { tags: ['type/session/music/guitar'], level: 20 },
            // Too short to be a type tag.
            { tags: ['type/thing'], level: 20 }
        ],
        local,
        rules,
        fields
    )

    it('infers learning types from tagged notes with a level', () => {
        expect(model.learningTypes.map((t) => [t.typeTag, t.name, t.subject, t.kind])).toEqual([
            ['type/music/exercise', 'Exercises', null, 'exercise'],
            ['type/music/guitar/chord', 'Guitar Chords', 'guitar', 'chord'],
            ['type/music/piano/scale', 'Piano Scales', 'piano', 'scale']
        ])
    })

    it('uses the configured levels, names and stamps', () => {
        const chords = model.learningTypes[1]!
        expect(chords.statusProperty).toBe('mastery')
        expect(chords.statusValues).toEqual(localStatusValues(local, rules))
        expect(chords.statusValues[1]).toBe('20 - Learning')
        expect(chords.stamps).toEqual({
            '20 - Learning': 'date_started',
            '60 - Mastered': 'date_mastered'
        })
        expect(chords.fields.has('bpm_target')).toBe(true)
        expect(chords.topPriority).toBe(10)
    })

    it('creates one session type per subject, with its naming', () => {
        expect(model.sessionTypes.map((s) => [s.typeTag, s.name])).toEqual([
            ['type/session/music/guitar', 'Guitar Practice Sessions'],
            ['type/session/music/piano', 'Piano Practice Sessions']
        ])
        expect(model.sessionTypes[0]!.naming).toEqual({
            folder: 'Practice sessions/{Subject}/{year}',
            prefix: '',
            suffix: ' ({Subject} Practice Session)'
        })
    })

    it('expands folder and name tokens', () => {
        expect(
            expandTokens(
                'Practice sessions/{Subject}/{year}/{month}',
                '2026-10-28',
                'music',
                'bass_guitar'
            )
        ).toBe('Practice sessions/Bass Guitar/2026/10')
        expect(
            expandTokens(
                ' ({Subject} Practice Session) {date} {domain}/{subject}',
                '2026-10-28',
                'music',
                'piano'
            )
        ).toBe(' (Piano Practice Session) 2026-10-28 music/piano')
    })
})
