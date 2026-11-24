import { Modal, Notice, Platform, PluginSettingTab } from 'obsidian'
import type { App, Setting, SettingDefinition, SettingDefinitionItem } from 'obsidian'
import type MusicPracticePlugin from '../../main'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { BUY_ME_A_COFFEE_URL, renderSupportSection } from '../ui/support-links'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import { parseSetting, readSetting, validateSetting, writeSetting } from './setting-paths'
import { BLOCK_LANGUAGES } from '../services/notation.service'
import type { BlockLanguage } from '../services/notation.service'
import { ROOT_MARK_LABELS } from '../domain/notation-layout'
import { NAMING_LABELS } from '../domain/note-names'
import { SOUND_PACK, megabytes, packBytes, packRowOf, percentOf } from '../domain/sound-pack'
import { PackError } from '../services/sound-pack.service'
import { interpolate, messageIn, currentLanguage, t, tn } from '../i18n/i18n'
import type { MessageKey, MessageParams } from '../i18n/i18n'

/** The text of a key built from an id (the id types make a missing key a compile error). */
const say = (key: MessageKey): string => messageIn(currentLanguage(), key) ?? key

type IdOf<Suffix extends string> = MessageKey extends infer K
    ? K extends `settings.${Suffix}`
        ? K
        : never
    : never

/** Ids of the rows that have a name and a description. */
type ItemId = IdOf<`item.${string}.name`> extends `settings.item.${infer I}.name` ? I : never

/** Ids of the rows that have a name only. */
type LabelId = IdOf<`label.${string}`> extends `settings.label.${infer I}` ? I : never

/** The text row of each notation block language, in the order the settings list them. */
const TOGGLE_IDS: Record<
    BlockLanguage,
    | 'toggleChord'
    | 'toggleChords'
    | 'toggleKeyboard'
    | 'toggleFretboard'
    | 'toggleTab'
    | 'toggleScore'
    | 'toggleStrum'
    | 'togglePicking'
    | 'toggleProgression'
    | 'toggleCircle'
> = {
    chord: 'toggleChord',
    chords: 'toggleChords',
    keyboard: 'toggleKeyboard',
    fretboard: 'toggleFretboard',
    tab: 'toggleTab',
    score: 'toggleScore',
    strum: 'toggleStrum',
    picking: 'togglePicking',
    progression: 'toggleProgression',
    circle: 'toggleCircle'
}

const RUBRIC_HEADINGS = {
    chord: 'settings.group.rubricChord',
    piece: 'settings.group.rubricPiece',
    pattern: 'settings.group.rubricPattern'
} as const

/**
 * Settings tab, declared rather than rendered (Obsidian 1.13+).
 *
 * `getSettingDefinitions()` REPLACES `display()`: when it returns a non-empty
 * array, `display()` is never called. Rules that each cost a shipped bug the
 * first time they were broken (see AGENTS.md "Declarative settings"):
 *
 * - A `render:` hook renders the ROW. Write into `setting.settingEl` only.
 * - `update()` re-runs a render hook on the SAME row; a hook that appends
 *   anywhere else in the row must return a cleanup.
 * - Anything read from outside the settings (another plugin's state) belongs
 *   in a render hook, which each opening re-runs.
 * - Numeric controls declare no `defaultValue`; `validate` refuses bad input.
 * - `setControlValue` MUST reject on failure.
 *
 * Every control is keyed by its path in the settings ("rules.review.firstInterval");
 * `setting-paths.ts` reads, parses and validates them, cross-field checks included.
 */
export class MusicPracticeSettingTab extends PluginSettingTab {
    plugin: MusicPracticePlugin

