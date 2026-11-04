import { describe, expect, it } from 'bun:test'
import { gridDiagrams } from './voicing-cell'

describe('gridDiagrams (#87)', () => {
    it("takes the grid's chord diagrams, in order, for the library to align their titles", () => {
        const asked: string[] = []
        const diagrams = [{ id: 'G' }, { id: 'C' }]
        const grid = {
            querySelectorAll: (selectors: string) => {
                asked.push(selectors)
                return diagrams
            }
        }
        expect(gridDiagrams(grid)).toEqual(diagrams)
        expect(asked).toEqual(['svg.mn-svg'])
    })

    it('gives none for a grid with no diagram', () => {
        expect(gridDiagrams({ querySelectorAll: () => [] })).toEqual([])
    })
})
