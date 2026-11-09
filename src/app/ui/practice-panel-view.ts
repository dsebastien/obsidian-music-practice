import { FuzzySuggestModal, ItemView, Menu } from 'obsidian'
import type { App, WorkspaceLeaf } from 'obsidian'
import type { NoteModel } from '../domain/note-model'
import { withPaths, type PanelItem } from '../domain/panel'
import type { LearningItem } from '../domain/practice'
import { formatElapsed, staleTimerLabel, timerElapsed, type TimerState } from '../domain/timer'
import type { ItemMeter, Metronome } from '../services/metronome.service'
import { renderBadge } from './item-row'
import { renderMetronome, type MetronomeViewDeps } from './metronome-view'

export const PRACTICE_PANEL_VIEW = 'music-practice-panel'

/** What the practice panel needs from the plugin. */
export interface PracticePanelDeps {
    model: () => NoteModel
    items: () => LearningItem[]
    list: () => readonly PanelItem[]
    /** Change the list from its latest state. */
    setList: (change: (items: PanelItem[]) => PanelItem[]) => Promise<void>
    timer: () => TimerState
    startTimer: () => Promise<void>
    togglePause: () => Promise<void>
    /** Throw the timer away without logging it (asks first); true when discarded. */
    discardTimer: () => Promise<boolean>
    /** Log this session: the ticked items (or all), their BPMs, the timer's minutes when it runs. */
    logSession: () => void
    planIntoPanel: () => void
    drill: () => void
    /** Note, chord and scale drills (#73). */
    noteDrill: () => void
    metronome: Metronome
    /** A learning note's time signature, as the metronome counts it (#77). */
    meterOf?: (path: string) => ItemMeter | null
    metronomeDeps: () => MetronomeViewDeps
}

/**
 * The practice panel (#37): the timer, the session list (ticked off, BPM nudges), the metronome
 * for the selected item, and Log this session.
 */
export class PracticePanelView extends ItemView {
    private timerText: HTMLElement | null = null
    private timerStale: HTMLElement | null = null
    private timerButtons: HTMLElement | null = null
    private listEl: HTMLElement | null = null
    private metronomeCleanup: (() => void) | null = null

    constructor(
        leaf: WorkspaceLeaf,
        private readonly deps: PracticePanelDeps
    ) {
        super(leaf)
    }

    override getViewType(): string {
        return PRACTICE_PANEL_VIEW
    }

    override getDisplayText(): string {
        return 'Practice'
    }

    override getIcon(): string {
        return 'music'
    }

    override onOpen(): Promise<void> {
        const root = this.contentEl
        root.empty()
        root.addClass('mp-panel')

        const timer = root.createDiv({ cls: 'mp-panel-section mp-panel-timer' })
        this.timerText = timer.createDiv({ cls: 'mp-panel-elapsed' })
        this.timerStale = timer.createDiv({ cls: 'mp-panel-stale' })
        this.timerButtons = timer.createDiv({ cls: 'mp-actions' })

        const session = root.createDiv({ cls: 'mp-panel-section' })
        const head = session.createDiv({ cls: 'mp-panel-head' })
        head.createEl('h4', { text: 'Session' })
        const tools = head.createDiv({ cls: 'mp-actions' })
        tools.createEl('button', { text: 'Add' }).addEventListener('click', () => this.pickItem())
        tools
            .createEl('button', { text: 'Plan' })
            .addEventListener('click', () => this.deps.planIntoPanel())
        tools
            .createEl('button', { text: 'Drill', attr: { 'aria-label': 'Drills' } })
            .addEventListener('click', (event) => {
                // Two kinds of drills (#73): chord changes, and notes, chords and scales.
                const menu = new Menu()
                menu.addItem((item) =>
                    item
                        .setTitle('Chord changes')
                        .setIcon('repeat')
                        .onClick(() => this.deps.drill())
                )
                menu.addItem((item) =>
                    item
                        .setTitle('Notes, chords and scales')
                        .setIcon('target')
                        .onClick(() => this.deps.noteDrill())
                )
                // From the keyboard (no pointer), under the button, not at the window's corner.
                if (event.detail === 0) {
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                    menu.showAtPosition({ x: rect.left, y: rect.bottom })
                } else menu.showAtMouseEvent(event)
            })
        tools
            .createEl('button', { text: 'Clear' })
            .addEventListener('click', () => void this.deps.setList(() => []))
        this.listEl = session.createDiv({ cls: 'mp-list' })
        session
            .createEl('button', { cls: 'mod-cta mp-panel-log', text: 'Log this session' })
            .addEventListener('click', () => this.deps.logSession())

        const metronome = root.createDiv({ cls: 'mp-panel-section' })
        metronome.createEl('h4', { text: 'Metronome' })
        this.metronomeCleanup = renderMetronome(
            metronome,
            this.deps.metronome,
            this.deps.metronomeDeps()
        )

        this.registerInterval(window.setInterval(() => this.renderTimer(), 1000))
        this.refresh()
        return Promise.resolve()
    }

    override onClose(): Promise<void> {
        this.metronomeCleanup?.()
        this.metronomeCleanup = null
        this.contentEl.empty()
        return Promise.resolve()
    }

    /** Redraw after the list, the timer or the items changed. */
    refresh(): void {
        this.renderTimer(true)
        this.renderList()
    }