    constructor(app: App, plugin: MusicPracticePlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    private validate = (key: string) => (value: unknown) =>
        validateSetting(this.plugin.settings, key, value)

    private num(key: string, id: ItemId): SettingDefinition {
        return {
            name: say(`settings.item.${id}.name`),
            desc: say(`settings.item.${id}.desc`),
            control: { type: 'number', key, validate: this.validate(key) }
        }
    }

    /** A notation block toggle, keyed `notation.<language>`. */
    private notationToggle(language: BlockLanguage): SettingDefinition {
        const id = TOGGLE_IDS[language]
        return {
            name: say(`settings.item.${id}.name`),
            desc: t('settings.toggleDesc', { desc: say(`settings.item.${id}.desc`), language }),
            control: { type: 'toggle', key: `notation.${language}` }
        }
    }

    /** A default orientation dropdown, keyed `notationLayout.<language>`. */
    private orientation(
        language: 'chord' | 'fretboard' | 'keyboard',
        id: 'chordOrientation' | 'fretboardOrientation' | 'keyboardOrientation'
    ): SettingDefinition {
        return {
            name: say(`settings.item.${id}.name`),
            desc: t('settings.orientationDesc', { desc: say(`settings.item.${id}.desc`) }),
            control: {
                type: 'dropdown',
                key: `notationLayout.${language}`,
                options: {
                    vertical: t('settings.option.vertical'),
                    horizontal: t('settings.option.horizontal')
                }
            }
        }
    }

    private text(key: string, id: ItemId, params?: MessageParams): SettingDefinition {
        return {
            name: say(`settings.item.${id}.name`),
            desc: params
                ? interpolate(say(`settings.item.${id}.desc`), params)
                : say(`settings.item.${id}.desc`),
            control: { type: 'text', key, validate: this.validate(key) }
        }
    }

    /** A text row with a name and no description. */
    private labelled(key: string, id: LabelId): SettingDefinition {
        return {
            name: say(`settings.label.${id}`),
            desc: '',
            control: { type: 'text', key, validate: this.validate(key) }
        }
    }

    /** A toggle row. */
    private toggle(key: string, id: ItemId): SettingDefinition {
        return {
            name: say(`settings.item.${id}.name`),
            desc: say(`settings.item.${id}.desc`),
            control: { type: 'toggle', key }
        }
    }

    /** A page of the settings (a sub-screen with its own rows). */
    private pageTexts(id: 'rules' | 'rubric' | 'fields' | 'local' | 'types') {
        return {
            name: say(`settings.page.${id}.name`),
            desc: say(`settings.page.${id}.desc`)
        }
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: t('settings.label.noteTypes'),
                searchable: false,
                // Read at each opening: the Starter Kit can be enabled or disabled meanwhile.
                render: (setting): void => {
                    const { source, model } = this.plugin.describeModel()
                    const counts = t('settings.noteTypes.counts', {
                        learning: tn(
                            'settings.noteTypes.learning',
                            model?.learningTypes.length ?? 0
                        ),
                        sessions: tn('settings.noteTypes.session', model?.sessionTypes.length ?? 0)
                    })
                    setting.setDesc(
                        t(
                            source === 'starter-kit'
                                ? 'settings.noteTypes.starterKit'
                                : 'settings.noteTypes.standalone',
                            { counts }
                        )
                    )
                }
            },
            this.num('defaultPlanMinutes', 'planMinutes'),
            this.text('notesHeading', 'notesHeading'),
            {
                name: t('settings.item.activityName.name'),
                desc: t('settings.item.activityName.desc', { token: '{subject}' }),
                control: {
                    type: 'text',
                    key: 'activityName',
                    validate: this.validate('activityName')
                }
            },
            {
                type: 'group',
                heading: t('settings.group.notation'),
                items: [
                    ...(Object.keys(TOGGLE_IDS) as BlockLanguage[]).map((l) =>
                        this.notationToggle(l)
                    ),
                    this.toggle('notationLayout.leftHanded', 'leftHanded'),
                    this.orientation('chord', 'chordOrientation'),
                    this.orientation('fretboard', 'fretboardOrientation'),
                    this.orientation('keyboard', 'keyboardOrientation'),
                    {
                        name: t('settings.item.naming.name'),
                        desc: t('settings.item.naming.desc'),
                        control: {
                            type: 'dropdown',
                            key: 'notationLayout.naming',
                            options: { ...NAMING_LABELS }
                        }
                    },
                    {
                        name: t('settings.item.rootMark.name'),
                        desc: t('settings.item.rootMark.desc'),
                        control: {
                            type: 'dropdown',
                            key: 'notationLayout.rootMark',
                            options: { ...ROOT_MARK_LABELS }
                        }
                    },
                    this.text('diagramImages.folder', 'imageFolder'),
                    this.toggle('diagramImages.embed', 'imageEmbed'),
                    {
                        name: t('settings.label.status'),
                        desc: '',
                        searchable: false,
                        // Read at each opening: registrations change when the plugin reloads.
                        render: (setting): void => {
                            const taken = BLOCK_LANGUAGES.filter(
                                (l) => this.plugin.notationStatus(l) === 'taken'
                            )
                            setting.setDesc(
                                taken.length
                                    ? t('settings.status.taken', {
                                          blocks: taken.map((l) => `\`\`\`${l}`).join(', ')
                                      })
                                    : t('settings.status.off')
                            )
                        }
                    }
                ]
            },
            {
                type: 'group',
                heading: t('settings.group.playback'),
                items: [
                    this.toggle('playback.enabled', 'playEnabled'),
                    {
                        name: t('settings.item.playEngine.name'),
                        desc: t('settings.item.playEngine.desc'),
                        control: {
                            type: 'dropdown',
                            key: 'playback.engine',
                            options: {
                                generaluser: t('settings.option.generaluser'),
                                soundfont: t('settings.option.soundfont'),
                                light: t('settings.option.light')
                            }
                        }
                    },
                    {
                        name: t('settings.item.playGuitar.name'),
                        desc: t('settings.item.playGuitar.desc', {
                            property: this.plugin.settings.fields.guitarSound
                        }),
                        control: {
                            type: 'dropdown',
                            key: 'playback.guitar',
                            options: {
                                steel: t('settings.option.guitarSteel'),
                                nylon: t('settings.option.guitarNylon'),
                                clean: t('settings.option.guitarClean'),
                                overdrive: t('settings.option.guitarOverdrive')
                            }
                        }
                    },
                    {
                        name: t('settings.item.soundPack.name'),
                        desc: '',
                        // The pack's state is on this device, not in the settings: read at each
                        // opening, and while a download runs.
                        render: (setting): (() => void) => this.renderSoundPack(setting)
                    },
                    this.num('playback.volume', 'playVolume'),
                    this.num('playback.roomLevel', 'playRoomLevel'),
                    this.num('playback.roomLength', 'playRoomLength'),
                    this.toggle('playback.ampCabinet', 'playAmpCabinet'),
                    this.num('playback.ampDrive', 'playAmpDrive'),
                    this.num('playback.bpm', 'playBpm'),
                    this.num('playback.strum', 'playStrum'),
                    {
                        name: t('settings.item.tempoUnit.name'),
                        desc: t('settings.item.tempoUnit.desc'),
                        control: {
                            type: 'dropdown',
                            key: 'playback.tempoUnit',
                            options: {
                                bpm: t('settings.option.bpm'),
                                percent: t('settings.option.percent')
                            }
                        }
                    }
                ]
            },
            {
                type: 'group',
                heading: t('settings.group.metronome'),
                items: [
                    this.num('metronome.beatsPerBar', 'beatsPerBar'),
                    {
                        name: t('settings.item.clicks.name'),
                        desc: t('settings.item.clicks.desc'),
                        control: {
                            type: 'dropdown',
                            key: 'metronome.subdivision',
                            options: {
                                '1': t('settings.option.quarter'),
                                '2': t('settings.option.eighth'),
                                '3': t('settings.option.triplet'),
                                '4': t('settings.option.sixteenth')
                            }
                        }
                    },
                    this.num('metronome.volume', 'metronomeVolume'),
                    this.num('metronome.trainerStep', 'trainerStep'),
                    this.num('metronome.trainerBars', 'trainerBars'),
                    this.num('metronome.countInBars', 'countIn'),
                    this.toggle('metronome.flash', 'flash'),
                    this.num('drillSeconds', 'drillSeconds'),
                    this.num('drills.questions', 'drillQuestions'),
                    this.num('drills.weakShare', 'weakShare'),
                    this.num('drills.clearStreak', 'clearStreak'),
                    this.num('drills.fastSeconds', 'fastSeconds'),
                    this.num('drills.earFastSeconds', 'earFastSeconds'),
                    this.toggle('drills.guided', 'guided')
                ]
            },
            {
                type: 'group',
                heading: t('settings.group.playAlong'),
                items: [
                    this.toggle('playAlong.enabled', 'playAlong'),
                    this.num('playAlong.preRoll', 'preRoll'),
                    {
                        name: t('settings.label.status'),
                        desc: '',
                        searchable: false,
                        // Read at each opening: registrations change when the plugin reloads.
                        render: (setting): void => {
                            setting.setDesc(
                                this.plugin.playAlongStatus() === 'taken'
                                    ? t('settings.playAlongStatus.taken')
                                    : t('settings.playAlongStatus.off')
                            )
                        }
                    }
                ]
            },
            {
                type: 'page',
                ...this.pageTexts('rules'),
                items: [
                    {
                        type: 'group',
                        heading: t('settings.group.masteryLevels'),
                        items: [
                            this.num('rules.levels.want', 'levelWant'),
                            this.num('rules.levels.learning', 'levelLearning'),
                            this.num('rules.levels.slow', 'levelSlow'),
                            this.num('rules.levels.tempo', 'levelTempo'),
                            this.num('rules.levels.rusty', 'levelRusty'),
                            this.num('rules.levels.mastered', 'levelMastered')
                        ]
                    },
                    {
                        type: 'group',
                        heading: t('settings.group.spacedReview'),
                        items: [
                            this.num('rules.review.firstInterval', 'firstInterval'),
                            this.num('rules.review.maxInterval', 'maxInterval'),
                            this.num('rules.review.goodMultiplier', 'goodMultiplier'),
                            this.num('rules.review.dueSoonMaxDays', 'dueSoonMaxDays'),
                            this.num('rules.review.dueSoonDivisor', 'dueSoonDivisor')
                        ]
                    },
                    {
                        type: 'group',
                        heading: t('settings.group.practiceScore'),
                        items: [
                            this.num('rules.score.priorityBase', 'priorityBase'),
                            this.num('rules.score.priorityUnknown', 'priorityUnknown'),
                            this.num('rules.score.priorityTbd', 'priorityTbd'),
                            this.num('rules.score.stalenessNeverPracticed', 'neverPracticed'),
                            this.num('rules.score.stalenessMaxDays', 'stalenessMaxDays'),
                            this.num('rules.score.stalenessIntervalCap', 'stalenessIntervalCap'),
                            this.num(
                                'rules.score.stalenessIntervalWeight',
                                'stalenessIntervalWeight'
                            ),
                            this.num('rules.score.bpmGapDivisor', 'bpmGapDivisor'),
                            this.num('rules.score.perUnlock', 'perUnlock'),
                            this.num('rules.score.maxUnlocks', 'maxUnlocks'),
                            this.num('rules.score.rustyBonus', 'rustyBonus')
                        ]
                    },
                    {
                        type: 'group',
                        heading: t('settings.group.practicePlan'),
                        items: [
                            this.text('rules.plan.split', 'planSplit'),
                            this.num('rules.plan.minMinutesPerItem', 'minMinutes'),
                            this.num('rules.plan.maxItemsPerBlock', 'maxItems'),
                            this.text('rules.plan.warmUpKinds', 'warmUpKinds')
                        ]
                    }
                ]
            },
            {
                type: 'page',
                ...this.pageTexts('rubric'),
                items: (['chord', 'piece', 'pattern'] as const).map((group) => ({
                    type: 'group' as const,
                    heading: t(RUBRIC_HEADINGS[group]),
                    items: [
                        this.labelled(`rubric.${group}.learning`, 'learning'),
                        this.labelled(`rubric.${group}.slow`, 'slow'),
                        this.labelled(`rubric.${group}.tempo`, 'tempo'),
                        this.labelled(`rubric.${group}.mastered`, 'mastered')
                    ]
                }))
            },
            {
                type: 'page',
                ...this.pageTexts('fields'),
                items: [
                    {
                        type: 'group',
                        heading: t('settings.group.learningNotes'),
                        items: [
                            this.labelled('fields.lastPracticed', 'lastPracticed'),
                            this.labelled('fields.bpmCurrent', 'bpmCurrent'),
                            this.labelled('fields.bpmTarget', 'bpmTarget'),
                            this.labelled('fields.priority', 'priority'),
                            this.labelled('fields.prerequisites', 'prerequisites'),
                            this.labelled('fields.theory', 'theory'),
                            this.text('fields.sources', 'fieldSources'),
                            this.text('fields.key', 'fieldKey'),
                            this.text('fields.pieceChords', 'fieldPieceChords'),
                            this.text('fields.timeSignature', 'fieldTimeSignature'),
                            this.text('fields.shape', 'fieldShape'),
                            this.labelled('fields.chordSymbol', 'chordSymbol'),
                            this.labelled('fields.chordRoot', 'chordRoot'),
                            this.labelled('fields.chordQuality', 'chordQuality'),
                            this.text('fields.frets', 'fieldFrets'),
                            this.text('fields.fingers', 'fieldFingers'),
                            this.text('fields.position', 'fieldPosition'),
                            this.text('fields.pitches', 'fieldPitches'),
                            this.text('fields.fingering', 'fieldFingering'),
                            this.text('fields.trains', 'fieldTrains'),
                            this.text('fields.changesBest', 'fieldChangesBest'),
                            this.text('fields.changesLast', 'fieldChangesLast'),
                            this.text('fields.drillKind', 'fieldDrillKind'),
                            this.text('fields.drillSetting', 'fieldDrillSetting'),
                            this.text('fields.publicNote', 'fieldPublicNote'),
                            this.text('fields.drillStats', 'fieldDrillStats'),
                            this.text('fields.exerciseKind', 'fieldExerciseKind'),
                            this.text('fields.scaleRoot', 'fieldScaleRoot'),
                            this.text('fields.scaleType', 'fieldScaleType'),
                            this.text('fields.fingeringRight', 'fieldFingeringRight'),
                            this.text('fields.strumPattern', 'fieldStrumPattern'),
                            this.text('fields.strumFeel', 'fieldStrumFeel'),
                            this.text('fields.pickingPattern', 'fieldPickingPattern'),
                            this.text('fields.guitarSound', 'fieldGuitarSound'),
                            this.labelled('fields.lastReviewed', 'lastReviewed'),
                            this.labelled('fields.reviewInterval', 'reviewInterval'),
                            this.labelled('fields.reviewCount', 'reviewCount')
                        ]
                    },
                    {
                        type: 'group',
                        heading: t('settings.group.sessionsActivities'),
                        items: [
                            this.labelled('fields.date', 'date'),
                            this.labelled('fields.startTime', 'startTime'),
                            this.text('fields.timeSpent', 'fieldTimeSpent'),
                            this.labelled('fields.quality', 'quality'),
                            this.labelled('fields.practiced', 'practiced'),
                            this.text('fields.practicedMinutes', 'fieldPracticedMinutes'),
                            this.labelled('fields.activities', 'activities'),
                            this.text('fields.sessionTypes', 'fieldSessionTypes'),
                            this.text('fields.timeEntries', 'fieldTimeEntries'),
                            this.text('fields.lastSession', 'fieldLastSession')
                        ]
                    }
                ]
            },
            {
                type: 'page',
                ...this.pageTexts('local'),
                items: [
                    this.text('local.domains', 'localDomains'),
                    this.text('local.statusProperty', 'localStatus'),
                    {
                        type: 'group',
                        heading: t('settings.group.levelNames'),
                        items: [
                            this.labelled('local.levelNames.want', 'want'),
                            this.labelled('local.levelNames.learning', 'learning'),
                            this.labelled('local.levelNames.slow', 'slow'),
                            this.labelled('local.levelNames.tempo', 'tempo'),
                            this.labelled('local.levelNames.rusty', 'rusty'),
                            this.labelled('local.levelNames.mastered', 'mastered')
                        ]
                    },
                    this.num('local.topPriority', 'localTopPriority'),
                    this.text('local.startedField', 'localStarted'),
                    this.text('local.masteredField', 'localMastered'),
                    this.text('local.sessionFolder', 'localFolder', {
                        tokens: '{year} {month} {date} {domain} {subject} {Subject}'
                    }),
                    this.text('local.sessionSuffix', 'localSuffix'),
                    this.text('local.sessionTemplate', 'localTemplate')
                ]
            },
            {
                type: 'page',
                ...this.pageTexts('types'),
                items: [
                    {
                        name: t('settings.label.types'),
                        searchable: false,
                        render: (setting): (() => void) => {
                            setting.infoEl.remove()
                            setting.settingEl.addClass('settings-stack')
                            const el = setting.settingEl.createDiv({ cls: 'mp-modal' })
                            const { model } = this.plugin.describeModel()
                            el.createDiv({
                                cls: 'mp-section-title',
                                text: t('settings.types.learning')
                            })
                            const list = el.createDiv({ cls: 'mp-list' })
                            for (const type of model?.learningTypes ?? []) {
                                const row = list.createDiv({ cls: 'mp-item' })
                                row.createDiv({ cls: 'mp-item-name', text: type.name })
                                row.createDiv({
                                    cls: 'mp-item-meta',
                                    text: `${type.typeTag} · ${type.statusProperty}: ${type.statusValues.join(', ')}`
                                })
                            }
                            el.createDiv({
                                cls: 'mp-section-title',
                                text: t('settings.types.session')
                            })
                            const sessions = el.createDiv({ cls: 'mp-list' })
                            for (const type of model?.sessionTypes ?? []) {
                                const row = sessions.createDiv({ cls: 'mp-item' })
                                row.createDiv({ cls: 'mp-item-name', text: type.name })
                                row.createDiv({ cls: 'mp-item-meta', text: type.typeTag })
                            }
                            return () => el.remove()
                        }
                    }
                ]
            },
            {
                name: t('settings.item.reset.name'),
                desc: t('settings.item.reset.desc'),
                render: (setting): void => {
                    setting.addButton((button) =>
                        button
                            .setButtonText(t('common.reset'))
                            .setDestructive()
                            .onClick(() => new ResetModal(this.app, () => this.reset()).open())
                    )
                }
            },
            {
                type: 'group',
                // No heading: renderSupportSection draws its own.
                items: [
                    {
                        name: t('settings.label.support'),
                        // Not a setting — keep it out of the settings search.
                        searchable: false,
                        render: (setting): (() => void) => {
                            // Render INSIDE the row (settingEl), never into group.listEl.
                            setting.infoEl.remove()
                            setting.settingEl.addClass('settings-stack')
                            const blockEl = setting.settingEl.createDiv()
                            renderSupportSection(blockEl, (el) => {
                                this.renderBuyMeACoffeeBadge(el)
                            })
                            return () => blockEl.remove()
                        }
                    }
                ]
            }
        ]
    }

    /**
     * The sound pack's row (#100): what the pack is and where it goes, its state on this device,
     * and Download, Cancel or Remove. A download's progress rewrites the status line only, so a
     * button never changes under a click. Returns what stops it listening to the pack.
     */
    private renderSoundPack(setting: Setting): () => void {
        const pack = this.plugin.soundPack
        const size = megabytes(packBytes())
        let statusEl: HTMLElement | null = null
        let drawn = ''
        const statusText = (): string => {
            const row = packRowOf(pack.state, pack.downloading)
            return row.status === 'downloading'
                ? t('settings.soundPack.status.downloading', {
                      percent: percentOf(pack.progress ?? { done: 0, total: 1 })
                  })
                : say(`settings.soundPack.status.${row.status}`)
        }
        const draw = (): void => {
            const row = packRowOf(pack.state, pack.downloading)
            const key = `${row.status}:${row.primary}`
            if (key === drawn && statusEl) {
                statusEl.setText(statusText())
                return
            }
            drawn = key
            setting.clear()
            setting.setDesc(
                createFragment((fragment) => {
                    fragment.createDiv({
                        text: t('settings.item.soundPack.desc', {
                            name: SOUND_PACK.name,
                            size,
                            license: SOUND_PACK.license,
                            folder: pack.folder
                        })
                    })
                    if (Platform.isMobile)
                        fragment.createDiv({ text: t('settings.soundPack.mobile', { size }) })
                    statusEl = fragment.createDiv({ cls: 'mp-sound-pack-status' })
                    statusEl.setText(statusText())
                })
            )
            if (row.cancel)
                setting.addButton((button) =>
                    button.setButtonText(t('settings.soundPack.cancel')).onClick(() => {
                        pack.cancel()
                    })
                )
            const primary = row.primary
            if (primary)
                setting.addButton((button) =>
                    button
                        .setButtonText(say(`settings.soundPack.${primary}`))
                        .setCta()
                        .onClick(() => void this.downloadSoundPack())
                )
            if (row.remove)
                setting.addButton((button) =>
                    button
                        .setButtonText(t('settings.soundPack.remove'))
                        .onClick(() => void this.removeSoundPack())
                )
        }
        draw()
        return pack.onChange(draw)
    }

    /** Download (or go on, or update), then the pack is the sound that plays. */
    private async downloadSoundPack(): Promise<void> {
        const pack = this.plugin.soundPack
        try {
            await pack.download()
        } catch (error: unknown) {
            const failure = error instanceof PackError ? error.failure : 'network'
            const file = error instanceof PackError ? (error.file ?? '') : ''
            new Notice(
                failure === 'cancelled'
                    ? t('settings.soundPack.cancelled')
                    : failure === 'storage'
                      ? t('settings.soundPack.error.storage', { folder: pack.folder })
                      : failure === 'checksum'
                        ? t('settings.soundPack.error.checksum', { file })
                        : t('settings.soundPack.error.network', { file })
            )
            return
        }
        if (this.plugin.settings.playback.engine !== 'generaluser')
            await this.plugin.updateSettings((draft) => {
                draft.playback.engine = 'generaluser'
            })
        new Notice(t('settings.soundPack.done'))
        this.update()
    }

    /** Remove the pack from this device; the built-in soundfont is the sound again. */
    private async removeSoundPack(): Promise<void> {
        const pack = this.plugin.soundPack
        try {
            await pack.remove()
        } catch {
            new Notice(t('settings.soundPack.error.storage', { folder: pack.folder }))
            return
        }
        if (this.plugin.settings.playback.engine === 'generaluser')
            await this.plugin.updateSettings((draft) => {
                draft.playback.engine = 'soundfont'
            })
        new Notice(t('settings.soundPack.removed'))
        this.update()
    }

    private async reset(): Promise<void> {
        const defaults = createDefaultSettings()
        await this.plugin.updateSettings((draft) => {
            draft.rules = defaults.rules
            draft.rubric = defaults.rubric
            draft.fields = defaults.fields
            draft.local = defaults.local
        })
        new Notice(t('settings.reset.done'))
        this.update()
    }

    /** Reads the value behind a control key (its path in the settings). */
    override getControlValue(key: string): unknown {
        return readSetting(this.plugin.settings, key)
    }

    /** Persists a control edit; rejects on invalid input so the control rolls back. */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        const parsed = parseSetting(key, value)
        const error = parsed.ok ? validateSetting(this.plugin.settings, key, value) : parsed.error
        if (error || !parsed.ok) {
            new Notice(error ?? t('settings.error.invalid'))
            throw new Error(error ?? `Setting "${key}" is invalid.`)
        }
        await this.plugin.updateSettings((draft) => writeSetting(draft, key, parsed.value))
        // The Status row reads the registrations, which a toggle can change.
        if (key.startsWith('notation.')) this.update()
    }

    renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175) {
        const linkEl = contentEl.createEl('a', {
            href: BUY_ME_A_COFFEE_URL
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src = BUY_ME_A_COFFEE_BADGE_DATA_URL
        imgEl.alt = t('settings.support.coffeeAlt')
        imgEl.width = width
    }
}

/** Confirmation before resetting the settings. */
class ResetModal extends Modal {
    constructor(
        app: App,
        private readonly onConfirm: () => Promise<void>
    ) {
        super(app)
    }

    override onOpen(): void {
        this.setTitle(t('settings.reset.title'))
        this.contentEl.createEl('p', {
            text: t('settings.reset.body')
        })
        const actions = this.contentEl.createDiv({ cls: 'mp-actions' })
        actions
            .createEl('button', { text: t('common.cancel') })
            .addEventListener('click', () => this.close())
        actions
            .createEl('button', { cls: 'mod-warning', text: t('common.reset') })
            .addEventListener('click', () => {
                void this.onConfirm().then(() => this.close())
            })
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
