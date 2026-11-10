/**
 * Click to enter notes (#76): a fretboard (guitar) or a keyboard (piano) whose clicks set frets or
 * toggle keys, through the library's pick layer (keyboard access, sound, presses kept from the
 * editor). The chosen notes are drawn by the plugin as dots in its own group, so the drawing is
 * never redrawn and the focus stays where it is.
 */
import {
    attachPick,
    emptyNoteSet,
    renderFretboard,
    renderKeyboard,
    withNaming,
    withRootMark
} from '@dsebastien/music-notation'
import type {
    Hand,
    Naming,
    Orientation,
    PickLayer,
    PlayOptions,
    RootMark
} from '@dsebastien/music-notation'
import { noteShown } from '../domain/note-names'
import {
    afterPick,
    chosen,
    nearTargets,
    type ClickAt,
    type ClickValue,
    type NearMatch
} from '../domain/click-input'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Frets shown on the fretboard, keys on the keyboard (C3-B4). */
export const CLICK_FRETS: [number, number] = [0, 12]
export const CLICK_KEYS: [number, number] = [48, 71]

/** The layout settings a click drawing follows, note names included (display only). */
export interface ClickLayout {
    hand: Hand
    fretboard: Orientation
    keyboard: Orientation
    naming: Naming
    rootMark: RootMark
}

export interface ClickInputOptions {
    instrument: 'guitar' | 'piano'
    layout: () => ClickLayout
    /** Settings → Playback: each click sounds its note; false when playback is off. */
    play: () => PlayOptions | false
    value: ClickValue
    /** Called after each click with the new value. */
    onChange: (value: ClickValue) => void
}

const selectorOf = (at: ClickAt) =>
    'pitch' in at
        ? `.mn-pick[data-mn-pitch="${at.pitch}"]`
        : `.mn-pick[data-mn-string="${at.string}"][data-mn-fret="${at.fret}"]`

export class ClickInput {
    readonly el: HTMLElement
    private readonly svg: SVGElement
    private readonly layer: PickLayer
    private value: ClickValue
    private dots: SVGElement | null = null
    private near: SVGElement | null = null
    private readonly naming: Naming

    constructor(
        parent: HTMLElement,
        private readonly options: ClickInputOptions
    ) {
        this.value = options.value
        this.el = parent.createDiv({ cls: 'mp-click-input mp-notation-preview' })
        const doc = this.el.ownerDocument
        const layout = options.layout()
        this.naming = layout.naming
        // String names and key labels as the setting names notes; root marks as it marks them.
        this.svg = withRootMark(layout.rootMark, () =>
            withNaming(layout.naming, () =>
                options.instrument === 'guitar'
                    ? renderFretboard(doc, emptyNoteSet(), {
                          pick: true,
                          frets: CLICK_FRETS,
                          hand: layout.hand,
                          orientation: layout.fretboard,
                          title: 'Click the frets'
                      })
                    : renderKeyboard(doc, emptyNoteSet(), {
                          pick: true,
                          range: CLICK_KEYS,
                          orientation: layout.keyboard,
                          title: 'Click the keys'
                      })
            )
        )
        this.el.appendChild(this.svg)
        const play = options.play()
        this.layer = attachPick(this.svg, {
            ...(play ? { play } : {}),
            onPick: (pick) => {
                this.value = afterPick(this.value, pick)
                this.draw()
                this.options.onChange(this.value)
            }
        })
        this.draw()
    }

    /** Shows a value (typed in the text field), without calling back. */
    set(value: ClickValue): void {
        this.value = value
        this.draw()
    }

    /** Marks a near match's missing notes faintly; null takes the marks away. */
    showNear(missingClasses: readonly number[] | null): void {
        this.near?.remove()
        this.near = null
        if (!missingClasses?.length) return
        const range = this.value.kind === 'keys' ? CLICK_KEYS : CLICK_FRETS
        this.near = this.group('mp-click-near')
        for (const at of nearTargets(this.value, missingClasses, range)) {
            const target = this.svg.querySelector(selectorOf(at))
            if (!target) continue
            const [x, y, r] = this.markOf(target)
            this.near.appendChild(this.circle(x, y, r, 'mp-click-near-ring'))
        }
    }