    private renderTimer(buttons = false): void {
        const timer = this.deps.timer()
        this.timerText?.setText(
            timer.startedAt
                ? `${timer.pausedAt ? 'Paused · ' : ''}${formatElapsed(timerElapsed(timer, Date.now()))}`
                : 'Timer off'
        )
        const stale = staleTimerLabel(timer, Date.now())
        this.timerStale?.setText(stale ?? '')
        this.timerStale?.toggleClass('mp-is-hidden', stale === null)
        // The buttons follow the stale state too: the panel redraws them when it changes.
        const isStale = stale !== null
        if (this.timerButtons && this.timerButtons.dataset['stale'] !== String(isStale))
            buttons = true
        if (!buttons || !this.timerButtons) return
        this.timerButtons.dataset['stale'] = String(isStale)
        const el = this.timerButtons
        el.empty()
        if (!timer.startedAt) {
            el.createEl('button', { text: 'Start' }).addEventListener(
                'click',
                () => void this.deps.startTimer().then(() => this.refresh())
            )
            return
        }
        el.createEl('button', { text: timer.pausedAt ? 'Resume' : 'Pause' }).addEventListener(
            'click',
            () => void this.deps.togglePause().then(() => this.refresh())
        )
        el.createEl('button', {
            cls: isStale ? 'mod-warning' : '',
            text: 'Discard',
            attr: { 'aria-label': 'Discard the practice timer without logging it' }
        }).addEventListener('click', () => void this.deps.discardTimer().then(() => this.refresh()))
    }

    private renderList(): void {
        const el = this.listEl
        if (!el) return
        el.empty()
        const list = this.deps.list()
        if (!list.length) {
            el.createDiv({
                cls: 'mp-muted',
                text: 'Nothing yet: add items, or start from a practice plan.'
            })
            return
        }
        const model = this.deps.model()
        const byPath = new Map(this.deps.items().map((i) => [i.path, i]))
        const update = (path: string, change: Partial<PanelItem>) =>
            void this.deps.setList((items) =>
                items.map((i) => (i.path === path ? { ...i, ...change } : i))
            )
        for (const entry of list) {
            const item = byPath.get(entry.path)
            const row = el.createDiv({ cls: `mp-row mp-panel-row${entry.done ? ' is-done' : ''}` })
            const check = row.createEl('input', {
                type: 'checkbox',
                attr: { 'aria-label': `Practiced ${item?.name ?? entry.path}` }
            })
            check.checked = entry.done
            check.addEventListener('change', () => update(entry.path, { done: check.checked }))
            const body = row.createDiv({ cls: 'mp-panel-body' })
            const link = body.createEl('a', {
                cls: 'internal-link',
                text: item?.name ?? entry.path.replace(/^.*\//, '').replace(/\.md$/, '')
            })
            link.tabIndex = 0
            const open = () => void this.app.workspace.openLinkText(entry.path, '', false)
            link.addEventListener('click', (event) => {
                event.preventDefault()
                open()
            })
            link.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') open()
            })
            if (item) renderBadge(body, model, item)
            if (item && (item.bpmCurrent !== null || item.bpmTarget !== null)) {
                const bpm = body.createDiv({ cls: 'mp-panel-bpm' })
                const reached = entry.bpm ?? item.bpmCurrent ?? item.bpmTarget ?? 60
                bpm.createSpan({
                    text: `${reached}${item.bpmTarget !== null ? ` → ${item.bpmTarget}` : ''} BPM`
                })
                for (const [by, label] of [
                    [-1, '−'],
                    [1, '+']
                ] as const) {
                    bpm.createEl('button', {
                        text: label,
                        attr: { 'aria-label': `${by > 0 ? 'Raise' : 'Lower'} the BPM reached` }
                    }).addEventListener('click', () =>
                        update(entry.path, { bpm: Math.max(1, reached + by) })
                    )
                }
            }
            const actions = row.createDiv({ cls: 'mp-actions' })
            if (item)
                actions
                    .createEl('button', {
                        text: '♩',
                        attr: { 'aria-label': `Metronome for ${item.name}` }
                    })
                    .addEventListener('click', () =>
                        this.deps.metronome.setItem({
                            path: item.path,
                            name: item.name,
                            bpmCurrent: entry.bpm ?? item.bpmCurrent,
                            bpmTarget: item.bpmTarget,
                            meter: this.deps.meterOf?.(item.path) ?? null
                        })
                    )
            actions
                .createEl('button', {
                    text: '×',
                    attr: { 'aria-label': 'Remove from the session' }
                })
                .addEventListener(
                    'click',
                    () =>
                        void this.deps.setList((items) =>
                            items.filter((i) => i.path !== entry.path)
                        )
                )
        }
    }

    private pickItem(): void {
        const listed = new Set(this.deps.list().map((i) => i.path))
        new ItemSuggestModal(
            this.app,
            this.deps.items().filter((i) => !listed.has(i.path)),
            (item) => void this.deps.setList((items) => withPaths(items, [item.path]))
        ).open()
    }
}

/** Pick a learning item by name. */
export class ItemSuggestModal extends FuzzySuggestModal<LearningItem> {
    constructor(
        app: App,
        private readonly choices: LearningItem[],
        private readonly onChoose: (item: LearningItem) => void
    ) {
        super(app)
        this.setPlaceholder('Add an item to the session')
    }

    override getItems(): LearningItem[] {
        return [...this.choices].sort((a, b) => a.name.localeCompare(b.name))
    }

    override getItemText(item: LearningItem): string {
        return item.name
    }

    override onChooseItem(item: LearningItem): void {
        this.onChoose(item)
    }
}
