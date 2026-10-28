import { Notice, Plugin } from 'obsidian'
import { createDefaultSettings, settingsFrom } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { MusicPracticeSettingTab } from './settings/settings-tab'
import { log } from '../utils/log'
import { registerWhatsNewView } from './whats-new'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { NoteModelService } from './services/note-model.service'
import { ItemRepository } from './services/item-repository'
import { onStarterKitNoteTypesChanged } from './services/starter-kit.service'
import { PracticeNextModal } from './ui/practice-next-modal'
import { PracticePlanModal } from './ui/practice-plan-modal'
import { PracticeLogService } from './services/practice-log.service'
import { kapActiveTimer, withKapFieldNames } from './services/kanban-action-planner.service'
import { LogPracticeModal } from './ui/log-practice-modal'
import { MasteryModal } from './ui/mastery-modal'
import { BpmModal } from './ui/bpm-modal'
import type { LearningItem } from './domain/practice'
import type { LearningType } from './domain/note-model'
import type { LogPracticePreset } from './ui/log-practice-modal'
import type { FieldNames } from './domain/fields'
import type { PracticeRules } from './domain/rules'
import { clockTime, formatElapsed, minutesBetween } from './domain/timer'

export class MusicPracticePlugin extends Plugin {
    /**
     * The plugin settings are immutable
     */
    // `override` required: `Plugin.settings?: unknown` exists in the 1.13+
    // typings this template now targets (minAppVersion 1.13.0).
    override settings: PluginSettings = produce(createDefaultSettings(), () => {})

    noteModel!: NoteModelService
    items!: ItemRepository
    practiceLog!: PracticeLogService

    /** The rules and field names in effect (the Kanban Action Planner's time and review names win). */
    effective(): { rules: PracticeRules; fields: FieldNames } {
        return {
            rules: this.settings.rules,
            fields: withKapFieldNames(this.app, this.settings.fields)
        }
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

        // Other plugins (the Obsidian Starter Kit) load after us: build the model once the
        // layout is ready, and again whenever the Starter Kit's note types change.
        this.app.workspace.onLayoutReady(() => this.noteModel.refresh())
        this.registerEvent(
            onStarterKitNoteTypesChanged(this.app.workspace, () => this.noteModel.refresh())
        )

        this.addCommand({
            id: 'practice-next',
            name: 'Practice next',
            callback: () => {
                const model = this.ensureModel()
                if (!model) return
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
                if (!model) return
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
            id: 'change-mastery',
            name: 'Change mastery of the current note',
            checkCallback: (checking) => {
                const current = this.activeItem()
                if (!current) return false
                if (!checking)
                    new MasteryModal(this.app, current.item, current.type, async (level) => {
                        await this.practiceLog.setLevel(current.item, level)
                    }).open()
                return true
            }
        })
        this.addCommand({
            id: 'set-bpm',
            name: 'Set BPM of the current note',
            checkCallback: (checking) => {
                const current = this.activeItem()
                if (!current) return false
                if (!checking)
                    new BpmModal(
                        this.app,
                        current.item,
                        this.settings.rules.levels.tempo,
                        async (bpm) => {
                            await this.practiceLog.setBpm(current.item, bpm)
                            if (bpm.atTempo)
                                await this.practiceLog.setLevel(
                                    current.item,
                                    this.settings.rules.levels.tempo
                                )
                        }
                    ).open()
                return true
            }
        })

        // Practice timer: persisted start, elapsed time in the status bar, stop opens Log practice.
        this.timerEl = this.addStatusBarItem()
        this.timerEl.addClass('mp-timer', 'mod-clickable')
        this.timerEl.setAttr('aria-label', 'Stop the practice timer and log the session')
        this.timerEl.addEventListener('click', () => this.stopTimer())
        this.registerInterval(window.setInterval(() => this.renderTimer(), 1000))
        this.renderTimer()
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

        // Add a settings screen for the plugin
        this.addSettingTab(new MusicPracticeSettingTab(this.app, this))
    }

    override onunload() {}

    private timerEl: HTMLElement | null = null

    /** The learning item of the active note, or null. */
    private activeItem(): { item: LearningItem; type: LearningType } | null {
        const file = this.app.workspace.getActiveFile()
        if (!file || this.noteModel.get().learningTypes.length === 0) return null
        const type = this.items.typeOf(file)
        const item = type ? this.items.items().find((i) => i.path === file.path) : undefined
        return type && item ? { item, type } : null
    }

    async startTimer(): Promise<void> {
        await this.updateSettings((draft) => {
            draft.timerStartedAt = Date.now()
        })
        this.renderTimer()
        new Notice('Practice timer started.')
    }

    /** Open Log practice with the timer's minutes; the timer clears once the session is logged. */
    stopTimer(): void {
        const startedAt = this.settings.timerStartedAt
        if (!startedAt) return
        this.openLogPractice({
            minutes: minutesBetween(startedAt, Date.now()),
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

    /** Open Log practice, offering a running Kanban Action Planner timer when there is one. */
    openLogPractice(preset: LogPracticePreset = {}): void {
        const model = this.ensureModel()
        if (!model) return
        const timer = kapActiveTimer(this.app)
        const timerFile = timer ? this.app.vault.getFileByPath(timer.path) : null
        new LogPracticeModal(
            this.app,
            {
                model,
                items: this.items.items(),
                rules: this.settings.rules,
                fields: this.effective().fields,
                sessionTypeFor: (items) => this.practiceLog.sessionTypeFor(items),
                submit: async (request, adoptTimer) => {
                    const result = await this.practiceLog.log(request, { adoptTimer })
                    return result.sessionPath
                        .substring(result.sessionPath.lastIndexOf('/') + 1)
                        .replace(/\.md$/, '')
                }
            },
            {
                ...preset,
                timer:
                    timer && timerFile
                        ? { startedAt: timer.startedAt, activityName: timerFile.basename }
                        : null
            }
        ).open()
    }

    /** The current note model, rebuilt when empty; null (with a notice) when there is no source. */
    private ensureModel() {
        const model = this.noteModel.get().learningTypes.length
            ? this.noteModel.get()
            : this.noteModel.refresh()
        if (this.noteModel.source === 'none') {
            new Notice(
                'Music Practice needs the Obsidian Starter Kit for now: its note types define the learning notes.'
            )
            return null
        }
        return model
    }

    /**
     * Load the plugin settings: every stored value is checked against the defaults' shape, so an
     * older or hand-edited data.json can't put a wrong type into the settings.
     */
    async loadSettings() {
        log('Loading settings', 'debug')
        const loaded: unknown = await this.loadData()
        if (!loaded) {
            log('Using default settings', 'debug')
            return
        }
        this.settings = produce(settingsFrom(loaded), () => {})
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
            this.settings = next
            this.noteModel?.refresh()
        }
        const p = this.settingsWriteChain.then(run, run)
        this.settingsWriteChain = p.catch(() => {})
        return p
    }
}
