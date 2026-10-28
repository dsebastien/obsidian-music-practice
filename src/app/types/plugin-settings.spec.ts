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
