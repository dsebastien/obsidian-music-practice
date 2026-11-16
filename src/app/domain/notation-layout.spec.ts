import { describe, expect, it } from 'bun:test'
import { layoutDefaults } from './notation-layout'
import { setLanguage } from '../i18n/i18n'

describe('layoutDefaults', () => {
    it('passes each orientation, and the hand only when left-handed', () => {
        const layout = {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'vertical',
            naming: 'letters',
            rootMark: 'color'
        } as const
        expect(layoutDefaults(layout)).toEqual({
            orientation: { chord: 'vertical', fretboard: 'horizontal', keyboard: 'vertical' }
        })
        expect(layoutDefaults({ ...layout, leftHanded: true }).hand).toBe('left')
    })

    it("passes Obsidian's language to the blocks only when it is not English (#112)", () => {
        const layout = {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'horizontal',
            naming: 'letters',
            rootMark: 'color'
        } as const
        expect('language' in layoutDefaults(layout)).toBe(false)
        setLanguage('fr')
        try {
            expect(layoutDefaults(layout).language).toBe('fr')
        } finally {
            setLanguage('en')
        }
        expect('language' in layoutDefaults(layout)).toBe(false)
    })

    it('passes the note names only when they are not letters (letters output unchanged)', () => {
        const layout = {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'horizontal',
            naming: 'letters',
            rootMark: 'color'
        } as const
        expect('naming' in layoutDefaults(layout)).toBe(false)
        expect(layoutDefaults({ ...layout, naming: 'solfege' }).naming).toBe('solfege')
        expect(layoutDefaults({ ...layout, naming: 'german' }).naming).toBe('german')
    })

    it('passes the root mark only when it is not color (color output unchanged)', () => {
        const layout = {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'horizontal',
            naming: 'letters',
            rootMark: 'color'
        } as const
        expect('rootMark' in layoutDefaults(layout)).toBe(false)
        expect(layoutDefaults({ ...layout, rootMark: 'shape' }).rootMark).toBe('shape')
    })
})
