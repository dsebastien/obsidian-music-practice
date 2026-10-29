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
        if (event.target instanceof Element && event.target.closest('.mn-play')) return
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
