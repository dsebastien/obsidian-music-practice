/**
 * The play-along player's drawing (#75): the media element (a hidden `<audio>`, or a `<video>`
 * that shows), the timeline with the A-B span and the sections, and the controls. Made in the
 * block's own document, so a popout window gets its own element and frames.
 */
import { Platform, setIcon } from 'obsidian'
import { formatTime, playAlongKey, type PlayAlongAction } from '../domain/playalong'
import type { PlayAlongController } from '../services/playalong-player'
import type { MountRequest, PlayAlongView } from '../services/playalong.service'

const SOURCE_LABEL = { block: 'tempo line', tapped: 'tapped', target: 'target' } as const

/** A button with an icon or a text, its name for screen readers and its tooltip. */
function button(
    parent: HTMLElement,
    options: { icon?: string; text?: string; label: string; cls?: string },
    onClick: () => void
): HTMLButtonElement {
    const el = parent.createEl('button', {
        cls: ['mp-playalong-button', ...(options.cls ? [options.cls] : [])],
        attr: { 'type': 'button', 'aria-label': options.label, 'title': options.label }
    })
    if (options.icon) setIcon(el, options.icon)
    if (options.text) el.createSpan({ text: options.text })
    el.addEventListener('click', onClick)
    return el
}

/** Keys the timeline slider handles itself (fine seeking, 0.1 s a step). */
const SLIDER_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown'
])

const percent = (time: number, duration: number): string =>
    `${Math.min(100, Math.max(0, (time / duration) * 100))}%`