    destroy(): void {
        this.layer.destroy()
        this.el.remove()
    }

    private markOf(target: Element): [number, number, number] {
        const n = (name: string) => Number(target.getAttribute(name))
        return [n('data-mn-mark-x'), n('data-mn-mark-y'), n('data-mn-mark-r') || 8]
    }

    private circle(x: number, y: number, r: number, cls: string): SVGElement {
        const c = this.svg.ownerDocument.createElementNS(SVG_NS, 'circle')
        c.setAttribute('class', cls)
        c.setAttribute('cx', String(x))
        c.setAttribute('cy', String(y))
        c.setAttribute('r', String(r))
        return c
    }

    /** A group of the plugin's own marks, right after the library's targets, ignoring the pointer. */
    private group(cls: string): SVGElement {
        const g = this.svg.ownerDocument.createElementNS(SVG_NS, 'g')
        g.setAttribute('class', cls)
        g.setAttribute('pointer-events', 'none')
        g.setAttribute('aria-hidden', 'true')
        const layers = this.svg.querySelectorAll('.mn-picks')
        const last = layers[layers.length - 1]
        if (last) last.after(g)
        else this.svg.appendChild(g)
        return g
    }

    private draw(): void {
        this.dots?.remove()
        this.showNear(null)
        // Every target says whether it is chosen: false first, true for the chosen ones.
        this.svg
            .querySelectorAll('.mn-pick')
            .forEach((target) => target.setAttribute('aria-pressed', 'false'))
        this.dots = this.group('mp-click-dots')
        for (const at of chosen(this.value)) {
            const target = this.svg.querySelector(selectorOf(at))
            if (!target) continue
            target.setAttribute('aria-pressed', 'true')
            const [x, y, r] = this.markOf(target)
            this.dots.appendChild(this.circle(x, y, r, 'mp-click-dot'))
            const text = this.svg.ownerDocument.createElementNS(SVG_NS, 'text')
            text.setAttribute('class', 'mp-click-dot-text')
            text.setAttribute('x', String(x))
            text.setAttribute('y', String(y + 3.5))
            text.setAttribute('text-anchor', 'middle')
            const name = noteShown(target.getAttribute('data-mn-note') ?? '', this.naming)
            text.textContent = name
            // Three characters or more (Sol, La♯) are squeezed into the dot, as the library does.
            if (name.length >= 3) {
                text.setAttribute('textLength', String(2 * r - 3))
                text.setAttribute('lengthAdjust', 'spacingAndGlyphs')
            }
            this.dots.appendChild(text)
        }
    }
}

/**
 * The near matches as a list: each chord with its missing notes. Hover or focus marks the missing
 * notes on the drawing (`mark`); a click calls `pick` when given (else the row only selects it).
 */
export function renderNearMatches(
    parent: HTMLElement,
    near: readonly NearMatch[],
    handlers: { mark: (missing: readonly number[] | null) => void; pick?: (symbol: string) => void }
): void {
    parent.empty()
    if (!near.length) return
    parent.createDiv({
        cls: 'mp-muted',
        text: 'No chord with exactly these notes. Chords that hold them:'
    })
    const list = parent.createDiv({ cls: 'mp-click-near-list' })
    // The match clicked keeps its marks when the pointer or the focus leaves another one.
    let selected: NearMatch | null = null
    const back = () => handlers.mark(selected?.missingClasses ?? null)
    for (const match of near) {
        const button = list.createEl('button', {
            cls: 'mp-click-near-match',
            text: `${match.symbol} (missing ${match.missing.join(' ')})`,
            attr: { 'aria-pressed': 'false' }
        })
        const on = () => handlers.mark(match.missingClasses)
        button.addEventListener('mouseenter', on)
        button.addEventListener('focus', on)
        button.addEventListener('mouseleave', back)
        button.addEventListener('blur', back)
        button.addEventListener('click', () => {
            selected = match
            list.querySelectorAll('.mp-click-near-match').forEach((b) =>
                b.setAttribute('aria-pressed', String(b === button))
            )
            on()
            handlers.pick?.(match.symbol)
        })
    }
}
