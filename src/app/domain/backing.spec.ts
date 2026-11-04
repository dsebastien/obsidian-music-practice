import { describe, expect, it } from 'bun:test'
import {
    backingBars,
    backingBpm,
    backingMeter,
    chartBacking,
    chordsBacking,
    progressionBacking,
    progressionFences,
    type ProgressionElement
} from './backing'

describe('progressionFences', () => {
    it('finds ```progression and ~~~progression blocks, and nothing else', () => {
        const text = [
            '```progression',
            'key: G',
            'I V vi IV',
            '```',
            '```chords',
            '[G]Hello',
            '```',
            '~~~progression',
            'Am F C G',
            '~~~'
        ].join('\n')
        expect(progressionFences(text)).toEqual(['key: G\nI V vi IV\n', 'Am F C G\n'])
        expect(progressionFences('# Nothing')).toEqual([])
    })
})

describe('chartBacking', () => {
    it("plays every chord a chart shows, one a bar, repeats kept, with the chart's time and tempo", () => {
        const text = [
            '```chords',
            '{time: 3/4}',
            '{tempo: 96}',
            '[G]Hello [G]there [D]little [Em]world',
            '[Xyz]bad [C]end',
            '```'
        ].join('\n')
        expect(chartBacking(text)).toEqual({
            label: 'Chord chart',
            chords: ['G', 'G', 'D', 'Em', 'C'],
            time: '3/4',
            tempo: 96,
            strum: null,
            sound: null
        })
    })

    it("applies the chart's {transpose}", () => {
        const text = '```chords\n{key: C}\n{transpose: 3}\n[C]Hello [G]world [Am]and [F]more\n```'
        expect(chartBacking(text)?.chords).toEqual(['Eb', 'Bb', 'Cm', 'Ab'])
    })

    it("follows the chart's bar lines, dots, slashes and held bars (#89)", () => {
        const text = '```chords\n{tempo: 120}\n| [C]. . . [G]. | [Am] / / [F] | % |\n```'
        expect(chartBacking(text)?.chords).toEqual([
            { chord: 'C', beats: 3 },
            { chord: 'G', beats: 1 },
            { chord: 'Am', beats: 3 },
            { chord: 'F', beats: 5 }
        ])
    })

    it('keeps a bar of N.C. as a bar of silence (#89)', () => {
        const text = '```chords\n| [G] | [N.C.] | [Em] |\n```'
        expect(chartBacking(text)?.chords).toEqual([
            { chord: 'G', beats: 4 },
            { chord: null, pitches: [], beats: 4 },
            { chord: 'Em', beats: 4 }
        ])
    })

    it("counts the beats in the note's time signature when the chart has no {time} (#89)", () => {
        const source = chartBacking('```chords\n| [G] [D] |\n```', { noteTime: '6/8' })
        expect(source?.chords).toEqual([
            { chord: 'G', beats: 3 },
            { chord: 'D', beats: 3 }
        ])
        // The chart's own time stays unset: the loop takes the note's.
        expect(source?.time).toBeNull()
    })

    it('takes the notes the drawn chart sounds ({define} shapes, the capo) when given (#89)', () => {
        const text =
            '```chords\n{define: Gzz base-fret 1 frets 3 2 0 0 0 3}\n{capo: 2}\n[Gzz]One [C]two\n```'
        // Without the drawing, a {define} name the library can't read as a chord is left out.
        expect(chartBacking(text)?.chords).toEqual(['C'])
        const marks = [
            { getAttribute: (n: string) => (n === 'data-mn-voicing' ? '45 49 52 57 61 69' : null) },
            { getAttribute: (n: string) => (n === 'data-mn-voicing' ? '50 54 57 62 66' : null) }
        ]
        expect(chartBacking(text, { drawn: () => marks })?.chords).toEqual([
            { chord: 'Gzz', pitches: [45, 49, 52, 57, 61, 69] },
            { chord: 'C', pitches: [50, 54, 57, 62, 66] }
        ])
    })

    it('is null without a chord', () => {
        expect(chartBacking('# No chart')).toBeNull()
        expect(chartBacking('```chords\n{title: Empty}\nJust words\n```')).toBeNull()
    })
})

