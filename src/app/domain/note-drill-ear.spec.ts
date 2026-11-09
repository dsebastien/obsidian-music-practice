import { describe, expect, it } from 'bun:test'
import {
    DEFAULT_DRILL_RULES,
    KIND_LABELS,
    afterHear,
    drillDefaults,
    drillTitle,
    isRight,
    kindOfLabel,
    parseSetting,
    questions,
    seededRandom,
    settingWords,
    spotsOf,
    type DrillSetting,
    type Question,
    type SpotStat
} from './note-drill'
import { expectedShown, promptShown, spotShown } from './note-names'

/** Drills by ear (#91): a note sounds, you find it on the fretboard or the keyboard. */

const fretEar = (
    over: Partial<Extract<DrillSetting, { kind: 'fretboard-ear' }>> = {}
): DrillSetting => ({
    kind: 'fretboard-ear',
    strings: [5],
    frets: [0, 5],
    exact: false,
    reference: false,
    ...over
})
const keyEar = (
    over: Partial<Extract<DrillSetting, { kind: 'keyboard-ear' }>> = {}
): DrillSetting => ({
    kind: 'keyboard-ear',
    keys: [48, 71],
    exact: false,
    reference: false,
    ...over
})

describe('kinds and settings', () => {
    it('names the two kinds as the vault types allow them', () => {
        expect(KIND_LABELS['fretboard-ear']).toBe('Fretboard by ear')
        expect(KIND_LABELS['keyboard-ear']).toBe('Keyboard by ear')
        expect(kindOfLabel('Fretboard by ear')).toBe('fretboard-ear')
        expect(kindOfLabel('keyboard by ear')).toBe('keyboard-ear')
        // The sight kinds are unchanged.
        expect(kindOfLabel('Fretboard notes')).toBe('fretboard')
    })

    it('starts a new drill pitch class first, without a reference', () => {
        expect(drillDefaults('fretboard-ear', false)).toEqual({
            kind: 'fretboard-ear',
            strings: [6],
            frets: [0, 5],
            exact: false,
            reference: false
        })
        expect(drillDefaults('keyboard-ear', false)).toEqual(keyEar())
        // One octave on a phone, as Keyboard notes.
        expect(drillDefaults('keyboard-ear', true)).toEqual(keyEar({ keys: [60, 71] }))
    })

    it('says the setting in words, and reads them back', () => {
        expect(settingWords(fretEar())).toBe('string 5, frets 0-5')
        const both = fretEar({ strings: [4, 5, 6], exact: true, reference: true })
        expect(settingWords(both)).toBe('strings 4-6, frets 0-5, exact octave, with a reference')
        expect(drillTitle(both)).toBe(
            'Fretboard by ear, strings 4-6, frets 0-5, exact octave, with a reference'
        )
        expect(settingWords(keyEar({ reference: true }))).toBe('keys C3-B4, with a reference')
        for (const s of [fretEar(), both, keyEar(), keyEar({ exact: true })])
            expect(parseSetting(s.kind, settingWords(s))).toEqual(s)
        // A by-ear drill always finds: find or name words don't read.
        expect(parseSetting('fretboard-ear', 'string 5, frets 0-5, find')).toBeNull()
        expect(parseSetting('keyboard-ear', 'keys C4-C3')).toBeNull()
    })
})

