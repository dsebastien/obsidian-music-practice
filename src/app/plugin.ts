import { Notice, Plugin } from 'obsidian'
import type { TFile } from 'obsidian'
import { createDefaultSettings, settingsFrom } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { MusicPracticeSettingTab } from './settings/settings-tab'
import { crossCheck } from './settings/setting-paths'
import { log } from '../utils/log'
import { registerWhatsNewView } from './whats-new'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { NoteModelService } from './services/note-model.service'
import type { NoteModelSource } from './services/note-model.service'
import { ItemRepository } from './services/item-repository'
import { onStarterKitNoteTypesChanged } from './services/starter-kit.service'
import { PracticeNextModal } from './ui/practice-next-modal'
import { PracticePlanModal } from './ui/practice-plan-modal'
import { PracticeLogService } from './services/practice-log.service'
import { withKapFieldNames } from './services/kanban-action-planner.service'
import { LogPracticeModal } from './ui/log-practice-modal'
import type { LogPracticePreset } from './ui/log-practice-modal'
import { MasteryModal } from './ui/mastery-modal'
import { AddNoteModal } from './ui/add-note-modal'
import { NoteCreatorService } from './services/note-creator.service'
import { createApi } from './api'
import type { MusicPracticeApi } from './api'
import { BpmModal } from './ui/bpm-modal'
import { isoDate } from './domain/dates'
import type { LearningType, NoteModel } from './domain/note-model'
import type { FieldNames } from './domain/fields'
import type { PracticeRules } from './domain/rules'
import type { LocalModelSettings } from './domain/local-model'
import { clockTime, formatElapsed, minutesBetween } from './domain/timer'
import { NotationBlocks } from './services/notation.service'
import { layoutDefaults } from './domain/notation-layout'
import type { NotationStatus } from './services/notation.service'
import type { NotationLanguage } from '@dsebastien/music-notation'

/** A timer running longer than this is probably forgotten: the log asks to check the minutes. */
const LONG_TIMER_MS = 4 * 60 * 60_000

export class MusicPracticePlugin extends Plugin {
    /**
     * The plugin settings are immutable
     */
    // `override` required: `Plugin.settings?: unknown` exists in the 1.13+
    // typings this template now targets (minAppVersion 1.13.0).
    override settings: PluginSettings = produce(createDefaultSettings(), () => {})

    private noteModel!: NoteModelService
    private items!: ItemRepository
    private practiceLog!: PracticeLogService
    private noteCreator!: NoteCreatorService
    private notation!: NotationBlocks
    private timerEl: HTMLElement | null = null
    private logModal: LogPracticeModal | null = null
    /** Settings found invalid on load and replaced by the defaults, to report once the UI is up. */
    private loadProblem: string | null = null

    /** Public API for scripts and AI skills (see docs/api.md). */
    api!: MusicPracticeApi

    /** The rules and field names in effect (the Kanban Action Planner's time and review names win). */
    effective(): { rules: PracticeRules; fields: FieldNames; local: LocalModelSettings } {
        return {
            rules: this.settings.rules,
            fields: withKapFieldNames(this.app, this.settings.fields),
            local: this.settings.local
        }
    }

    /** Whether new chord notes get a ```chord block: only when Music Practice draws them. */
    chordBlocksOn(): boolean {
        return this.notation?.status('chord') === 'on'
    }

    /** Whether Music Practice draws a notation block language (for the settings tab). */
    notationStatus(language: NotationLanguage): NotationStatus {
        return this.notation.status(language)
    }

    /** Where the note types come from and what was found (for the settings tab). */
    describeModel(): { source: NoteModelSource; model: NoteModel } {
        const model = this.noteModel.refresh()
        return { source: this.noteModel.source, model }
    }

