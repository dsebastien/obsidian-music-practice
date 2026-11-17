import { describe, expect, it } from 'bun:test'
import {
    createDefaultPlayback,
    drawnPlaybackChanged,
    libraryEngine,
    playOptions,
    volumeChange
} from './playback'
import type { NotePlayer, PlayOptions } from '@dsebastien/music-notation'

const sound: NotePlayer = { play: () => ({ stop() {} }) }
/** The players the plugin has: the sound pack's and the built-in soundfont's. */
const player: PlayOptions['engines'] = { generaluser: () => null, sonivox: sound }

describe('playOptions', () => {
    it('plays the built-in soundfont by default, with the defaults', () => {
        expect(playOptions(createDefaultPlayback(), player)).toEqual({
            engines: player,
            engine: 'sonivox',
            volume: 0.8,
            bpm: 90
        })
    })

    it("names the setting's engine as the library does (#100)", () => {
        expect(libraryEngine('generaluser')).toBe('generaluser')
        expect(libraryEngine('soundfont')).toBe('sonivox')
        expect(libraryEngine('light')).toBe('light')
        expect(
            playOptions({ ...createDefaultPlayback(), engine: 'generaluser' }, player)
        ).toMatchObject({ engines: player, engine: 'generaluser' })
    })

    it('passes no strum at the default, so guitar strums and piano sounds together', () => {
        const options = playOptions(createDefaultPlayback(), player)
        expect(options && 'strum' in options).toBe(false)
        expect(playOptions({ ...createDefaultPlayback(), strum: 30 }, player)).toMatchObject({
            strum: 30
        })
    })

    it('asks for the light synthesizer when set, and names no engine without players', () => {
        const light = playOptions({ ...createDefaultPlayback(), engine: 'light' }, player)
        expect(light).toMatchObject({ engine: 'light' })
        // The library's own light synthesizer plays when the app gives no light player.
        expect(player && 'light' in player).toBe(false)
        const none = playOptions(createDefaultPlayback(), undefined)
        expect(none && ('engines' in none || 'engine' in none || 'player' in none)).toBe(false)
    })

    it('reads the volume of the settings at each play when given them live (no volume on the bars)', () => {
        let settings = { ...createDefaultPlayback(), volume: 30 }
        const options = playOptions(settings, player, () => settings)
        const volume = options ? options.volume : undefined
        expect(typeof volume).toBe('function')
        expect((volume as () => number)()).toBeCloseTo(0.3)
        settings = { ...settings, volume: 70 }
        expect((volume as () => number)()).toBeCloseTo(0.7)
        settings = { ...settings, volume: 250 }
        expect((volume as () => number)()).toBe(1)
    })

    it('is off when playback is turned off', () => {
        expect(playOptions({ ...createDefaultPlayback(), enabled: false }, player)).toBe(false)
    })
})

describe('volumeChange (#95)', () => {
    it('gives the new level (0 to 1) when the volume changed, else null', () => {
        const before = createDefaultPlayback()
        expect(volumeChange(before, { ...before, volume: 40 })).toBe(0.4)
        expect(volumeChange(before, { ...before })).toBeNull()
        // Other playback settings: nothing to apply.
        expect(volumeChange(before, { ...before, bpm: 60 })).toBeNull()
        expect(volumeChange(before, { ...before, volume: 250 })).toBe(1)
    })
})

describe('drawnPlaybackChanged (#95)', () => {
    it('ignores the volume: a redraw would stop what plays, and no bar shows it', () => {
        const before = createDefaultPlayback()
        expect(drawnPlaybackChanged(before, { ...before, volume: 30 })).toBe(false)
        expect(drawnPlaybackChanged(before, { ...before })).toBe(false)
        expect(drawnPlaybackChanged(before, { ...before, engine: 'light' })).toBe(true)
        expect(drawnPlaybackChanged(before, { ...before, volume: 30, bpm: 70 })).toBe(true)
    })
})

describe('the tab tempo unit (music-notation #114)', () => {
    it('is BPM by default, and a switch saved from a bar redraws nothing', () => {
        const before = createDefaultPlayback()
        expect(before.tempoUnit).toBe('bpm')
        expect(drawnPlaybackChanged(before, { ...before, tempoUnit: 'percent' })).toBe(false)
    })
})