describe('spots and questions', () => {
    it('asks the pitches the range plays, each once, low to high, with their octave', () => {
        expect(spotsOf(fretEar({ strings: [5, 6], frets: [0, 2] }))).toEqual([
            'E2',
            'F2',
            'F#2',
            'A2',
            'A#2',
            'B2'
        ])
        // Strings that share notes: each pitch once.
        expect(spotsOf(fretEar({ strings: [5, 6], frets: [0, 5] }))).toEqual([
            'E2',
            'F2',
            'F#2',
            'G2',
            'G#2',
            'A2',
            'A#2',
            'B2',
            'C3',
            'C#3',
            'D3'
        ])
        expect(spotsOf(keyEar({ keys: [60, 62] }))).toEqual(['C4', 'C#4', 'D4'])
    })

    it('asks to find the note heard, never by its name, with the reference when asked', () => {
        const [q] = questions(fretEar({ reference: true }), {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
            random: seededRandom(3)
        })
        expect(q!.type).toBe('hear-fret')
        if (q!.type !== 'hear-fret') return
        expect(q!.prompt).toBe('Find the note you hear')
        expect(q!.note).toBe(q!.spot)
        expect(q!.pitch).toBeGreaterThanOrEqual(45)
        // The lowest note of the setting: string 5 open, A2.
        expect(q!.reference).toBe(45)
        const [k] = questions(keyEar({ exact: true }), {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
            random: seededRandom(3)
        })
        expect(k!.type).toBe('hear-key')
        if (k!.type !== 'hear-key') return
        expect(k!.prompt).toBe('Find the note you hear (exact octave)')
        expect(k!.reference).toBeNull()
    })

    it('asks the weak spots most, as the sight drills do', () => {
        const weak: SpotStat = { spot: 'C3', answer: '', right: 0, asked: 3, seconds: 3, streak: 0 }
        const asked = questions(fretEar(), {
            stats: new Map([['C3', weak]]),
            rules: { ...DEFAULT_DRILL_RULES, questions: 10 },
            random: seededRandom(1)
        })
        expect(asked.filter((q) => q.spot === 'C3').length).toBeGreaterThanOrEqual(5)
    })

    it('uses C4 as the keyboard reference', () => {
        const [k] = questions(keyEar({ reference: true }), {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
            random: seededRandom(2)
        })
        expect(k!.type === 'hear-key' ? k!.reference : null).toBe(60)
    })
})

type Heard = Extract<Question, { type: 'hear-fret' | 'hear-key' }>
const heard = (over: Partial<Heard> = {}): Question => ({
    type: 'hear-fret',
    spot: 'C3',
    prompt: 'Find the note you hear',
    pitch: 48,
    note: 'C3',
    exact: false,
    reference: null,
    ...over
})

describe('answers', () => {
    it('takes the note in any octave, or only the same pitch with exact octave', () => {
        expect(isRight(heard(), { pitch: 60, string: 2 })).toBe(true)
        expect(isRight(heard(), { pitch: 49 })).toBe(false)
        expect(isRight(heard({ exact: true }), { pitch: 60 })).toBe(false)
        // Any place that plays the pitch: string 5 fret 3 or string 6 fret 8.
        expect(isRight(heard({ exact: true }), { pitch: 48, string: 6 })).toBe(true)
    })

    it('marks a miss and every right place in the range', () => {
        const area: { strings: number[]; frets: [number, number] } = {
            strings: [5, 6],
            frets: [0, 8]
        }
        const miss = afterHear(heard(), { string: 5, fret: 2, pitch: 47 }, area)
        expect(miss.right).toBe(false)
        expect(miss.marks).toEqual([
            { at: { string: 5, fret: 2 }, result: 'wrong' },
            { at: { string: 5, fret: 3 }, result: 'right' },
            { at: { string: 6, fret: 8 }, result: 'right' }
        ])
        const hit = afterHear(heard(), { string: 6, fret: 8, pitch: 48 }, area)
        expect(hit).toEqual({
            right: true,
            done: true,
            marks: [{ at: { string: 6, fret: 8 }, result: 'right' }]
        })
        // Any octave: every C of the keys; exact: only C3.
        const keys: { keys: [number, number] } = { keys: [48, 72] }
        const key = (exact: boolean) =>
            afterHear(
                {
                    type: 'hear-key',
                    spot: 'C3',
                    prompt: 'Find the note you hear',
                    pitch: 48,
                    note: 'C3',
                    exact,
                    reference: null
                },
                { string: null, fret: null, pitch: 50 },
                keys
            ).marks
        expect(key(false)).toEqual([
            { at: { pitch: 50 }, result: 'wrong' },
            { at: { pitch: 48 }, result: 'right' },
            { at: { pitch: 60 }, result: 'right' },
            { at: { pitch: 72 }, result: 'right' }
        ])
        expect(key(true)).toEqual([
            { at: { pitch: 50 }, result: 'wrong' },
            { at: { pitch: 48 }, result: 'right' }
        ])
    })

    it('names the answer with its octave in the naming, and never gives it in the prompt', () => {
        expect(expectedShown(heard(), 'solfege')).toBe('Do3')
        expect(promptShown(heard(), 'solfege')).toBe('Find the note you hear')
        expect(spotShown('fretboard-ear', 'G3', 'german')).toBe('G3')
        expect(spotShown('keyboard-ear', 'A#4', 'solfege')).toBe('La♯4')
    })
})
