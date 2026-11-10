import { describe, expect, it } from 'bun:test'
import {
    DEFAULT_DRILL_RULES,
    KIND_LABELS,
    drillDefaults,
    drillFileTitle,
    drillTitle,
    isEarKind,
    isRight,
    kindOfLabel,
    parseSetting,
    questions,
    seededRandom,
    settingWords,
    spotsOf,
    type DrillSetting,
    type SpotStat
} from './note-drill'

const stat = (spot: string, streak: number, right = 3, asked = 3): SpotStat => ({
    spot,
    answer: '',
    right,
    asked,
    seconds: 1,
    streak
})

describe('ear training kinds in the drills', () => {
    it('have their drill_kind values', () => {
        expect(KIND_LABELS['intervals-ear']).toBe('Intervals by ear')
        expect(KIND_LABELS['chords-ear']).toBe('Chords by ear')
        expect(KIND_LABELS['scales-ear']).toBe('Scales by ear')
        expect(KIND_LABELS['degrees-ear']).toBe('Degrees by ear')
        expect(kindOfLabel('degrees BY ear')).toBe('degrees-ear')
    })

    it('play their questions, as the drills by ear do', () => {
        expect(isEarKind('intervals-ear')).toBe(true)
        expect(isEarKind('scales')).toBe(false)
    })

    it('say and read their setting, the sound included', () => {
        const s = drillDefaults('intervals-ear', false)
        expect(settingWords(s)).toBe('m2-P8, up, piano')
        expect(drillTitle(s)).toBe('Intervals by ear, m2-P8, up, piano')
        expect(parseSetting('intervals-ear', 'm2-P8, up, piano')).toEqual(s)
        // The sound is in the words: the note's type never decides it.
        expect(parseSetting('chords-ear', 'major, minor, block, guitar', 'piano')).toEqual({
            kind: 'chords-ear',
            instrument: 'guitar',
            qualities: ['major', 'minor'],
            styles: ['block']
        })
        expect(parseSetting('degrees-ear', 'string 5, frets 0-5')).toBeNull()
    })

    it('spell sharps in the file name', () => {
        const s: DrillSetting = {
            kind: 'degrees-ear',
            instrument: 'piano',
            chromatic: false,
            key: 'F#'
        }
        expect(drillTitle(s)).toBe('Degrees by ear, diatonic, key F#, piano')
        expect(drillFileTitle(s)).toBe('Degrees by ear, diatonic, key F Sharp, piano')
    })

    it('list every spot of the setting for the map', () => {
        expect(spotsOf(drillDefaults('chords-ear', false))).toEqual([
            'major',
            'minor',
            'diminished',
            'augmented'
        ])
    })
})

describe('ear training questions', () => {
    const s = drillDefaults('intervals-ear', false)

    it('ask only the guided set, with its buttons', () => {
        const list = questions(s, {
            stats: new Map(),
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(1)
        })
        expect(list).toHaveLength(20)
        expect(new Set(list.map((q) => q.spot))).toEqual(new Set(['P8 up', 'M3 up']))
        for (const q of list) {
            expect(q.type).toBe('hear-name')
            if (q.type === 'hear-name') expect(q.choices).toEqual(['M3', 'P8'])
        }
    })

    it('ask the whole setting when guided is off', () => {
        const list = questions(s, {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, guided: false, questions: 100 },
            random: seededRandom(4)
        })
        expect(new Set(list.map((q) => q.spot)).size).toBe(12)
        const first = list[0]!
        if (first.type === 'hear-name') expect(first.choices).toHaveLength(12)
    })

    it('add the next item once the set is cleared, and ask its weak spots', () => {
        const stats = new Map([
            ['P8 up', stat('P8 up', 3)],
            ['M3 up', stat('M3 up', 3)]
        ])
        const list = questions(s, { stats, rules: DEFAULT_DRILL_RULES, random: seededRandom(2) })
        expect(new Set(list.map((q) => q.spot))).toEqual(new Set(['P8 up', 'M3 up', 'P5 up']))
        const weak = new Map([...stats, ['P5 up', stat('P5 up', 0, 1, 3)]])
        const again = questions(s, {
            stats: weak,
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(2)
        })
        const count = (spot: string) => again.filter((q) => q.spot === spot).length
        // The weak spot comes back most (never twice in a row).
        expect(count('P5 up')).toBeGreaterThan(count('P8 up'))
        expect(count('P5 up')).toBeGreaterThan(count('M3 up'))
    })

    it('are right on the button of the item asked', () => {
        const [q] = questions(s, {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
            random: seededRandom(3)
        })
        const answer = q!.spot.split(' ')[0]!
        expect(isRight(q!, { choice: answer })).toBe(true)
        expect(isRight(q!, { choice: answer === 'P8' ? 'M3' : 'P8' })).toBe(false)
    })
})