export function mountPlayAlong(request: MountRequest): PlayAlongView {
    const doc = request.el.ownerDocument
    const win = doc.defaultView ?? window
    const root = request.el.createDiv({
        cls: ['mp-playalong', `mp-playalong-${request.kind}`],
        attr: {
            'tabindex': '0',
            'role': 'group',
            'aria-label': `Play-along player: ${request.name}`
        }
    })
    // Live preview: a press in the player must not move the editor's cursor into the block.
    root.addEventListener('mousedown', (event) => event.stopPropagation())

    const video =
        request.kind === 'video' ? root.createEl('video', { cls: 'mp-playalong-media' }) : null
    const media: HTMLMediaElement = video ?? root.createEl('audio', { cls: 'mp-playalong-media' })
    media.preload = 'metadata'
    media.controls = false
    if (video) video.playsInline = true
    media.src = request.url

    let controller: PlayAlongController | null = null
    const run = (fn: (c: PlayAlongController) => void) => () => {
        if (controller) fn(controller)
    }

    const head = root.createDiv({ cls: 'mp-playalong-head' })
    head.createSpan({ cls: 'mp-playalong-name', text: request.name })
    const error = head.createSpan({ cls: 'mp-playalong-error mn-error-message' })

    const main = root.createDiv({ cls: 'mp-playalong-main' })
    const play = button(
        main,
        { icon: 'play', label: 'Play (Space)', cls: 'mp-playalong-play' },
        run((c) => c.toggle())
    )
    const time = main.createSpan({ cls: 'mp-playalong-time', text: '0:00.0 / 0:00' })
    const timeline = main.createDiv({ cls: 'mp-playalong-timeline' })
    const span = timeline.createDiv({ cls: 'mp-playalong-span' })
    const ticks = timeline.createDiv({ cls: 'mp-playalong-ticks' })
    const range = timeline.createEl('input', {
        type: 'range',
        cls: 'mp-playalong-range',
        attr: { 'min': '0', 'max': '0', 'step': '0.1', 'aria-label': 'Position' }
    })
    range.addEventListener('input', () => controller?.seek(Number(range.value)))

    const controls = root.createDiv({ cls: 'mp-playalong-controls' })
    const speedGroup = controls.createDiv({
        cls: 'mp-playalong-group',
        attr: { 'role': 'group', 'aria-label': 'Speed' }
    })
    button(
        speedGroup,
        { icon: 'minus', label: 'Slower (−)' },
        run((c) => c.slower())
    )
    const speed = speedGroup.createSpan({
        cls: 'mp-playalong-speed',
        attr: { 'aria-live': 'polite' }
    })
    button(
        speedGroup,
        { icon: 'plus', label: 'Faster (+)' },
        run((c) => c.faster())
    )

    const loopGroup = controls.createDiv({ cls: 'mp-playalong-group' })
    const setA = button(
        loopGroup,
        { text: 'A', label: 'Set A at the playhead ([)' },
        run((c) => c.setA())
    )
    const setB = button(
        loopGroup,
        { text: 'B', label: 'Set B at the playhead (])' },
        run((c) => c.setB())
    )
    const loop = button(
        loopGroup,
        { icon: 'repeat', label: 'Loop A to B (L)' },
        run((c) => c.toggleLoop())
    )
    const clear = button(
        loopGroup,
        { icon: 'x', label: 'Clear the loop' },
        run((c) => c.clearLoop())
    )

    const tempoGroup = controls.createDiv({ cls: 'mp-playalong-group' })
    const countIn = button(
        tempoGroup,
        { icon: 'timer', label: 'Count-in before each pass (C)' },
        run((c) => c.toggleCountIn())
    )
    const tempo = tempoGroup.createSpan({ cls: 'mp-playalong-tempo' })
    button(
        tempoGroup,
        { text: 'Tap', label: 'Tap the tempo (T)' },
        run((c) => c.tap())
    )

    const noteGroup = controls.createDiv({ cls: 'mp-playalong-group' })
    button(
        noteGroup,
        { icon: 'bookmark-plus', label: 'Add a section at the playhead (M)' },
        () => void request.actions.addSection()
    )
    // Shown only in a learning note, checked at each refresh (a note can become one).
    const saveBpm = button(
        noteGroup,
        {
            icon: 'gauge',
            label: 'Save the BPM it plays at to this note',
            cls: 'mp-score-save-bpm'
        },
        () => request.actions.saveBpm()
    )

    const sectionsEl = root.createDiv({ cls: 'mp-playalong-sections' })
    request.block.sections.forEach((section, index) => {
        const stamp = formatTime(section.time, !Number.isInteger(section.time))
        const label = section.name ? `${formatTime(section.time)} ${section.name}` : stamp
        const chip = sectionsEl.createDiv({ cls: 'mp-playalong-section' })
        // The accessible names hold the visible text (WCAG 2.5.3).
        button(
            chip,
            {
                text: label,
                label: `Go to ${label}`,
                cls: 'mp-playalong-section-go'
            },
            run((c) => c.jump(index))
        )
        button(
            chip,
            { icon: 'repeat', label: `Loop ${label}` },
            run((c) => c.loopSection(index))
        )
    })
    if (!request.block.sections.length) sectionsEl.addClass('mp-is-hidden')

    const status = root.createDiv({ cls: 'mp-playalong-status', attr: { 'aria-live': 'polite' } })
    if (request.block.problems.length) {
        const problems = root.createEl('ul', { cls: 'mp-playalong-problems mn-error-message' })
        for (const problem of request.block.problems) problems.createEl('li', { text: problem })
    }

    const act = (c: PlayAlongController, action: PlayAlongAction): void => {
        switch (action) {
            case 'toggle':
                return c.toggle()
            case 'set-a':
                return c.setA()
            case 'set-b':
                return c.setB()
            case 'loop':
                return c.toggleLoop()
            case 'back':
                return c.nudge(-5)
            case 'back-little':
                return c.nudge(-1)
            case 'forward':
                return c.nudge(5)
            case 'forward-little':
                return c.nudge(1)
            case 'slower':
                return c.slower()
            case 'faster':
                return c.faster()
            case 'count-in':
                return c.toggleCountIn()
            case 'tap':
                return c.tap()
            case 'add-section':
                return void request.actions.addSection()
        }
    }
    root.addEventListener('keydown', (event) => {
        if (!controller || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
            return
        // Space and Enter on a button press that button; the slider keeps its own keys.
        const onButton = (event.target as HTMLElement | null)?.tagName === 'BUTTON'
        if (onButton && (event.key === ' ' || event.key === 'Enter')) return
        if (event.target === range && SLIDER_KEYS.has(event.key)) return
        const action = playAlongKey(event.key, event.shiftKey)
        if (!action) return
        event.preventDefault()
        event.stopPropagation()
        act(controller, action)
    })

    video?.addEventListener(
        'click',
        run((c) => c.toggle())
    )
    media.addEventListener('timeupdate', () => controller?.check())
    media.addEventListener('ended', () => controller?.ended())
    media.addEventListener('pause', () => controller?.check())
    media.addEventListener('loadedmetadata', () => refresh())
    media.addEventListener('durationchange', () => refresh())
    media.addEventListener('error', () => {
        const code = media.error?.code
        error.setText(
            code === 4
                ? "This device can't play this file."
                : `Couldn't load the recording${media.error?.message ? `: ${media.error.message}` : '.'}`
        )
    })

    /** Texts are set only when they change: this runs on every frame while it plays. */
    const setText = (el: HTMLElement, text: string) => {
        if (el.textContent !== text) el.setText(text)
    }
    const setPressed = (el: HTMLElement, on: boolean) => el.setAttribute('aria-pressed', String(on))
    let drawnTicks = -1
    let readAt = Number.NEGATIVE_INFINITY
    let readTapped: number | null = null
    let playing: boolean | null = null

    function refresh(): void {
        const c = controller
        if (!c) return
        const duration = c.duration()
        const known = Number.isFinite(duration) && duration > 0
        const position = c.position()
        setText(time, `${formatTime(position, true)} / ${known ? formatTime(duration) : '–:––'}`)
        if (known) {
            if (range.max !== String(duration)) range.max = String(duration)
            const value = String(Math.round(position * 10) / 10)
            if (range.value !== value) range.value = value
            range.setAttribute('aria-valuetext', formatTime(position, true))
        }
        const isPlaying = c.status !== 'paused'
        if (playing !== isPlaying) {
            playing = isPlaying
            play.empty()
            setIcon(play, isPlaying ? 'pause' : 'play')
            const label = isPlaying ? 'Pause (Space)' : 'Play (Space)'
            play.setAttribute('aria-label', label)
            play.setAttribute('title', label)
        }
        const { a, b } = c.state
        setText(speed, `${Math.round(c.state.speed * 100)} %`)
        setPressed(loop, c.state.loop)
        loop.toggleClass('is-active', c.state.loop)
        setA.toggleClass('is-active', a !== null)
        setB.toggleClass('is-active', b !== null)
        setA.setAttribute(
            'title',
            a !== null ? `A: ${formatTime(a, true)} ([)` : 'Set A at the playhead ([)'
        )
        setB.setAttribute(
            'title',
            b !== null ? `B: ${formatTime(b, true)} (])` : 'Set B at the playhead (])'
        )
        clear.disabled = a === null && b === null
        if (known && a !== null && b !== null) {
            span.removeClass('mp-is-hidden')
            span.setCssProps({ '--mp-from': percent(a, duration), '--mp-to': percent(b, duration) })
        } else span.addClass('mp-is-hidden')
        if (known && drawnTicks !== duration) {
            drawnTicks = duration
            ticks.empty()
            for (const section of c.sections)
                ticks.createDiv({ cls: 'mp-playalong-tick' }).setCssProps({
                    '--mp-at': percent(section.time, duration)
                })
        }
        setPressed(countIn, c.state.countIn)
        countIn.toggleClass('is-active', c.state.countIn)
        // The note's tempo and kind are read at most once a second (refresh runs on every frame
        // while it plays), and at once after a tap.
        const now = win.performance.now()
        if (now - readAt > 1000 || c.state.tapped !== readTapped) {
            readAt = now
            readTapped = c.state.tapped
            const t = c.tempo()
            setText(tempo, t ? `${Math.round(t.bpm)} BPM (${SOURCE_LABEL[t.source]})` : 'No tempo')
            saveBpm.toggleClass('mp-is-hidden', !request.learning())
            saveBpm.disabled = t === null
        }
        setText(
            status,
            c.status === 'counting'
                ? 'Count-in…'
                : c.state.loop && a !== null && b !== null
                  ? `Loop ${formatTime(a, true)} – ${formatTime(b, true)}`
                  : ''
        )
    }

    return {
        media,
        clock: {
            frame: (callback) => win.requestAnimationFrame(() => callback()),
            cancelFrame: (id) => win.cancelAnimationFrame(id)
        },
        window: win,
        bind(c) {
            controller = c
            refresh()
            // Keyboard shortcuts are for desktop; the buttons work everywhere.
            if (Platform.isMobile) root.removeAttribute('tabindex')
        },
        refresh,
        visible: () => root.isConnected && root.offsetParent !== null,
        hidden: () => root.isConnected && root.offsetParent === null,
        hasFocus: () => root.contains(doc.activeElement),
        focus: () => root.focus(),
        destroy() {
            controller = null
            media.pause()
            media.removeAttribute('src')
            media.load()
            root.remove()
        }
    }
}

/** In place of a player: a message (none for a block shown as code) and the block's text. */
export function showPlayAlongMessage(el: HTMLElement, message: string, source: string): void {
    if (message) el.createDiv({ cls: 'mn-error-message mp-playalong-message', text: message })
    el.createEl('pre').createEl('code', { cls: 'language-playalong', text: source })
}
