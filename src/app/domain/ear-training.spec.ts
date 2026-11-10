import { describe, expect, it } from 'bun:test'
import {
    earDefaults,
    earItems,
    earQuestion,
    earSpots,
    earWords,
    guidedItems,
    intervalName,
    itemOfSpot,
    nextGuidedItem,
    parseEarSetting,
    type EarTrainingSetting
} from './ear-training'
import { seededRandom, type SpotStat } from './note-drill'

const stat = (spot: string, streak: number, asked = streak): SpotStat => ({
    spot,
    answer: '',
    right: asked,
    asked,
    seconds: 1,
    streak
})
const statsOf = (...s: SpotStat[]) => new Map(s.map((x) => [x.spot, x]))

describe('ear training settings', () => {
    it('has defaults per kind, piano by default', () => {
        expect(earDefaults('intervals-ear')).toEqual({
            kind: 'intervals-ear',
            instrument: 'piano',
            intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            ways: ['up']
        })
        expect(earDefaults('chords-ear')).toEqual({
            kind: 'chords-ear',
            instrument: 'piano',
            qualities: ['major', 'minor', 'diminished', 'augmented'],
            styles: ['block']
        })
        expect(earDefaults('scales-ear')).toEqual({
            kind: 'scales-ear',
            instrument: 'piano',
            scales: [
                'major',
                'natural minor',
                'harmonic minor',
                'major pentatonic',
                'minor pentatonic'
            ]
        })
        expect(earDefaults('degrees-ear')).toEqual({
            kind: 'degrees-ear',
            instrument: 'piano',
            chromatic: false,
            key: null
        })
    })

    it('names intervals up to two octaves', () => {
        expect([1, 6, 7, 12, 13, 18, 24].map(intervalName)).toEqual([
            'm2',
            'TT',
            'P5',
            'P8',
            'm9',
            'A11',
            'P15'
        ])
    })

    it('says a setting in words, the sound last', () => {
        expect(earWords(earDefaults('intervals-ear'))).toBe('m2-P8, up, piano')
        expect(
            earWords({
                kind: 'intervals-ear',
                instrument: 'guitar',
                intervals: [7, 3, 4],
                ways: ['together', 'up', 'down']
            })
        ).toBe('m3, M3, P5, up, down, together, guitar')
        expect(
            earWords({
                kind: 'intervals-ear',
                instrument: 'piano',
                intervals: [1, 2],
                ways: ['up']
            })
        ).toBe('m2, M2, up, piano')
        expect(earWords(earDefaults('chords-ear'))).toBe(
            'major, minor, diminished, augmented, block, piano'
        )
        expect(
            earWords({
                kind: 'chords-ear',
                instrument: 'guitar',
                qualities: ['minor 7th', 'major'],
                styles: ['arpeggio', 'block']
            })
        ).toBe('major, minor 7th, block, arpeggio, guitar')
        expect(earWords(earDefaults('scales-ear'))).toBe(
            'major, natural minor, harmonic minor, major pentatonic, minor pentatonic, piano'
        )
        expect(earWords(earDefaults('degrees-ear'))).toBe('diatonic, any key, piano')
        expect(
            earWords({ kind: 'degrees-ear', instrument: 'guitar', chromatic: true, key: 'Eb' })
        ).toBe('chromatic, key Eb, guitar')
    })

    it('reads its words back, in any order and case', () => {
        const all: EarTrainingSetting[] = [
            earDefaults('intervals-ear'),
            {
                kind: 'intervals-ear',
                instrument: 'guitar',
                intervals: [3, 4, 7, 13, 24],
                ways: ['down', 'together']
            },
            earDefaults('chords-ear'),
            {
                kind: 'chords-ear',
                instrument: 'guitar',
                qualities: ['dominant 7th', 'half-diminished'],
                styles: ['arpeggio']
            },
            earDefaults('scales-ear'),
            { kind: 'scales-ear', instrument: 'guitar', scales: ['dorian', 'locrian'] },
            earDefaults('degrees-ear'),
            { kind: 'degrees-ear', instrument: 'guitar', chromatic: true, key: 'F#' }
        ]
        for (const s of all) expect(parseEarSetting(s.kind, earWords(s))).toEqual(s)
        expect(parseEarSetting('intervals-ear', 'Piano, UP, m3-P5')).toEqual({
            kind: 'intervals-ear',
            instrument: 'piano',
            intervals: [3, 4, 5, 6, 7],
            ways: ['up']
        })
        expect(parseEarSetting('degrees-ear', 'key bb, chromatic, piano')).toEqual({
            kind: 'degrees-ear',
            instrument: 'piano',
            chromatic: true,
            key: 'Bb'
        })
    })

    it("refuses words that don't read, or too few items", () => {
        expect(parseEarSetting('intervals-ear', 'm2-P8, up')).toBeNull()
        expect(parseEarSetting('intervals-ear', 'm2-P8, sideways, piano')).toBeNull()
        expect(parseEarSetting('intervals-ear', 'P5, up, piano')).toBeNull()
        expect(parseEarSetting('intervals-ear', 'm2-P8, piano')).toBeNull()
        expect(parseEarSetting('chords-ear', 'major, minor, piano')).toBeNull()
        expect(parseEarSetting('chords-ear', 'major, block, piano')).toBeNull()
        expect(parseEarSetting('scales-ear', 'major, bebop, piano')).toBeNull()
        expect(parseEarSetting('degrees-ear', 'diatonic, key H, piano')).toBeNull()
        expect(parseEarSetting('degrees-ear', 'diatonic, chromatic, any key, piano')).toBeNull()
    })
})

