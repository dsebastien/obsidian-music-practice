import { describe, expect, it } from 'bun:test'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import { parseSetting, readSetting, validateSetting, writeSetting } from './setting-paths'

describe('setting paths', () => {
    const settings = createDefaultSettings()

    it('reads nested values and lists as text', () => {
        expect(readSetting(settings, 'rules.review.firstInterval')).toBe(3)
        expect(readSetting(settings, 'rules.plan.split')).toBe('15, 50, 20, 15')
        expect(readSetting(settings, 'rules.plan.warmUpKinds')).toBe('technique, exercise')
        expect(readSetting(settings, 'rubric.chord.slow')).toBe('Every string rings')
    })

    it('parses by the type of the default', () => {
        expect(parseSetting('rules.score.perUnlock', '4')).toEqual({ ok: true, value: 4 })
        expect(parseSetting('rules.plan.split', '10, 60, 20, 10')).toEqual({
            ok: true,
            value: [10, 60, 20, 10]
        })
        expect(parseSetting('rules.plan.split', '50, 50').ok).toBe(false)
        expect(parseSetting('rules.plan.warmUpKinds', 'scale, ,technique')).toEqual({
            ok: true,
            value: ['scale', 'technique']
        })
        expect(parseSetting('fields.lastPracticed', 'last_played')).toEqual({
            ok: true,
            value: 'last_played'
        })
        expect(parseSetting('nope', 1).ok).toBe(false)
    })

    it('checks the split, the level order and the review intervals', () => {
        expect(validateSetting(settings, 'rules.plan.split', '10, 60, 20, 10')).toBeUndefined()
        expect(validateSetting(settings, 'rules.plan.split', '10, 60, 20, 20')).toMatch(/100/)
        expect(validateSetting(settings, 'rules.levels.slow', 15)).toMatch(/increase/)
        expect(validateSetting(settings, 'rules.review.maxInterval', 2)).toMatch(/maximum/)
        expect(validateSetting(settings, 'rules.levels.mastered', 70)).toBeUndefined()
    })

    it('writes into a settings object', () => {
        const draft = createDefaultSettings()
        writeSetting(draft, 'local.levelNames.want', 'Wishlist')
        expect(draft.local.levelNames.want).toBe('Wishlist')
    })
})

describe('setting bounds', () => {
    const settings = createDefaultSettings()
    it('refuses zero divisors, fractional levels, empty and duplicate property names', () => {
        expect(parseSetting('rules.score.bpmGapDivisor', 0).ok).toBe(false)
        expect(parseSetting('rules.review.goodMultiplier', 0).ok).toBe(false)
        expect(parseSetting('rules.levels.slow', 30.5).ok).toBe(false)
        expect(parseSetting('fields.lastPracticed', '  ').ok).toBe(false)
        expect(parseSetting('rubric.chord.slow', '').ok).toBe(true)
        expect(validateSetting(settings, 'fields.bpmCurrent', 'bpm_target')).toMatch(
            /two properties/
        )
    })
})
