import type { TimedBar } from '@dsebastien/music-notation'

/** The play bars that get Save BPM (#88): everything a learning note practices in time. */
const KINDS: ReadonlySet<TimedBar['kind']> = new Set(['strum', 'picking', 'progression', 'chart'])

/** The button's name for screen readers, the same as the tab player bar's Save BPM (#70). */
export const SAVE_BPM_LABEL = 'Save the BPM it plays at to this note'

/**
 * The library's `play.timedBar` hook (music-notation 0.12, #77) for a learning note: a Save BPM
 * button at the end of each strum, picking, progression and chart play bar, which calls `open`
 * with the tempo set on the bar at that moment (rounded; the beat the pattern counts, as the note's
 * current BPM is written). The returned function removes it (called when the block is freed).
 * The button is made in the bar's own document, so a popout window gets its own.
 */
export function saveBpmOnBars(
    open: (bpm: number) => void,
    icon: (el: HTMLElement, name: string) => void
): (bar: TimedBar) => (() => void) | void {
    return (bar) => {
        if (!KINDS.has(bar.kind)) return
        // Made in the bar's document (popouts); add() moves it into the bar's app slot.
        const button = bar.element.createEl('button')
        button.type = 'button'
        button.className = 'mp-score-save-bpm'
        button.setAttribute('aria-label', SAVE_BPM_LABEL)
        button.setAttribute('title', 'Save BPM')
        icon(button, 'gauge')
        const click = () => open(Math.round(bar.tempo()))
        button.addEventListener('click', click)
        bar.add(button)
        return () => {
            button.removeEventListener('click', click)
            button.remove()
        }
    }
}