    /**
     * Executed as soon as the plugin loads
     */
    override async onload() {
        log('Initializing', 'debug')
        // Must run before anything can call saveData (fresh-install detection)
        registerWhatsNewView(this)
        await this.loadSettings()

        this.noteModel = new NoteModelService(this.app, () => this.effective())
        this.items = new ItemRepository(
            this.app,
            () => this.noteModel.get(),
            () => this.effective()
        )
        this.practiceLog = new PracticeLogService(
            this.app,
            () => this.noteModel.get(),
            this.items,
            () => ({
                ...this.effective(),
                notesHeading: this.settings.notesHeading,
                activityName: this.settings.activityName
            })
        )
        this.noteCreator = new NoteCreatorService(this.app, this.items, () => this.effective())
        this.api = createApi({
            model: () => this.noteModel.refresh(),
            rules: () => this.settings.rules,
            items: this.items,
            log: this.practiceLog,
            timer: {
                get: () => this.settings.timerStartedAt || null,
                start: () => this.startTimer(),
                clear: () => this.clearTimer()
            }
        })

        // The item index follows the vault: it is rebuilt after metadata changes, renames and deletions.
        const invalidate = () => {
            this.items.invalidate()
            this.noteModel.invalidate()
        }
        this.registerEvent(this.app.metadataCache.on('changed', invalidate))
        this.registerEvent(this.app.vault.on('delete', invalidate))
        this.registerEvent(this.app.vault.on('rename', invalidate))

        // Other plugins (the Obsidian Starter Kit) load after us: build the model once the
        // layout is ready, and again whenever the Starter Kit's note types change.
        this.app.workspace.onLayoutReady(() => {
            this.noteModel.refresh()
            if (this.loadProblem) new Notice(`Music Practice: ${this.loadProblem}`)
        })
        this.registerEvent(
            onStarterKitNoteTypesChanged(this.app.workspace, () => this.noteModel.refresh())
        )

        this.registerCommands()

        // Notation code blocks (chord, chords, keyboard, fretboard), drawn by the notation library.
        // Registered once the layout is ready: plugins enabled at startup register theirs first, so
        // a block language another plugin uses stays theirs (Obsidian refuses a second processor).
        this.notation = new NotationBlocks(
            this,
            () => this.settings.notation,
            () => layoutDefaults(this.settings.notationLayout)
        )
        this.app.workspace.onLayoutReady(() => this.notation.sync())

        // Practice timer: persisted start, elapsed time in the status bar, stop opens Log practice.
        this.timerEl = this.addStatusBarItem()
        this.timerEl.addClass('mp-timer', 'mod-clickable')
        this.timerEl.setAttr('aria-label', 'Stop the practice timer and log the session')
        this.timerEl.addEventListener('click', () => this.stopTimer())
        this.registerInterval(window.setInterval(() => this.renderTimer(), 1000))
        this.renderTimer()

        // Add a settings screen for the plugin
        this.addSettingTab(new MusicPracticeSettingTab(this.app, this))
    }

    override onunload() {}

    /** Another device (sync) changed data.json: reload, so a save here never wipes its changes. */
    override async onExternalSettingsChange(): Promise<void> {
        const notation = JSON.stringify(this.settings.notation)
        const layout = JSON.stringify(this.settings.notationLayout)
        await this.loadSettings()
        this.noteModel?.refresh()
        this.renderTimer()
        this.notation?.sync()
        if (JSON.stringify(this.settings.notation) !== notation) this.notation?.refreshOpenNotes()
        if (JSON.stringify(this.settings.notationLayout) !== layout) this.notation?.redrawLayout()
    }