describe('ear training spots', () => {
    it('are an interval with its way, a quality, a scale or a degree', () => {
        expect(
            earSpots({
                kind: 'intervals-ear',
                instrument: 'piano',
                intervals: [7, 3],
                ways: ['up', 'together']
            })
        ).toEqual(['m3 up', 'm3 together', 'P5 up', 'P5 together'])
        expect(earSpots(earDefaults('chords-ear'))).toEqual([
            'major',
            'minor',
            'diminished',
            'augmented'
        ])
        expect(earSpots(earDefaults('degrees-ear'))).toEqual(['1', '2', '3', '4', '5', '6', '7'])
        expect(earSpots({ ...earDefaults('degrees-ear'), chromatic: true })).toEqual([
            '1',
            'b2',
            '2',
            'b3',
            '3',
            '4',
            '#4',
            '5',
            'b6',
            '6',
            'b7',
            '7'
        ])
    })

    it('know their item', () => {
        const s = earDefaults('intervals-ear')
        expect(itemOfSpot(s, 'P5 up')).toBe('P5')
        expect(itemOfSpot(earDefaults('chords-ear'), 'minor')).toBe('minor')
    })

    it('order the items most distinct first (the guided order)', () => {
        expect(earItems(earDefaults('intervals-ear')).slice(0, 4)).toEqual(['P8', 'M3', 'P5', 'm3'])
        expect(
            earItems({
                kind: 'intervals-ear',
                instrument: 'piano',
                intervals: [24, 12, 16, 1],
                ways: ['up']
            })
        ).toEqual(['P8', 'm2', 'P15', 'M10'])
        expect(earItems(earDefaults('scales-ear')).slice(0, 3)).toEqual([
            'major',
            'natural minor',
            'major pentatonic'
        ])
        expect(earItems({ ...earDefaults('degrees-ear'), chromatic: true }).slice(0, 8)).toEqual([
            '1',
            '5',
            '3',
            '4',
            '2',
            '6',
            '7',
            'b3'
        ])
    })
})

describe('guided ear training', () => {
    const s: EarTrainingSetting = {
        kind: 'intervals-ear',
        instrument: 'piano',
        intervals: [3, 4, 7, 12],
        ways: ['up', 'down']
    }

    it('starts with the two most distinct items', () => {
        expect(guidedItems(s, new Map(), 3)).toEqual(['P8', 'M3'])
        expect(nextGuidedItem(s, new Map(), 3)).toBe('P5')
    })

    it('adds the next item once every spot of the items asked is cleared', () => {
        const half = statsOf(stat('P8 up', 3), stat('P8 down', 3), stat('M3 up', 3))
        expect(guidedItems(s, half, 3)).toEqual(['P8', 'M3'])
        const all = statsOf(...['P8 up', 'P8 down', 'M3 up', 'M3 down'].map((x) => stat(x, 3)))
        expect(guidedItems(s, all, 3)).toEqual(['P8', 'M3', 'P5'])
        expect(nextGuidedItem(s, all, 3)).toBe('m3')
    })

    it('never shrinks: an item once asked stays', () => {
        const asked = statsOf(stat('P8 up', 0, 4), stat('P5 down', 1))
        expect(guidedItems(s, asked, 3)).toEqual(['P8', 'M3', 'P5'])
    })

    it('ends with every item', () => {
        const done = statsOf(...earSpots(s).map((x) => stat(x, 3)))
        expect(guidedItems(s, done, 3)).toEqual(['P8', 'M3', 'P5', 'm3'])
        expect(nextGuidedItem(s, done, 3)).toBeNull()
    })
})

