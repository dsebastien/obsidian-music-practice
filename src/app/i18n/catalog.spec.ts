import { describe, expect, it } from 'bun:test'
import { en } from './messages/en'
import { fr } from './messages/fr'
import { commonEn } from './messages/en/common'
import { settingsEn } from './messages/en/settings'
import { notationEn } from './messages/en/notation'
import { pluginEn } from './messages/en/plugin'
import { whatsnewEn } from './messages/en/whatsnew'
import { logEn } from './messages/en/log'
import { panelEn } from './messages/en/panel'
import { notesEn } from './messages/en/notes'
import { toolsEn } from './messages/en/tools'
import { drillsEn } from './messages/en/drills'
import { metronomeEn } from './messages/en/metronome'
import { playalongEn } from './messages/en/playalong'
import { backingEn } from './messages/en/backing'
import { texttabEn } from './messages/en/texttab'

const AREAS: Record<string, Record<string, string>> = {
    common: commonEn,
    settings: settingsEn,
    notation: notationEn,
    plugin: pluginEn,
    whatsnew: whatsnewEn,
    log: logEn,
    panel: panelEn,
    notes: notesEn,
    tools: toolsEn,
    drills: drillsEn,
    metronome: metronomeEn,
    playalong: playalongEn,
    backing: backingEn,
    texttab: texttabEn
}

/**
 * Keys whose French text is the same as the English one on purpose (the same word in both
 * languages, a symbol, a product name). Anything else equal to its English text fails.
 */
const SAME_AS_ENGLISH = new Set<string>([
    'common.pause',
    'common.minutes.one',
    'common.minutes.other'
])

const english = en as Record<string, string>
const french = fr as Record<string, string>

const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()

describe('message catalog', () => {
    it('French has every English key and no other', () => {
        const missing = Object.keys(english).filter((key) => !(key in french))
        const extra = Object.keys(french).filter((key) => !(key in english))
        expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it('every area keeps to its own prefix, so merged areas never overwrite each other', () => {
        const wrong: string[] = []
        let total = 0
        for (const [area, table] of Object.entries(AREAS)) {
            for (const key of Object.keys(table)) {
                total++
                if (!key.startsWith(`${area}.`)) wrong.push(key)
            }
        }
        expect(wrong).toEqual([])
        expect(Object.keys(english).length).toBe(total)
    })

    it('every French text keeps the placeholders of its English text', () => {
        const bad: string[] = []
        for (const [key, text] of Object.entries(english)) {
            const translated = french[key]
            if (translated === undefined) continue
            if (placeholders(text).join() !== placeholders(translated).join()) bad.push(key)
        }
        expect(bad).toEqual([])
    })

    it('no text is empty', () => {
        const empty = [...Object.entries(english), ...Object.entries(french)]
            .filter(([, text]) => text.trim() === '')
            .map(([key]) => key)
        expect(empty).toEqual([])
    })

    it('French is a translation, not a copy, except for the allow list', () => {
        const copies = Object.keys(english).filter(
            (key) => french[key] === english[key] && !SAME_AS_ENGLISH.has(key)
        )
        expect(copies).toEqual([])
    })

    it('the allow list names no key that is missing or differs', () => {
        const stale = [...SAME_AS_ENGLISH].filter((key) => french[key] !== english[key])
        expect(stale).toEqual([])
    })

    it('plural keys come in pairs', () => {
        const lonely = Object.keys(english).filter((key) => {
            if (key.endsWith('.one')) return !(`${key.slice(0, -4)}.other` in english)
            if (key.endsWith('.other')) return !(`${key.slice(0, -6)}.one` in english)
            return false
        })
        expect(lonely).toEqual([])
    })
})
