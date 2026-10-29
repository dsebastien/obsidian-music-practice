import { describe, expect, it } from 'bun:test'
import { stringsOf, STRING_SETS, triadDetail, triadTitle } from './triads'

describe('triads', () => {
    it('reads string sets', () => {
        expect(STRING_SETS.map(stringsOf)).toEqual([
            [1, 2, 3],
            [2, 3, 4],
            [3, 4, 5],
            [4, 5, 6]
        ])
    })

    it('titles a triad note by its string set and inversion', () => {
        expect(triadDetail('2-4', 0)).toBe('(strings 2-4, root position)')
        expect(triadTitle('G Major', 'Triad', '1-3', 1)).toBe(
            'G Major - Triad (strings 1-3, 1st inversion)'
        )
    })
})
