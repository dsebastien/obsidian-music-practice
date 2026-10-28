import { describe, expect, it } from 'bun:test'
import { layoutDefaults } from './notation-layout'

describe('layoutDefaults', () => {
    it('passes each orientation, and the hand only when left-handed', () => {
        const layout = {
            leftHanded: false,
            chord: 'vertical',
            fretboard: 'horizontal',
            keyboard: 'vertical'
        } as const
        expect(layoutDefaults(layout)).toEqual({
            orientation: { chord: 'vertical', fretboard: 'horizontal', keyboard: 'vertical' }
        })
        expect(layoutDefaults({ ...layout, leftHanded: true }).hand).toBe('left')
    })
})
