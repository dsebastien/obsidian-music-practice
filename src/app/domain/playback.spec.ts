import { describe, expect, it } from 'bun:test'
import { createDefaultPlayback, playOptions } from './playback'
import type { NotePlayer } from '@dsebastien/music-notation'

const player: NotePlayer = { play: () => ({ stop() {} }) }

describe('playOptions', () => {
    it('uses the soundfont by default, with the defaults', () => {
        expect(playOptions(createDefaultPlayback(), player)).toEqual({
            player,
            volume: 0.8,
            bpm: 90,
            strum: 40
        })
    })

    it('uses the light synthesizer when asked, or when no soundfont is at hand', () => {
        const light = playOptions({ ...createDefaultPlayback(), engine: 'light' }, player)
        expect(light && 'player' in light).toBe(false)
        const none = playOptions(createDefaultPlayback(), undefined)
        expect(none && 'player' in none).toBe(false)
    })

    it('is off when playback is turned off', () => {
        expect(playOptions({ ...createDefaultPlayback(), enabled: false }, player)).toBe(false)
    })
})
