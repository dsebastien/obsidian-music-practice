import { describe, expect, it } from 'bun:test'
import { createDefaultPlayback, playOptions } from './playback'
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
