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
import type { NoteContext } from './services/notation.service'
import type { UndoResult } from './services/practice-log.service'
import { Metronome } from './services/metronome.service'
import type { MetronomeItem } from './services/metronome.service'
import { MetronomeModal } from './ui/metronome-view'
import type { MetronomeViewDeps } from './ui/metronome-view'
import { learningTypeOf } from './domain/item-reader'
import { propertyNamesOf, chordFromNotes, withAlias } from './domain/notation-note'
import { ChooseChordModal } from './ui/choose-chord-modal'
import { parseChord } from '@dsebastien/music-notation'
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
    private metronomeEl: HTMLElement | null = null
    /** One metronome for the panel, the modal and the commands. */
    metronome!: Metronome
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

    /**
     * Name a chord note from its frets (guitar) or pitches (piano): fills the chord symbol, root,
     * quality and alias. Asks which reading when several fit; leaves a named chord alone.
     */
    private identifyChord(
        file: TFile,
        type: LearningType,
        frontmatter: Record<string, unknown>
    ): void {
        const fields = this.effective().fields
        // As the blocks read them: lists joined, frets stored as numbers given their zeros back.
        const text = (name: string, digits = 0) => {
            const value = frontmatter[name]
            const plain = Array.isArray(value)
                ? value.map(String).join(' ')
                : typeof value === 'string' || typeof value === 'number'
                  ? String(value)
                  : ''
            return typeof value === 'number' && digits ? plain.padStart(digits, '0') : plain.trim()
        }
        const named = text(fields.chordSymbol)
        if (named) {
            new Notice(
                `Already named ${named}: clear "${fields.chordSymbol}" to identify it again.`
            )
            return
        }
        if (!type.fields.has(fields.chordSymbol)) {
            new Notice(
                `This note type has no "${fields.chordSymbol}" property to name the chord in.`
            )
            return
        }
        const detected = chordFromNotes(text(fields.frets, 6), text(fields.pitches), type.subject)
        if (!detected) {
            new Notice(
                type.subject === 'piano'
                    ? `No chord found: add the notes to "${fields.pitches}" (A3 C#4 E4).`
                    : `No chord found: add six frets to "${fields.frets}" (x02220).`
            )
            return
        }
        const apply = async (symbol: string) => {
            const chord = parseChord(symbol)
            if (!chord) return
            try {
                await this.app.fileManager.processFrontMatter(
                    file,
                    (fm: Record<string, unknown>) => {
                        const put = (name: string, value: string) => {
                            if (type.fields.has(name)) fm[name] = value
                        }
                        put(fields.chordSymbol, chord.symbol)
                        put(fields.chordRoot, chord.root)
                        put(fields.chordQuality, chord.quality)
                        fm['aliases'] = withAlias(fm['aliases'], chord.symbol)
                    }
                )
                new Notice(`This chord is ${chord.name} (${chord.symbol}).`)
            } catch (error: unknown) {
                new Notice(
                    `Couldn't name the chord: ${error instanceof Error ? error.message : String(error)}`
                )
            }
        }
        if (detected.readings.length === 1) void apply(detected.symbol)
        else new ChooseChordModal(this.app, detected.readings, (s) => void apply(s)).open()
    }

    /**
     * What an empty notation block in a note draws from: a chord or scale note's properties (with
     * the configured names) and its instrument. Null for other notes.
     */
    private noteContext(path: string): NoteContext | null {
        const file = this.app.vault.getFileByPath(path)
        const frontmatter = file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null
        if (!frontmatter) return null
        const type = learningTypeOf(this.noteModel.get().learningTypes, frontmatter)
        if (!type || (type.kind !== 'chord' && type.kind !== 'scale')) return null
        const instrument =
            type.subject === 'piano' || type.subject === 'guitar' ? type.subject : null
        return {
            properties: frontmatter,
            propertyNames: propertyNamesOf(this.effective().fields),
            ...(instrument ? { instrument } : {})
        }
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
            }),
            (record) =>
                void this.updateSettings((draft) => {
                    draft.lastLog = record
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
            },
            undoLastLog: () => this.undoLastLog()
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
            () => layoutDefaults(this.settings.notationLayout),
            undefined,
            undefined,
            (path) => this.noteContext(path)
        )
        // Empty blocks in chord and scale notes draw from the note's properties: redraw them when
        // the properties change.
        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => this.notation?.redrawNote(file.path))
        )
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) =>
                this.notation?.renamed(oldPath, file.path)
            )
        )
        this.app.workspace.onLayoutReady(() => this.notation.sync())

        // Practice timer: persisted start, elapsed time in the status bar, stop opens Log practice.
        // Metronome: plays on while its modal is closed; the status bar shows it and stops it.
        this.metronome = new Metronome(window, () => this.settings.metronome)
        this.metronomeEl = this.addStatusBarItem()
        this.metronomeEl.addClass('mp-timer', 'mod-clickable')
        this.metronomeEl.setAttr('aria-label', 'Open the metronome')
        this.metronomeEl.addEventListener('click', () => this.openMetronome())
        this.register(
            this.metronome.subscribe(() => {
                const s = this.metronome.state
                this.metronomeEl?.toggleClass('mp-is-hidden', !s.running)
                this.metronomeEl?.setText(`♩ ${s.bpm}`)
            })
        )
        this.metronomeEl.addClass('mp-is-hidden')

        this.timerEl = this.addStatusBarItem()
        this.timerEl.addClass('mp-timer', 'mod-clickable')
        this.timerEl.setAttr('aria-label', 'Stop the practice timer and log the session')
        this.timerEl.addEventListener('click', () => this.stopTimer())
        this.registerInterval(window.setInterval(() => this.renderTimer(), 1000))
        this.renderTimer()

        // Add a settings screen for the plugin
        this.addSettingTab(new MusicPracticeSettingTab(this.app, this))
    }

    override onunload() {
        this.metronome?.destroy()
    }

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
                    (language) => this.notation?.status(language) === 'on',
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
            id: 'undo-last-log',
            name: 'Undo last practice log',
            checkCallback: (checking) => {
                if (!this.settings.lastLog) return false
                if (!checking) void this.undoLastLog()
                return true
            }
        })
        this.addCommand({
            id: 'identify-chord',
            name: 'Identify this chord',
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile()
                const frontmatter = file
                    ? this.app.metadataCache.getFileCache(file)?.frontmatter
                    : null
                const type = frontmatter
                    ? learningTypeOf(this.noteModel.get().learningTypes, frontmatter)
                    : null
                if (!file || !frontmatter || type?.kind !== 'chord') return false
                if (!checking) this.identifyChord(file, type, frontmatter)
                return true
            }
        })
        this.addCommand({
            id: 'start-metronome',
            name: 'Start metronome',
            callback: () => {
                this.openMetronome()
                try {
                    this.metronome.start()
                } catch (error: unknown) {
                    new Notice(error instanceof Error ? error.message : String(error))
                }
            }
        })
        this.addCommand({
            id: 'stop-metronome',
            name: 'Stop metronome',
            checkCallback: (checking) => {
                if (!this.metronome.state.running) return false
                if (!checking) this.metronome.stop()
                return true
            }
        })
        this.addCommand({
            id: 'speed-trainer',
            name: 'Speed trainer for the current note',
            checkCallback: (checking) => {
                const active = this.activeLearningNote()
                if (!active) return false
                if (!checking) {
                    this.metronome.stop()
                    this.metronome.setItem(this.metronomeItemOf(active.file))
                    this.metronome.setTrainer(true)
                    this.openMetronome()
                }
                return true
            }
        })
        this.addCommand({
            id: 'save-metronome-bpm',
            name: 'Save metronome BPM to its note',
            checkCallback: (checking) => {
                if (!this.metronome.state.item) return false
                if (!checking) this.saveMetronomeBpm()
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
    /** The metronome's item for a learning note. */
    private metronomeItemOf(file: TFile): MetronomeItem | null {
        const item = this.itemOf(file)
        return item
            ? {
                  path: item.path,
                  name: item.name,
                  bpmCurrent: item.bpmCurrent,
                  bpmTarget: item.bpmTarget
              }
            : null
    }

    /** What the metronome views need from the plugin. */
    metronomeDeps(): MetronomeViewDeps {
        return {
            settings: () => this.settings.metronome,
            saveSettings: (change) =>
                this.updateSettings((draft) => {
                    Object.assign(draft.metronome, change)
                }),
            saveBpm: () => this.saveMetronomeBpm()
        }
    }

    /** Open the metronome (the practice note becomes its item when none is set). */
    openMetronome(): void {
        const active = this.activeLearningNote()
        if (active && !this.metronome.state.item)
            this.metronome.setItem(this.metronomeItemOf(active.file))
        new MetronomeModal(this.app, this.metronome, this.metronomeDeps()).open()
    }

    /** Save the metronome's tempo to its item, through Set BPM (which offers "at tempo"). */
    saveMetronomeBpm(): void {
        const target = this.metronome.state.item
        const item = target ? this.items.items().find((i) => i.path === target.path) : null
        if (!item) {
            new Notice('The metronome has no note to save the BPM to.')
            return
        }
        new BpmModal(
            this.app,
            item,
            this.settings.rules.levels.tempo,
            async (bpm) => {
                await this.practiceLog.setBpmAndLevel(
                    item,
                    bpm,
                    bpm.atTempo ? this.settings.rules.levels.tempo : undefined
                )
                this.metronome.setItem({
                    ...target!,
                    bpmCurrent: bpm.current ?? target!.bpmCurrent,
                    bpmTarget: bpm.target ?? target!.bpmTarget
                })
            },
            this.metronome.state.bpm
        ).open()
    }

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

    /** A notice with an Undo button for the log just written. */
    private noticeWithUndo(message: string): void {
        const fragment = createFragment((f) => {
            f.createSpan({ text: `${message} ` })
            const button = f.createEl('button', { text: 'Undo', cls: 'mp-notice-undo' })
            button.addEventListener('click', () => {
                notice.hide()
                void this.undoLastLog()
            })
        })
        const notice = new Notice(fragment, 10_000)
    }

    /** Undo the last practice log, when nothing it wrote changed since. */
    async undoLastLog(): Promise<UndoResult> {
        const record = this.settings.lastLog
        if (!record) {
            new Notice('There is no practice log to undo.')
            return { ok: false, reason: 'There is no practice log to undo.' }
        }
        const result = await this.practiceLog.undo(record)
        if (!result.ok) {
            new Notice(result.reason)
            return result
        }
        await this.updateSettings((draft) => {
            draft.lastLog = null
        })
        new Notice(
            result.keptKapEntry
                ? 'Practice log undone. The Kanban Action Planner timer kept its time entry on the activity.'
                : 'Practice log undone: the notes are back as they were and the session note is in the trash.'
        )
        return result
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
                    this.noticeWithUndo(`Practice logged: ${result.items.length} item(s).`)
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
            // Property names change what empty blocks draw from, like the layout changes how.
            const layoutChanged =
                next.notationLayout !== this.settings.notationLayout ||
                next.fields !== this.settings.fields
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
