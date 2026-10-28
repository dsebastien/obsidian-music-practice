import { describe, expect, it } from 'bun:test'
import { createDefaultSettings, settingsFrom } from './plugin-settings.intf'

describe('settingsFrom', () => {
    it('keeps valid stored values and the defaults for the rest', () => {
        const s = settingsFrom({
            defaultPlanMinutes: 45,
            rules: { review: { firstInterval: 7 }, plan: { split: [10, 60, 20, 10] } },
            fields: { lastPracticed: 'last_played' }
        })
        expect(s.defaultPlanMinutes).toBe(45)
        expect(s.rules.review.firstInterval).toBe(7)
        expect(s.rules.review.maxInterval).toBe(90)
        expect(s.rules.plan.split).toEqual([10, 60, 20, 10])
        expect(s.fields.lastPracticed).toBe('last_played')
        expect(s.fields.bpmCurrent).toBe('bpm_current')
    })

    it('drops values of the wrong type or shape', () => {
        const s = settingsFrom({
            defaultPlanMinutes: '45',
            rules: {
                levels: { want: 'ten' },
                plan: { split: [50, 50], warmUpKinds: ['technique', 3] }
            },
            unknown: true
        })
        const d = createDefaultSettings()
        expect(s.defaultPlanMinutes).toBe(d.defaultPlanMinutes)
        expect(s.rules.levels.want).toBe(10)
        expect(s.rules.plan.split).toEqual([15, 50, 20, 15])
        expect(s.rules.plan.warmUpKinds).toEqual(['technique', 'exercise'])
        expect('unknown' in s).toBe(false)
    })

    it('accepts a different number of warm-up kinds', () => {
        expect(
            settingsFrom({ rules: { plan: { warmUpKinds: ['scale'] } } }).rules.plan.warmUpKinds
        ).toEqual(['scale'])
    })
})

describe('settingsFrom: notation and new property names', () => {
    it('keeps stored notation switches and falls back for wrong values', () => {
        expect(settingsFrom({ notation: { chords: false } }).notation).toEqual({
            chord: true,
            chords: false,
            keyboard: true,
            fretboard: true
        })
        expect(settingsFrom({ notation: 'off' }).notation.chord).toBe(true)
        expect(settingsFrom({ notation: { chord: 'no' } }).notation.chord).toBe(true)
    })

    it('renames a new property name an older data.json already uses', () => {
        const s = settingsFrom({ fields: { shape: 'frets' } })
        expect(s.fields.shape).toBe('frets')
        expect(s.fields.frets).toBe('mp_frets')
        expect(s.fields.fingers).toBe('fingers')
    })

    it('leaves property names alone when the stored settings set them', () => {
        const s = settingsFrom({ fields: { frets: 'frets', fingers: 'fingers' } })
        expect(s.fields.frets).toBe('frets')
    })
})
