import { describe, expect, it } from 'bun:test'
import type { TimedBar } from '@dsebastien/music-notation'
import { SAVE_BPM_LABEL, saveBpmOnBars } from './save-bpm-bar'

/** A test double typed as what it stands in for (it only has what the code under test reads). */
const fake = <T>(value: unknown): T => value as T

/** A fake button: what the handler sets on it, and its click listener. */
function fakeButton() {
    const attributes = new Map<string, string>()
    let listener: (() => void) | null = null
    let removed = false
    const button = {
        type: '',
        className: '',
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        addEventListener: (_type: string, l: () => void) => (listener = l),
        removeEventListener: () => (listener = null),
        remove: () => (removed = true)
    }
    return {
        button,
        attributes,
        click: () => listener?.(),
        removed: () => removed
    }
}

function fakeBar(kind: TimedBar['kind'], tempo: number) {
    const made = fakeButton()
    const added: unknown[] = []
    const bar = fake<TimedBar>({
        kind,
        compound: false,
        element: { createEl: () => made.button },
        drawing: {},
        tempo: () => tempo,
        onTempo: () => () => {},
        add: (control: unknown) => added.push(control)
    })
    return { bar, made, added }
}

describe('saveBpmOnBars (#88)', () => {
    it('adds Save BPM to strum, picking, progression and chart bars, with the bar tempo', () => {
        for (const kind of ['strum', 'picking', 'progression', 'chart'] as const) {
            const opened: number[] = []
            const icons: string[] = []
            const { bar, made, added } = fakeBar(kind, 84.4)
            const free = saveBpmOnBars(
                (bpm) => opened.push(bpm),
                (_el, name) => icons.push(name)
            )(bar)
            expect(added).toEqual([made.button])
            expect(made.attributes.get('aria-label')).toBe(SAVE_BPM_LABEL)
            expect(made.attributes.get('title')).toBe('Save BPM')
            expect(made.button.type).toBe('button')
            expect(icons).toEqual(['gauge'])
            made.click()
            expect(opened).toEqual([84])
            expect(typeof free).toBe('function')
            ;(free as () => void)()
            expect(made.removed()).toBe(true)
            made.click()
            expect(opened).toEqual([84])
        }
    })

    it('reads the tempo set on the bar at the click, not when the bar is drawn', () => {
        let tempo = 70
        const opened: number[] = []
        const { bar, made } = fakeBar('strum', 70)
        ;(bar as { tempo: () => number }).tempo = () => tempo
        saveBpmOnBars(
            (bpm) => opened.push(bpm),
            () => {}
        )(bar)
        tempo = 96
        made.click()
        expect(opened).toEqual([96])
    })
})