    private registerCommands(): void {
        this.addCommand({
            id: 'practice-next',
            name: 'Practice next',
            callback: () => {
                const model = this.ensureModel()
                new PracticeNextModal(
                    this.app,
                    model,
                    this.items.items(),
                    this.settings.rules
                ).open()
            }
        })
        this.addCommand({
            id: 'practice-plan',
            name: 'Plan a practice session',
            callback: () => {
                const model = this.ensureModel()
                new PracticePlanModal(
                    this.app,
                    model,
                    this.items.items(),
                    this.settings.rules,
                    this.settings.defaultPlanMinutes,
                    (minutes, paths) => this.openLogPractice({ minutes, paths })
                ).open()
            }
        })
        this.addCommand({
            id: 'log-practice',
            name: 'Log practice',
            callback: () => this.openLogPractice()
        })
        this.addCommand({
            id: 'add-learning-note',
            name: 'Add a learning note',
            callback: () => {
                const model = this.ensureModel()
                if (model.learningTypes.length === 0) return
                new AddNoteModal(
                    this.app,
                    model.learningTypes,
                    this.effective().fields,
                    () => this.chordBlocksOn(),
                    async (type, spec) => {
                        const file = await this.noteCreator.create(type, spec)
                        await this.app.workspace.getLeaf(false).openFile(file)
                    },
                    () => layoutDefaults(this.settings.notationLayout)
                ).open()
            }
        })
        this.addCommand({
            id: 'change-mastery',
            name: 'Change mastery of the current note',
            checkCallback: (checking) => {
                const file = this.activeLearningNote()
                if (!file) return false
                if (!checking) {
                    const current = this.itemOf(file.file)
                    if (!current) return true
                    new MasteryModal(
                        this.app,
                        current,
                        file.type,
                        this.settings.rubric,
                        this.settings.rules,
                        async (level) => {
                            await this.practiceLog.setLevel(current, level)
                        }
                    ).open()
                }
                return true
            }
        })
        this.addCommand({
            id: 'set-bpm',
            name: 'Set BPM of the current note',
            checkCallback: (checking) => {
                const file = this.activeLearningNote()
                if (!file) return false
                if (!checking) {
                    const current = this.itemOf(file.file)
                    if (!current) return true
                    new BpmModal(
                        this.app,
                        current,
                        this.settings.rules.levels.tempo,
                        async (bpm) => {
                            await this.practiceLog.setBpmAndLevel(
                                current,
                                bpm,
                                bpm.atTempo ? this.settings.rules.levels.tempo : undefined
                            )
                        }
                    ).open()
                }
                return true
            }
        })
        this.addCommand({
            id: 'start-timer',
            name: 'Start practice timer',
            checkCallback: (checking) => {
                if (this.settings.timerStartedAt) return false
                if (!checking) void this.startTimer()
                return true
            }
        })
        this.addCommand({
            id: 'stop-timer',
            name: 'Stop practice timer and log the session',
            checkCallback: (checking) => {
                if (!this.settings.timerStartedAt) return false
                if (!checking) this.stopTimer()
                return true
            }
        })
    }

    /** The active note when it is a learning note. Cheap: the command palette calls it on every keystroke. */
    private activeLearningNote(): { file: TFile; type: LearningType } | null {
        const file = this.app.workspace.getActiveFile()
        const type = file ? this.items.typeOf(file) : null
        return file && type ? { file, type } : null
    }

    private itemOf(file: TFile) {
        return this.items.items().find((i) => i.path === file.path) ?? null
    }

    async startTimer(): Promise<void> {
        if (this.settings.timerStartedAt) throw new Error('The practice timer is already running.')
        await this.updateSettings((draft) => {
            draft.timerStartedAt = Date.now()
        })
        this.renderTimer()
        new Notice('Practice timer started.')
    }

    /** Open Log practice with the timer's minutes, date and start; the timer clears once logged. */
    stopTimer(): void {
        const startedAt = this.settings.timerStartedAt
        if (!startedAt) return
        const elapsed = Date.now() - startedAt
        if (elapsed > LONG_TIMER_MS)
            new Notice(
                `The practice timer ran ${formatElapsed(elapsed)}: check the minutes before logging.`
            )
        this.openLogPractice({
            minutes: Math.min(minutesBetween(startedAt, Date.now()), 1440),
            date: isoDate(new Date(startedAt)),
            startTime: clockTime(startedAt),
            onLogged: () => void this.clearTimer()
        })
    }

    async clearTimer(): Promise<void> {
        await this.updateSettings((draft) => {
            draft.timerStartedAt = 0
        })
        this.renderTimer()
    }

    private renderTimer(): void {
        const el = this.timerEl
        if (!el) return
        const startedAt = this.settings.timerStartedAt
        el.toggleClass('mp-is-hidden', !startedAt)
        if (startedAt) el.setText(`♪ ${formatElapsed(Date.now() - startedAt)}`)
    }

