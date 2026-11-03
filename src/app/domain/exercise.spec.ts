import { describe, expect, it } from 'bun:test'
import { exerciseTab } from '@dsebastien/music-notation'
import {
    defaultPosition,
    exerciseBlock,
    exercisePositions,
    exerciseSubject,
    exerciseTempo
} from './exercise'
import { createDefaultFieldNames } from './fields'

const fields = createDefaultFieldNames()

describe('exerciseSubject', () => {
    it("reads a scale note's root and type", () => {
        const scale = { scale_root: 'A', scale_type: 'Minor pentatonic' }
        expect(exerciseSubject('scale', scale, fields)).toEqual({
            notes: { scale: 'A Minor pentatonic' },
            name: 'A Minor pentatonic',
            size: 5
        })
    })

    it("reads an arpeggio note's chord as the library spells it", () => {
        expect(exerciseSubject('arpeggio', { chord_symbol: 'A Minor 7' }, fields)).toEqual({
            notes: { arpeggio: 'Am7' },
            name: 'Am7',
            size: 4
        })
    })

    it('gives nothing for other notes, or what the library does not read', () => {
        expect(exerciseSubject('chord', { chord_symbol: 'Am7' }, fields)).toBeNull()
        expect(exerciseSubject('scale', { scale_root: 'A' }, fields)).toBeNull()
        expect(exerciseSubject('scale', { scale_root: 'H', scale_type: 'Major' }, fields)).toBe(
            null
        )
        expect(exerciseSubject('arpeggio', { chord_symbol: 'nonsense' }, fields)).toBeNull()
    })

    it('reads the property names configured', () => {
        const named = { ...fields, scaleRoot: 'root', scaleType: 'type' }
        expect(exerciseSubject('scale', { root: 'C', type: 'Major' }, named)?.name).toBe('C Major')
    })
})

describe('exercisePositions', () => {
    const labels = (subject: Parameters<typeof exercisePositions>[0]) =>
        exercisePositions(subject).map((p) => p.label)

    it('gives a pentatonic its five boxes, then the CAGED shapes', () => {
        const subject = exerciseSubject(
            'scale',
            { scale_root: 'A', scale_type: 'Minor pentatonic' },
            fields
        )!
        expect(labels(subject)).toEqual([
            'Box 1',
            'Box 2',
            'Box 3',
            'Box 4',
            'Box 5',
            'C shape',
            'A shape',
            'G shape',
            'E shape',
            'D shape'
        ])
    })

    it('gives a seven-note scale the CAGED shapes, then its 3NPS positions', () => {
        const subject = exerciseSubject('scale', { scale_root: 'G', scale_type: 'Major' }, fields)!
        expect(labels(subject)).toEqual([
            'C shape',
            'A shape',
            'G shape',
            'E shape',
            'D shape',
            '3NPS 1',
            '3NPS 2',
            '3NPS 3',
            '3NPS 4',
            '3NPS 5',
            '3NPS 6',
            '3NPS 7'
        ])
    })

    it('gives an arpeggio the CAGED shapes only', () => {
        const subject = exerciseSubject('arpeggio', { chord_symbol: 'Am7' }, fields)!
        expect(labels(subject)).toEqual(['C shape', 'A shape', 'G shape', 'E shape', 'D shape'])
    })
})

describe('defaultPosition', () => {
    const pentatonic = exercisePositions(
        exerciseSubject('scale', { scale_root: 'A', scale_type: 'Minor pentatonic' }, fields)!
    )
    const major = exercisePositions(
        exerciseSubject('scale', { scale_root: 'G', scale_type: 'Major' }, fields)!
    )

    it("starts on the note's own shape", () => {
        expect(pentatonic[defaultPosition(pentatonic, 'Box 3')]!.label).toBe('Box 3')
        expect(major[defaultPosition(major, 'CAGED E')]!.label).toBe('E shape')
        expect(major[defaultPosition(major, 'E-shape barre')]!.label).toBe('E shape')
        expect(major[defaultPosition(major, 'A')]!.label).toBe('A shape')
        expect(major[defaultPosition(major, '3NPS')]!.label).toBe('3NPS 1')
        expect(major[defaultPosition(major, ['CAGED G'])]!.label).toBe('G shape')
    })

    it('starts on the first one without a shape it has', () => {
        expect(defaultPosition(pentatonic, '')).toBe(0)
        expect(defaultPosition(pentatonic, 'Open')).toBe(0)
        expect(defaultPosition(pentatonic, '3NPS')).toBe(0)
        expect(defaultPosition(major, 'Box 2')).toBe(0)
    })
})

