import { describe, expect, it } from 'bun:test'
import { createDefaultPlayback, drawnPlaybackChanged, playOptions, volumeChange } from './playback'
import type { NotePlayer } from '@dsebastien/music-notation'

const player: NotePlayer = { play: () => ({ stop() {} }) }

describe('playOptions', () => {
    it('uses the soundfont by default, with the defaults', () => {
        expect(playOptions(createDefaultPlayback(), player)).toEqual({
            player,
            volume: 0.8,
            bpm: 90
        })
    })

    it('passes no strum at the default, so guitar strums and piano sounds together', () => {
        const options = playOptions(createDefaultPlayback(), player)
        expect(options && 'strum' in options).toBe(false)
        expect(playOptions({ ...createDefaultPlayback(), strum: 30 }, player)).toMatchObject({
            strum: 30
        })
    })

    it('uses the light synthesizer when asked, or when no soundfont is at hand', () => {
        const light = playOptions({ ...createDefaultPlayback(), engine: 'light' }, player)
        expect(light && 'player' in light).toBe(false)
        const none = playOptions(createDefaultPlayback(), undefined)
        expect(none && 'player' in none).toBe(false)
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
