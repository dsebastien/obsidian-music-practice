import { Notice, Platform, Plugin, debounce } from 'obsidian'
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
import { clockTime, formatElapsed, timerElapsed, timerMinutes } from './domain/timer'
import type { TimerState } from './domain/timer'
import { NotationBlocks } from './services/notation.service'
import type { NoteContext } from './services/notation.service'
import type { UndoResult } from './services/practice-log.service'
import type { UndoRecord } from './domain/undo'
import { Metronome } from './services/metronome.service'
import type { MetronomeItem } from './services/metronome.service'
import { MetronomeModal } from './ui/metronome-view'
import type { MetronomeViewDeps } from './ui/metronome-view'
import { PRACTICE_PANEL_VIEW, PracticePanelView } from './ui/practice-panel-view'
import { DrillModal } from './ui/drill-modal'
import { DrillService } from './services/drill.service'
import { VoicingNotesService } from './services/voicing-notes.service'
import { VoicingsModal } from './ui/voicings-modal'
import { fretsOfProperty } from './domain/voicings'
import type { DrillPair } from './domain/drill'
import { blockFromProperties } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'
import type { PracticePanelDeps } from './ui/practice-panel-view'
import { toLog, withPaths } from './domain/panel'
import type { PanelItem } from './domain/panel'
import { learningTypeOf } from './domain/item-reader'
import { propertyNamesOf, chordFromNotes, formatFrets, withAlias } from './domain/notation-note'
import { ChooseChordModal } from './ui/choose-chord-modal'
import { parseChord, readChord } from '@dsebastien/music-notation'
import type { GeneratedVoicing } from '@dsebastien/music-notation'
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
    private drills!: DrillService
    private voicingNotes!: VoicingNotesService
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
                this.updateSettings((draft) => {
                    draft.lastLog = record
                })
        )
        this.noteCreator = new NoteCreatorService(this.app, this.items, () => this.effective())
        this.voicingNotes = new VoicingNotesService(
            this.app,
            this.noteCreator,
            () => this.effective().fields,
            (type) =>
                this.items
                    .inputs()
                    .filter((i) => i.typeId === type.id)
                    .map((i) => i.path)
        )
        this.drills = new DrillService(
            this.app,
            () => this.ensureModel(),
            this.items,
            () => this.effective().fields,
            () => this.settings.rules,
            (type, spec) => this.noteCreator.create(type, spec)
        )
        this.api = createApi({
            model: () => this.noteModel.refresh(),
            rules: () => this.settings.rules,
            items: this.items,
            log: this.practiceLog,
            timer: {
                get: () => this.settings.timerStartedAt || null,
                minutes: () =>
                    this.settings.timerStartedAt
                        ? Math.floor(timerElapsed(this.timerState(), Date.now()) / 60_000)
                        : 0,
                start: () => this.startTimer(),
                clear: () => this.clearTimer()
            },
            undoLastLog: () => this.undoLastLog()
        })

        // The item index follows the vault: it is rebuilt after metadata changes, renames and deletions.
        const invalidate = () => {
            this.items.invalidate()
            this.noteModel.invalidate()
            this.refreshPanels()
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
            this.app.vault.on('rename', (file, oldPath) => {
                this.notation?.renamed(oldPath, file.path)
                this.panelPathChanged(oldPath, file.path)
            })
        )
        this.registerEvent(
            this.app.vault.on('delete', (file) => this.panelPathChanged(file.path, null))
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

        // The practice panel (#37).
        this.registerView(
            PRACTICE_PANEL_VIEW,
            (leaf) => new PracticePanelView(leaf, this.panelDeps())
        )
        this.addRibbonIcon('music', 'Open practice panel', () => void this.openPanel())

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
        this.refreshPanels()
        this.renderTimer()
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
            callback: () => this.openPlan()
        })
        this.addCommand({
            id: 'open-practice-panel',
            name: 'Open practice panel',
            callback: () => void this.openPanel()
        })
        this.addCommand({
            id: 'pause-timer',
            name: 'Pause or resume practice timer',
            checkCallback: (checking) => {
                if (!this.settings.timerStartedAt) return false
                if (!checking) void this.togglePause()
                return true
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
                    () => layoutDefaults(this.settings.notationLayout),
                    (symbol, pick) => this.openVoicings({ symbol, pick })
                ).open()
            }
        })
        this.addCommand({
            id: 'voicings-of-this-chord',
            name: 'Voicings of this chord',
            checkCallback: (checking) => {
                const active = this.activeLearningNote()
                if (active?.type.kind !== 'chord' || active.type.subject !== 'guitar') return false
                if (!this.chordSymbolOf(active.file)) return false
                if (!checking) this.openVoicings({ note: active })
                return true
            }
        })
        this.addCommand({
            id: 'voicings-of-a-chord',
            name: 'Voicings of a chord',
            callback: () => this.openVoicings({})
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
            id: 'chord-change-drill',
            name: 'Chord change drill',
            callback: () => this.openDrill()
        })
        this.addCommand({
            id: 'chord-change-drill-current',
            name: 'Chord change drill for the current note',
            checkCallback: (checking) => {
                const active = this.activeLearningNote()
                if (!active) return false
                const pair = this.drills.pairOfNote(active.file.path)
                const isChord = active.type.kind === 'chord' && active.type.subject === 'guitar'
                if (!pair && !isChord) return false
                if (!checking) this.openDrill(pair, pair ? undefined : active.file.path)
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
    /** Plan a practice session (from the command and the panel). */
    private openPlan(): void {
        const model = this.ensureModel()
        new PracticePlanModal(
            this.app,
            model,
            this.items.items(),
            this.settings.rules,
            this.settings.defaultPlanMinutes,
            (minutes, paths) => this.openLogPractice({ minutes, paths }),
            (paths) => void this.usePlanInPanel(paths)
        ).open()
    }

    /** Open (or reveal) the practice panel: the right sidebar, or a tab on mobile. */
    async openPanel(): Promise<PracticePanelView | null> {
        const { workspace } = this.app
        let leaf = workspace.getLeavesOfType(PRACTICE_PANEL_VIEW)[0] ?? null
        if (!leaf) {
            leaf = Platform.isMobile ? workspace.getLeaf('tab') : workspace.getRightLeaf(false)
            if (!leaf) return null
            await leaf.setViewState({ type: PRACTICE_PANEL_VIEW, active: true })
        }
        await workspace.revealLeaf(leaf)
        return leaf.view instanceof PracticePanelView ? leaf.view : null
    }

    /** Redraw open panels, at most twice a second (metadata changes come in bursts). */
    private readonly refreshPanels = debounce(
        () => {
            for (const leaf of this.app.workspace.getLeavesOfType(PRACTICE_PANEL_VIEW)) {
                if (leaf.view instanceof PracticePanelView) leaf.view.refresh()
            }
        },
        500,
        true
    )

    /** Change the panel's list from its latest state (quick clicks never lose one another). */
    private setPanelItems(change: (items: PanelItem[]) => PanelItem[]): Promise<void> {
        return this.updateSettings((draft) => {
            draft.panelItems = change(draft.panelItems)
        })
    }

    /** A listed note was renamed (follow it) or deleted (drop it). */
    private panelPathChanged(oldPath: string, newPath: string | null): void {
        if (!this.settings.panelItems.some((i) => i.path === oldPath)) return
        void this.setPanelItems((items) =>
            newPath === null
                ? items.filter((i) => i.path !== oldPath)
                : items.map((i) => (i.path === oldPath ? { ...i, path: newPath } : i))
        )
    }

    /** A practice plan's items join the panel's session list, which opens. */
    private async usePlanInPanel(paths: string[]): Promise<void> {
        await this.setPanelItems((items) => withPaths(items, paths))
        await this.openPanel()
    }

    /** Log this session from the panel; the logged items leave the list. */
    private logPanelSession(): void {
        const { paths, bpms } = toLog(this.settings.panelItems)
        const onLogged = () =>
            void this.setPanelItems((items) => items.filter((i) => !paths.includes(i.path)))
        if (this.settings.timerStartedAt) this.stopTimer({ paths, bpms, onLogged })
        else this.openLogPractice({ paths, bpms, onLogged })
    }

    private panelDeps(): PracticePanelDeps {
        return {
            model: () => this.noteModel.get(),
            items: () => this.items.items(),
            list: () => this.settings.panelItems,
            setList: (change) => this.setPanelItems(change),
            timer: () => this.timerState(),
            startTimer: () => this.startTimer(),
            togglePause: () => this.togglePause(),
            logSession: () => this.logPanelSession(),
            planIntoPanel: () => this.openPlan(),
            drill: () => this.openDrill(),
            metronome: this.metronome,
            metronomeDeps: () => this.metronomeDeps()
        }
    }

    /** A chord change drill: from the pair picker, or on a given pair (#40). */
    openDrill(pair: DrillPair | null = null, withChord?: string): void {
        if (!this.drills.exerciseType()) {
            new Notice(
                'Chord change drills need a guitar exercise note type to keep their results.'
            )
            return
        }
        const fields = this.effective().fields
        new DrillModal(
            this.app,
            {
                suggestions: () => this.drills.suggestions(withChord),
                chords: () => this.drills.chords(),
                nameOf: (path) => this.drills.nameOf(path),
                chordSource: (path) => {
                    const file = this.app.vault.getFileByPath(path)
                    const fm = file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null
                    return fm
                        ? blockFromProperties('chord', fm, {
                              names: propertyNamesOf(fields),
                              instrument: 'guitar'
                          })
                        : null
                },
                renderOptions: () => ({
                    ...layoutDefaults(this.settings.notationLayout),
                    voicings: lookupGuitarVoicing
                }),
                seconds: () => this.settings.drillSeconds,
                save: (p, count) => this.drills.save(p, count),
                log: (path, minutes, note) => this.openLogPractice({ minutes, paths: [path], note })
            },
            pair
        ).open()
    }

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
        // The panel shows the metronome when it's open; a modal otherwise.
        const panel = this.app.workspace.getLeavesOfType(PRACTICE_PANEL_VIEW)[0]
        if (panel) void this.app.workspace.revealLeaf(panel)
        else new MetronomeModal(this.app, this.metronome, this.metronomeDeps()).open()
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

    /** The chord symbol a note stores, read as the blocks read it (words too). */
    private chordSymbolOf(file: TFile): string | null {
        const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.[
            this.effective().fields.chordSymbol
        ] as unknown
        const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
        return text.trim() ? (readChord(text.trim())?.symbol ?? null) : null
    }

    /**
     * Every way to play a chord (#54): from a chord note (switch it to another voicing, or add one
     * as its own note), from Add a learning note (pick one), or for any chord typed.
     */
    openVoicings(target: {
        note?: { file: TFile; type: LearningType }
        symbol?: string
        pick?: (voicing: GeneratedVoicing) => void
    }): void {
        const note = target.note
        const symbol = target.symbol ?? (note ? this.chordSymbolOf(note.file) : null)
        const frontmatter = note
            ? this.app.metadataCache.getFileCache(note.file)?.frontmatter
            : undefined
        const current = fretsOfProperty(frontmatter?.[this.effective().fields.frets])
        // New notes go to the note's own type, else the first guitar chord type.
        const type =
            note?.type ??
            this.ensureModel().learningTypes.find(
                (t) => t.kind === 'chord' && t.subject === 'guitar'
            ) ??
            null
        const fail = (what: string, error: unknown): never => {
            new Notice(`${what}: ${error instanceof Error ? error.message : String(error)}`)
            throw error
        }
        // Only types whose notes hold frets can take a voicing.
        const holds = type !== null && this.voicingNotes.holdsVoicings(type)
        new VoicingsModal(this.app, {
            symbol,
            current,
            renderOptions: () => layoutDefaults(this.settings.notationLayout),
            ...(target.pick ? { pick: (voicing) => target.pick!(voicing) } : {}),
            ...(type && holds && !target.pick
                ? {
                      add: async (voicing, chord) => {
                          try {
                              const added = await this.voicingNotes.add(
                                  type,
                                  voicing,
                                  chord,
                                  this.notation?.status('chord') === 'on'
                              )
                              new Notice(
                                  added.existed
                                      ? `${added.file.basename} already plays this voicing.`
                                      : `Added ${added.file.basename}.`
                              )
                              await this.app.workspace.getLeaf(false).openFile(added.file)
                          } catch (error: unknown) {
                              fail("Couldn't add the note", error)
                          }
                      }
                  }
                : {}),
            ...(note && holds && !target.pick
                ? {
                      use: async (voicing) => {
                          try {
                              await this.voicingNotes.use(note.file, note.type, voicing)
                          } catch (error: unknown) {
                              fail("Couldn't change the voicing", error)
                          }
                          new Notice(
                              `${note.file.basename} now plays ${formatFrets(voicing.frets)}.`
                          )
                      },
                      cantUse: (voicing, chord) =>
                          this.voicingNotes.cantUse(note.file, note.type, voicing, chord)
                  }
                : {})
        }).open()
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
            draft.timerPausedAt = 0
            draft.timerPausedMs = 0
        })
        this.renderTimer()
        new Notice('Practice timer started.')
    }

    /** The timer as stored. */
    timerState(): TimerState {
        return {
            startedAt: this.settings.timerStartedAt,
            pausedAt: this.settings.timerPausedAt,
            pausedMs: this.settings.timerPausedMs
        }
    }

    /** Pause a running timer, or resume a paused one; paused time isn't practice (#52). */
    async togglePause(): Promise<void> {
        if (!this.settings.timerStartedAt) return
        const now = Date.now()
        await this.updateSettings((draft) => {
            if (draft.timerPausedAt) {
                draft.timerPausedMs += now - draft.timerPausedAt
                draft.timerPausedAt = 0
            } else draft.timerPausedAt = now
        })
        this.renderTimer()
    }

    /** Open Log practice with the timer's minutes, date and start; the timer clears once logged. */
    stopTimer(preset: Pick<LogPracticePreset, 'paths' | 'bpms' | 'onLogged'> = {}): void {
        const timer = this.timerState()
        if (!timer.startedAt) return
        const elapsed = timerElapsed(timer, Date.now())
        if (elapsed > LONG_TIMER_MS)
            new Notice(
                `The practice timer ran ${formatElapsed(elapsed)}: check the minutes before logging.`
            )
        this.openLogPractice({
            ...preset,
            minutes: Math.min(timerMinutes(timer, Date.now()), 1440),
            date: isoDate(new Date(timer.startedAt)),
            startTime: clockTime(timer.startedAt),
            onLogged: () => {
                void this.clearTimer()
                preset.onLogged?.()
            }
        })
    }

    /** A notice with an Undo button for the log just written. */
    private noticeWithUndo(message: string, record: UndoRecord): void {
        const fragment = createFragment((f) => {
            f.createSpan({ text: `${message} ` })
            const button = f.createEl('button', { text: 'Undo', cls: 'mp-notice-undo' })
            button.addEventListener('click', () => {
                notice.hide()
                void this.undoLastLog(record)
            })
        })
        const notice = new Notice(fragment, 10_000)
    }

    /** Undo the last practice log, when nothing it wrote changed since. */
    async undoLastLog(expected?: UndoRecord): Promise<UndoResult> {
        const record = this.settings.lastLog
        // A notice's Undo undoes its own log only, never a later one.
        if (!record || (expected && expected.at !== record.at)) {
            const reason = record
                ? 'Another log was written since: use Undo last practice log for that one.'
                : 'There is no practice log to undo.'
            new Notice(reason)
            return { ok: false, reason }
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
            draft.timerPausedAt = 0
            draft.timerPausedMs = 0
        })
        this.renderTimer()
    }

    private renderTimer(): void {
        const el = this.timerEl
        if (!el) return
        const timer = this.timerState()
        el.toggleClass('mp-is-hidden', !timer.startedAt)
        if (timer.startedAt)
            el.setText(
                `${timer.pausedAt ? '⏸' : '♪'} ${formatElapsed(timerElapsed(timer, Date.now()))}`
            )
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
                    this.noticeWithUndo(
                        `Practice logged: ${result.items.length} item(s).`,
                        result.undo
                    )
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
            this.refreshPanels()
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