describe('ear training questions', () => {
    it('plays an interval up, down or together, inside C3-G5', () => {
        const s = earDefaults('intervals-ear')
        for (let seed = 1; seed < 40; seed++) {
            const random = seededRandom(seed)
            const up = earQuestion(s, 'M10 up', ['P8', 'M10'], random)
            const [a, b] = up.sound
            expect(b!.midi - a!.midi).toBe(16)
            expect(a!.midi).toBeGreaterThanOrEqual(48)
            expect(b!.midi).toBeLessThanOrEqual(79)
            expect([a!.time, b!.time]).toEqual([0, 1])
            expect(up.last).toBe(1)
        }
        const random = seededRandom(3)
        const down = earQuestion(s, 'P5 down', ['P8', 'P5'], random)
        expect(down.sound[0]!.midi - down.sound[1]!.midi).toBe(7)
        const together = earQuestion(s, 'm3 together', ['P8', 'm3'], random)
        expect(together.sound.map((e) => e.time)).toEqual([0, 0])
        expect(together.last).toBe(0)
        expect(together.prompt).toBe('Name the interval you hear (played together)')
        expect(down.prompt).toBe('Name the interval you hear (going down)')
        expect(down.answer).toBe('P5')
        expect(down.choices).toEqual(['P8', 'P5'])
        expect(down.again).toEqual(down.sound)
    })

    it('plays a chord as a block or an arpeggio, on a root from C3 to B3', () => {
        const random = seededRandom(5)
        const block = earQuestion(earDefaults('chords-ear'), 'minor', ['major', 'minor'], random)
        const pitches = block.sound.map((e) => e.midi)
        expect(pitches[0]).toBeGreaterThanOrEqual(48)
        expect(pitches[0]).toBeLessThanOrEqual(59)
        expect(pitches.map((p) => p - pitches[0]!)).toEqual([0, 3, 7])
        expect(block.sound.every((e) => e.time === 0)).toBe(true)
        expect(block.prompt).toBe('Name the chord you hear')
        const arpeggio = earQuestion(
            { ...earDefaults('chords-ear'), styles: ['arpeggio'] },
            'dominant 7th',
            ['major', 'dominant 7th'],
            random
        )
        expect(arpeggio.sound.map((e) => e.midi - arpeggio.sound[0]!.midi)).toEqual([0, 4, 7, 10])
        expect(arpeggio.sound.map((e) => e.time)).toEqual([0, 0.45, 0.9, 1.35])
        expect(arpeggio.last).toBe(1.35)
    })

    it('plays a scale up an octave and back', () => {
        const q = earQuestion(
            earDefaults('scales-ear'),
            'major pentatonic',
            ['major', 'major pentatonic'],
            seededRandom(9)
        )
        const root = q.sound[0]!.midi
        expect(root).toBeGreaterThanOrEqual(55)
        expect(root).toBeLessThanOrEqual(66)
        expect(q.sound.map((e) => e.midi - root)).toEqual([0, 2, 4, 7, 9, 12, 9, 7, 4, 2, 0])
        expect(q.last).toBeCloseTo(3.5, 5)
        expect(q.prompt).toBe('Name the scale you hear')
    })

    it('plays the cadence, then the degree; Play again plays the note only', () => {
        const q = earQuestion(
            { ...earDefaults('degrees-ear'), chromatic: true, key: 'D' },
            'b3',
            ['1', 'b3'],
            seededRandom(2)
        )
        const tonic = 62
        const chords = q.sound.slice(0, -1)
        expect(chords.filter((e) => e.time === 0).map((e) => e.midi)).toEqual([
            tonic - 12,
            tonic,
            tonic + 4,
            tonic + 7
        ])
        expect([...new Set(chords.map((e) => e.time))]).toEqual([0, 0.8, 1.6, 2.4])
        const note = q.sound.at(-1)!
        expect(note).toEqual({ midi: tonic + 3, time: 3.8, duration: 1.5 })
        expect(q.last).toBe(3.8)
        expect(q.again).toEqual([{ midi: tonic + 3, time: 0, duration: 1.5 }])
        expect(q.prompt).toBe('Name the degree of the last note')
    })

    it('takes a key at random with any key, its tonic from G3 to F#4', () => {
        const tonics = new Set<number>()
        for (let seed = 1; seed < 60; seed++) {
            const q = earQuestion(earDefaults('degrees-ear'), '1', ['1', '5'], seededRandom(seed))
            const tonic = q.sound[1]!.midi
            expect(tonic).toBeGreaterThanOrEqual(55)
            expect(tonic).toBeLessThanOrEqual(66)
            tonics.add(tonic)
        }
        expect(tonics.size).toBeGreaterThan(6)
    })
})