describe('exerciseTempo', () => {
    it("is the note's current BPM when the tab can take it", () => {
        expect(exerciseTempo(72)).toBe(72)
        expect(exerciseTempo('90')).toBe(90)
        expect(exerciseTempo(20)).toBe(20)
        expect(exerciseTempo(240)).toBe(240)
    })

    it('is none otherwise (the library plays 60)', () => {
        expect(exerciseTempo(null)).toBeUndefined()
        expect(exerciseTempo(undefined)).toBeUndefined()
        expect(exerciseTempo(300)).toBeUndefined()
        expect(exerciseTempo(10)).toBeUndefined()
        expect(exerciseTempo(72.5)).toBeUndefined()
        expect(exerciseTempo('fast')).toBeUndefined()
    })
})

describe('exerciseBlock', () => {
    const subject = exerciseSubject(
        'scale',
        { scale_root: 'A', scale_type: 'Minor pentatonic' },
        fields
    )!

    it("is a tab block of the library's exercise", () => {
        const box1 = exercisePositions(subject)[0]!
        const block = exerciseBlock(subject, box1, {
            direction: 'both',
            rhythm: '8ths',
            tempo: 72
        })
        const tex = exerciseTab(
            { scale: 'A Minor pentatonic' },
            { position: 1, direction: 'both', rhythm: '8ths', tempo: 72 }
        )
        expect(block).toBe('```tab\n' + tex + '\n```')
        expect(block).toContain('\\tempo 72')
    })

    it('passes a CAGED shape or a 3NPS position', () => {
        const major = exerciseSubject('scale', { scale_root: 'G', scale_type: 'Major' }, fields)!
        const choices = exercisePositions(major)
        const e = choices.find((c) => c.label === 'E shape')!
        expect(exerciseBlock(major, e, { direction: 'up', rhythm: 'triplets' })).toBe(
            '```tab\n' +
                exerciseTab(
                    { scale: 'G Major' },
                    { shape: 'E', direction: 'up', rhythm: 'triplets' }
                ) +
                '\n```'
        )
        const nps = choices.find((c) => c.label === '3NPS 2')!
        expect(exerciseBlock(major, nps, { direction: 'down', rhythm: '16ths' })).toBe(
            '```tab\n' +
                exerciseTab(
                    { scale: 'G Major' },
                    { shape: '3nps', position: 2, direction: 'down', rhythm: '16ths' }
                ) +
                '\n```'
        )
    })

    it('draws the same run in a fretboard block, for the preview', async () => {
        const { exerciseFretboard } = await import('./exercise')
        const box1 = exercisePositions(subject)[0]!
        expect(
            exerciseFretboard(subject, box1, { direction: 'both', rhythm: '8ths', tempo: 72 })
        ).toBe('scale: A Minor pentatonic\nposition: 1\nexercise: up-down\nrhythm: 8ths\ntempo: 72')
        const arpeggio = exerciseSubject('arpeggio', { chord_symbol: 'Am7' }, fields)!
        const e = exercisePositions(arpeggio).find((c) => c.label === 'E shape')!
        expect(exerciseFretboard(arpeggio, e, { direction: 'up', rhythm: '16ths' })).toBe(
            'arpeggio: Am7\nshape: E\nexercise: up\nrhythm: 16ths'
        )
    })
})

describe('playedBpm', () => {
    it("is the score's tempo at the player's speed, rounded", async () => {
        const { playedBpm } = await import('./exercise')
        expect(playedBpm(72, 1)).toBe(72)
        expect(playedBpm(72, 1.25)).toBe(90)
        expect(playedBpm(60, 0.55)).toBe(33)
    })

    it('is none without a tempo or a speed', async () => {
        const { playedBpm } = await import('./exercise')
        expect(playedBpm(0, 1)).toBeNull()
        expect(playedBpm(Number.NaN, 1)).toBeNull()
        expect(playedBpm(72, 0)).toBeNull()
        expect(playedBpm(undefined, 1)).toBeNull()
    })
})

describe('tabSpeed', () => {
    it("is the speed set on the tab's bar, before the first Play too (#70)", async () => {
        const { tabSpeed } = await import('./exercise')
        // alphaTab's playbackSpeed stays 1 until the player starts.
        expect(tabSpeed({ speed: () => 1.2, api: { playbackSpeed: 1 } })).toBe(1.2)
    })

    it("is alphaTab's speed for a result without speed()", async () => {
        const { tabSpeed } = await import('./exercise')
        expect(tabSpeed({ api: { playbackSpeed: 0.8 } })).toBe(0.8)
        expect(tabSpeed({ api: null })).toBeUndefined()
    })
})
