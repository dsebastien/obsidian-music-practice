import { alignTitleLines } from '@dsebastien/music-notation'

/**
 * A selectable diagram in a grid of voicings or triads. Not a <button>: the diagram inside has
 * its own playback buttons, and buttons can't nest. Click, Enter or Space selects it; clicks on
 * the playback bar don't.
 */
export function voicingCell(
    parent: HTMLElement,
    cls: string,
    label: string,
    selected: boolean,
    onSelect: (cell: HTMLElement) => void
): HTMLElement {
    const cell = parent.createDiv({
        cls: `mp-voicing${cls ? ` ${cls}` : ''}${selected ? ' is-selected' : ''}`,
        attr: {
            'role': 'button',
            'tabindex': '0',
            'aria-label': label,
            'aria-pressed': String(selected)
        }
    })
    cell.addEventListener('click', (event) => {
        // instanceOf: the modal may be in a popout window, with its own Element.
        const target = event.target as Node | null
        if (target?.instanceOf(Element) && target.closest('.mn-play')) return
        onSelect(cell)
    })
    cell.addEventListener('keydown', (event) => {
        if (event.target !== cell || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        onSelect(cell)
    })
    return cell
}

/** Marks one cell of a grid as the selected one. */
export function selectCell(grid: HTMLElement, cell: HTMLElement): void {
    grid.querySelectorAll('.mp-voicing').forEach((c) => {
        const on = c === cell
        c.toggleClass('is-selected', on)
        c.setAttr('aria-pressed', String(on))
    })
}

/** The chord diagrams drawn in a grid (each cell's `svg.mn-svg`), in order. */
export function gridDiagrams<T>(grid: { querySelectorAll(selectors: string): ArrayLike<T> }): T[] {
    return Array.from(grid.querySelectorAll('svg.mn-svg'))
}

/**
 * Lines up the necks of a grid's chord diagrams (#87): music-notation 0.12 wraps a long title
 * (a voicing name such as "E shape (strings 1-4)") instead of widening the diagram, so a cell drawn
 * on its own with a two-line title would sit lower. Every diagram gets the room of the longest
 * (the library's `alignTitleLines`).
 */
export function alignGrid(grid: ParentNode): void {
    alignTitleLines(gridDiagrams(grid))
}
