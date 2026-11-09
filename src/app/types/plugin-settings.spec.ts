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
            fretboard: true,
            tab: true,
            score: true,
            strum: true,
            progression: true,
            circle: true,
            picking: true
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

describe('layout settings from data.json', () => {
    it('keeps valid orientations and falls back on anything else', () => {
        const settings = settingsFrom({
            notationLayout: {
                leftHanded: true,
                chord: 'horizontal',
                fretboard: 'sideways',
                keyboard: 3
            }
        })
        expect(settings.notationLayout).toEqual({
            leftHanded: true,
            chord: 'horizontal',
            fretboard: 'horizontal',
            keyboard: 'horizontal',
            naming: 'letters'
        })
    })

    it('keeps a valid note naming and falls back to letters on anything else', () => {
        const naming = (value: unknown) =>
            settingsFrom({ notationLayout: { naming: value } }).notationLayout.naming
        expect(naming('solfege')).toBe('solfege')
        expect(naming('german')).toBe('german')
        expect(naming('letters')).toBe('letters')
        expect(naming('Solfège')).toBe('letters')
        expect(naming('french')).toBe('letters')
        expect(naming(3)).toBe('letters')
        expect(settingsFrom({}).notationLayout.naming).toBe('letters')
    })

    it('defaults when data.json has none (older versions)', () => {
        expect(settingsFrom({}).notationLayout.chord).toBe('vertical')
    })
})

describe('0.5 settings from a 0.4 data.json', () => {
    it('keeps the old settings and fills in the new ones', () => {
        const settings = settingsFrom({ defaultPlanMinutes: 45, notation: { chord: false } })
        expect(settings.defaultPlanMinutes).toBe(45)
        expect(settings.notation.chord).toBe(false)
        expect(settings.lastLog).toBeNull()
        expect(settings.panelItems).toEqual([])
        expect(settings.drillSeconds).toBe(60)
        expect(settings.metronome.beatsPerBar).toBe(4)
        expect(settings.timerPausedAt).toBe(0)
    })

    it('drops malformed or out-of-range 0.5 values', () => {
        const settings = settingsFrom({
            lastLog: { at: 'yesterday' },
            panelItems: [{ path: 'A.md', done: true }, { nope: 1 }],
            drillSeconds: -5,
            metronome: {
                subdivision: 7,
                volume: 3,
                trainerStep: 500,
                countInBars: 9,
                flash: 'yes'
            },
            timerStartedAt: 1000,
            timerPausedAt: 500,
            timerPausedMs: -3
        })
        expect(settings.lastLog).toBeNull()
        expect(settings.panelItems).toEqual([{ path: 'A.md', done: true }])
        expect(settings.drillSeconds).toBe(60)
        expect(settings.metronome).toEqual({
            beatsPerBar: 4,
            subdivision: 1,
            volume: 0.7,
            trainerStep: 2,
            trainerBars: 4,
            countInBars: 1,
            flash: false
        })
        expect([settings.timerPausedAt, settings.timerPausedMs]).toEqual([0, 0])
    })
})

describe('settingsFrom: playback strum', () => {
    it('reads the strum older versions stored by default (40) as the new default (12)', () => {
        expect(settingsFrom({ playback: { strum: 40 } }).playback.strum).toBe(12)
        expect(settingsFrom({ playback: { strum: 25 } }).playback.strum).toBe(25)
        expect(settingsFrom({}).playback.strum).toBe(12)
    })
})

describe('settingsFrom: the play-along player (#75)', () => {
    it('is on with a 0.2 s pre-roll by default', () => {
        expect(createDefaultSettings().playAlong).toEqual({ enabled: true, preRoll: 0.2 })
        expect(settingsFrom({}).playAlong).toEqual({ enabled: true, preRoll: 0.2 })
    })
    it('keeps stored values in range, and drops the others', () => {
        expect(settingsFrom({ playAlong: { enabled: false, preRoll: 1.5 } }).playAlong).toEqual({
            enabled: false,
            preRoll: 1.5
        })
        expect(settingsFrom({ playAlong: { preRoll: 3 } }).playAlong.preRoll).toBe(0.2)
        expect(settingsFrom({ playAlong: { preRoll: -1 } }).playAlong.preRoll).toBe(0.2)
        expect(settingsFrom({ playAlong: { preRoll: 'x' } }).playAlong.preRoll).toBe(0.2)
    })
})

describe('settingsFrom: note drills (#73)', () => {
    it('has the drill property names and rules by default', () => {
        const s = settingsFrom({})
        expect([s.fields.drillKind, s.fields.drillSetting, s.fields.drillStats]).toEqual([
            'drill_kind',
            'drill_setting',
            'drill_stats'
        ])
        expect(s.drills).toEqual({ questions: 20, weakShare: 60, clearStreak: 3, fastSeconds: 2 })
    })
    it('keeps stored values in range, and drops the others', () => {
        expect(
            settingsFrom({
                drills: { questions: 10, weakShare: 0, clearStreak: 5, fastSeconds: 1.5 }
            }).drills
        ).toEqual({ questions: 10, weakShare: 0, clearStreak: 5, fastSeconds: 1.5 })
        expect(
            settingsFrom({
                drills: { questions: 0, weakShare: 101, clearStreak: 0.5, fastSeconds: 0 }
            }).drills
        ).toEqual({ questions: 20, weakShare: 60, clearStreak: 3, fastSeconds: 2 })
    })
})