describe('chordsBacking', () => {
    it("plays a piece's linked chord notes in order, one a bar; null without any that read", () => {
        expect(chordsBacking(['G', 'C', 'Xyz', 'D7'])).toEqual({
            label: 'Linked chord notes',
            chords: ['G', 'C', 'D7'],
            time: null,
            tempo: null,
            strum: null,
            sound: null
        })
        expect(chordsBacking(['Xyz'])).toBeNull()
    })
})

/** A drawn ```progression block, as far as the reader looks at it. */
function drawn(
    attributes: Record<string, string>,
    cells: Record<string, string>[]
): ProgressionElement {
    const attr = (map: Record<string, string>) => (name: string) => map[name] ?? null
    return {
        getAttribute: attr(attributes),
        querySelectorAll: () => cells.map((c) => ({ getAttribute: attr(c) }))
    }
}

describe('progressionBacking', () => {
    it("reads a drawn block's chords with the notes its play bar sounds, and its settings", () => {
        const el = drawn({ 'data-mn-time': '6/8', 'data-mn-tempo': '70', 'data-mn-strum': 'bar' }, [
            {
                'data-mn-chord': 'G',
                'data-mn-voicing': '43 47 50 55 59 67',
                'data-mn-sound': 'piano'
            },
            { 'data-mn-chord': 'Em', 'data-mn-voicing': '40 47 52 55 59 64' },
            { 'data-mn-chord': 'C' }
        ])
        expect(progressionBacking(el, 'Progression 1')).toEqual({
            label: 'Progression 1',
            chords: [
                { chord: 'G', pitches: [43, 47, 50, 55, 59, 67] },
                { chord: 'Em', pitches: [40, 47, 52, 55, 59, 64] },
                'C'
            ],
            time: '6/8',
            tempo: 70,
            strum: 'bar',
            sound: 'piano'
        })
    })

    it('is null for a block that drew no chord (a mistake in it)', () => {
        expect(progressionBacking(drawn({}, []), 'Progression 1')).toBeNull()
    })
})

describe('backingMeter', () => {
    it("takes the progression's own time, else the note's time signature, else 4/4", () => {
        expect(backingMeter('3/4', '6/8')).toEqual({ beatsPerBar: 3, beatUnit: 4, label: '3/4' })
        expect(backingMeter(null, '6/8')).toEqual({ beatsPerBar: 6, beatUnit: 8, label: '6/8' })
        expect(backingMeter(null, 'C')).toEqual({ beatsPerBar: 4, beatUnit: 4, label: 'C' })
        expect(backingMeter(null, 'waltz')).toEqual({ beatsPerBar: 4, beatUnit: 4, label: '4/4' })
        expect(backingMeter(null, null)).toEqual({ beatsPerBar: 4, beatUnit: 4, label: '4/4' })
    })
})

describe('backingBpm', () => {
    it("starts at the note's current BPM, else the progression's tempo, else 80, within 20–240", () => {
        expect(backingBpm(72, 100)).toBe(72)
        expect(backingBpm(null, 100)).toBe(100)
        expect(backingBpm(null, null)).toBe(80)
        expect(backingBpm(300, null)).toBe(240)
        expect(backingBpm(10, null)).toBe(20)
        expect(backingBpm(72.6, null)).toBe(73)
    })
})

describe('backingBars', () => {
    it('counts bars from the chords, one a bar or their beats (#89)', () => {
        expect(backingBars(['G', 'D', 'Em', 'C'], 4)).toBe(4)
        expect(
            backingBars(
                [
                    { chord: 'C', beats: 3 },
                    { chord: 'G', beats: 1 },
                    { chord: 'Am', beats: 3 },
                    { chord: 'F', beats: 5 }
                ],
                4
            )
        ).toBe(3)
        // Part of a bar counts as a bar.
        expect(backingBars([{ chord: 'G', beats: 2 }], 4)).toBe(1)
    })
})
