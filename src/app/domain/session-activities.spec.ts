import { describe, expect, it } from 'bun:test'
import {
    activityForSessionType,
    closestActivities,
    proposedActivityName,
    sessionTypesOf,
    usesSessionTypes,
    withSessionType,
    withoutSessionType
} from './session-activities'
import type { ActivityNote } from './session-activities'

const FIELD = 'session_types'
const activity = (name: string, types?: unknown): ActivityNote => ({
    path: `Activities/${name}.md`,
    name,
    frontmatter: types === undefined ? {} : { session_types: types }
})

describe('session types of an activity', () => {
    it('reads a list or a single value, trimmed, any key case', () => {
        expect(sessionTypesOf({ session_types: [' running-sessions ', '', null] }, FIELD)).toEqual([
            'running-sessions'
        ])
        expect(sessionTypesOf({ Session_Types: 'walking-sessions' }, FIELD)).toEqual([
            'walking-sessions'
        ])
        expect(sessionTypesOf({ session_types: null }, FIELD)).toEqual([])
        expect(sessionTypesOf(undefined, FIELD)).toEqual([])
    })

    it('adds a type once and removes it', () => {
        expect(withSessionType(null, 'guitar-practice-sessions')).toEqual([
            'guitar-practice-sessions'
        ])
        expect(withSessionType(['a'], 'a')).toEqual(['a'])
        expect(withSessionType('a', 'b')).toEqual(['a', 'b'])
        expect(withoutSessionType(['a', 'b'], 'a')).toEqual(['b'])
    })
})

describe('which activity a session type counts for', () => {
    const guitar = activity('Learn Guitar (Activity)', ['guitar-practice-sessions'])
    const piano = activity('Learn Piano (Activity)', ['piano-practice-sessions'])
    const workout = activity('Workout (Activity)', ['workout-sessions', 'strength-sessions'])

    it('maps a type to the one activity listing it', () => {
        expect(
            activityForSessionType([piano, guitar, workout], 'guitar-practice-sessions', FIELD)
        ).toEqual({ kind: 'mapped', activity: guitar })
        expect(activityForSessionType([workout], 'strength-sessions', FIELD)).toEqual({
            kind: 'mapped',
            activity: workout
        })
    })

    it('maps a type listed by two activities to neither', () => {
        const other = activity('Guitar Lessons (Activity)', 'guitar-practice-sessions')
        expect(
            activityForSessionType([guitar, other, piano], 'guitar-practice-sessions', FIELD)
        ).toEqual({ kind: 'conflict', activities: [guitar, other] })
    })

    it('leaves an unlisted type unmapped', () => {
        expect(activityForSessionType([piano], 'guitar-practice-sessions', FIELD)).toEqual({
            kind: 'unmapped'
        })
    })

    it('tells whether the vault lists session types anywhere', () => {
        expect(usesSessionTypes([{}, { session_types: [] }, undefined], FIELD)).toBe(false)
        expect(usesSessionTypes([{}, { session_types: ['x'] }], FIELD)).toBe(true)
    })
})

describe('a new activity', () => {
    it('proposes the name from the activity setting', () => {
        expect(proposedActivityName('Learn {subject}', 'guitar')).toBe('Learn Guitar')
        expect(proposedActivityName('Practice {subject}', 'bass_guitar')).toBe(
            'Practice Bass Guitar'
        )
    })

    it('offers the closest activities first', () => {
        const names = ['Run', 'Learn Piano', 'Guitar Lessons', 'Learn Languages', 'Walk'].map(
            (name) => ({ name })
        )
        expect(closestActivities(names, 'Learn Guitar', 'guitar').map((a) => a.name)).toEqual([
            'Guitar Lessons',
            'Learn Languages',
            'Learn Piano',
            'Run',
            'Walk'
        ])
    })
})