    /** Open Log practice (once: a second call while it is open does nothing). */
    openLogPractice(preset: LogPracticePreset = {}): void {
        if (this.logModal) {
            new Notice('Log practice is already open.')
            return
        }
        const model = this.ensureModel()
        const modal = new LogPracticeModal(
            this.app,
            {
                model,
                items: this.items.items(),
                rules: this.settings.rules,
                fields: this.effective().fields,
                rubric: this.settings.rubric,
                sessionTypesFor: (items) => this.practiceLog.sessionTypesFor(items),
                timerFor: (items, sessionTypeId) => {
                    const session = this.practiceLog.sessionTypeFor(items, sessionTypeId)
                    const activity = session ? this.practiceLog.findActivity(session) : null
                    const timer = this.practiceLog.timerOn(activity)
                    return timer && activity
                        ? { startedAt: timer.startedAt, activityName: activity.basename }
                        : null
                },
                submit: async (request, adoptTimer) => {
                    const result = await this.practiceLog.log(request, { adoptTimer })
                    for (const warning of result.warnings) new Notice(warning)
                    if (result.activity?.result === 'missing')
                        new Notice(
                            'The Kanban Action Planner timer was stopped but its time entry did not appear: check the activity, nothing was added to avoid counting the time twice.'
                        )
                    return result.sessionPath
                        .substring(result.sessionPath.lastIndexOf('/') + 1)
                        .replace(/\.md$/, '')
                },
                onClosed: () => {
                    this.logModal = null
                }
            },
            preset
        )
        this.logModal = modal
        modal.open()
    }

    /** The note model, rebuilt so notes added since the last command count. */
    private ensureModel(): NoteModel {
        const model = this.noteModel.refresh()
        if (model.learningTypes.length === 0)
            new Notice(
                this.noteModel.source === 'starter-kit'
                    ? 'No learning note types in the Obsidian Starter Kit: a learning type has a status on the mastery scale and a "last practiced" property.'
                    : 'No learning notes yet. Tag a note type/<domain>/<subject>/<kind> (for example type/music/guitar/chord) and give it a mastery level.'
            )
        return model
    }

    /**
     * Load the plugin settings: every stored value is checked against the defaults' shape, so an
     * older or hand-edited data.json can't put a wrong type into the settings. Rules or property
     * names that break the cross-field checks (blocks not adding up to 100…) fall back to defaults.
     */
    async loadSettings() {
        log('Loading settings', 'debug')
        const loaded: unknown = await this.loadData()
        if (!loaded) {
            log('Using default settings', 'debug')
            return
        }
        const settings = settingsFrom(loaded)
        const problem = crossCheck(settings)
        if (problem) {
            const defaults = createDefaultSettings()
            settings.rules = defaults.rules
            settings.fields = defaults.fields
            this.loadProblem = `${problem} The rules and property names were reset to their defaults.`
        }
        this.settings = produce(settings, () => {})
        log(`Settings loaded`, 'debug', loaded)
    }

    /** Serializes settings writes; see updateSettings. */
    private settingsWriteChain: Promise<void> = Promise.resolve()

    /**
     * Apply a mutation to the settings (via immer) and persist the result.
     * The single write path — the declarative settings tab routes every
     * control edit through here so persistence happens in exactly one place.
     */
    updateSettings(mutator: (draft: Draft<PluginSettings>) => void): Promise<void> {
        // Persist-then-commit: swap memory only after saveData() succeeds, so
        // a rejected write rolls the control back to the on-disk truth.
        // Serialized: writes queue and each mutation derives from the
        // previous COMMITTED state — without this, overlapping calls produce
        // from the same base across the save await and the second commit
        // silently drops the first edit.
        const run = async (): Promise<void> => {
            const next = produce(this.settings, mutator)
            await this.saveData(next)
            const notationChanged = next.notation !== this.settings.notation
            const layoutChanged = next.notationLayout !== this.settings.notationLayout
            this.settings = next
            this.noteModel?.refresh()
            if (notationChanged) {
                this.notation?.sync()
                this.notation?.refreshOpenNotes()
            }
            if (layoutChanged) this.notation?.redrawLayout()
        }
        const p = this.settingsWriteChain.then(run, run)
        this.settingsWriteChain = p.catch(() => {})
        return p
    }
}
