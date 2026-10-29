import { Modal, Notice, PluginSettingTab } from 'obsidian'
import type { App, SettingDefinition, SettingDefinitionItem } from 'obsidian'
import type MusicPracticePlugin from '../../main'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { BUY_ME_A_COFFEE_URL, renderSupportSection } from '../ui/support-links'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import { parseSetting, readSetting, validateSetting, writeSetting } from './setting-paths'
import { LANGUAGES } from '@dsebastien/music-notation'
import { ORIENTATIONS } from '../domain/notation-layout'
import type { NotationLanguage } from '@dsebastien/music-notation'

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

    private num(key: string, name: string, desc: string): SettingDefinition {
        return { name, desc, control: { type: 'number', key, validate: this.validate(key) } }
    }

    /** A notation block toggle, keyed `notation.<language>`. */
    private notationToggle(
        language: NotationLanguage,
        name: string,
        desc: string
    ): SettingDefinition {
        return {
            name,
            desc: `${desc} Code blocks named "${language}".`,
            control: { type: 'toggle', key: `notation.${language}` }
        }
    }

    /** A default orientation dropdown, keyed `notationLayout.<language>`. */
    private orientation(
        language: 'chord' | 'fretboard' | 'keyboard',
        name: string,
        desc: string
    ): SettingDefinition {
        return {
            name,
            desc: `${desc} A block can say otherwise with "orientation:".`,
            control: {
                type: 'dropdown',
                key: `notationLayout.${language}`,
                options: Object.fromEntries(
                    ORIENTATIONS.map((o) => [o, o.charAt(0).toUpperCase() + o.slice(1)])
                )
            }
        }
    }

    private text(key: string, name: string, desc: string): SettingDefinition {
        return { name, desc, control: { type: 'text', key, validate: this.validate(key) } }
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: 'Note types',
                desc: 'Where the learning and session note types come from.',
                searchable: false,
                // Read at each opening: the Starter Kit can be enabled or disabled meanwhile.
                render: (setting): void => {
                    const { source, model } = this.plugin.describeModel()
                    const counts = `${model?.learningTypes.length ?? 0} learning types, ${model?.sessionTypes.length ?? 0} session types`
                    setting.setDesc(
                        source === 'starter-kit'
                            ? `From the Obsidian Starter Kit: ${counts}. Its note types own the statuses, folders, templates and date stamps.`
                            : `From this plugin's standalone note model (the Obsidian Starter Kit isn't available): ${counts}.`
                    )
                }
            },
            this.num(
                'defaultPlanMinutes',
                'Default practice plan length',
                'Minutes offered when you plan a practice session.'
            ),
            this.text(
                'notesHeading',
                'Session notes heading',
                'Heading of the session note section that receives the note of a log ("Notes").'
            ),
            this.text(
                'activityName',
                'Activity name',
                'Activity your sessions count towards when no earlier session links one. {subject} is the instrument: "Learn {subject}" finds "Learn Guitar".'
            ),
            {
                type: 'group',
                heading: 'Notation blocks',
                items: [
                    this.notationToggle(
                        'chord',
                        'Chord diagrams',
                        'Guitar diagrams and piano chords.'
                    ),
                    this.notationToggle(
                        'chords',
                        'Chord charts',
                        'ChordPro: chords over lyrics, transposable.'
                    ),
                    this.notationToggle(
                        'keyboard',
                        'Keyboards',
                        'Scales, chords and notes on a piano keyboard.'
                    ),
                    this.notationToggle(
                        'fretboard',
                        'Fretboards',
                        'Scales, chords and notes on a guitar neck.'
                    ),
                    {
                        name: 'Left-handed',
                        desc: 'Mirror guitar chord diagrams and fretboards (the low string on the right). A block can say otherwise with "hand: right".',
                        control: { type: 'toggle', key: 'notationLayout.leftHanded' }
                    },
                    this.orientation(
                        'chord',
                        'Chord diagram orientation',
                        'Vertical: the nut on top. Horizontal: the strings across, high string on top, as in tabs.'
                    ),
                    this.orientation(
                        'fretboard',
                        'Fretboard orientation',
                        'Horizontal: the high string on top, as in tabs. Vertical: the nut on top, as a chord diagram.'
                    ),
                    this.orientation(
                        'keyboard',
                        'Keyboard orientation',
                        'Horizontal: low notes on the left. Vertical: low notes at the bottom. Piano chords follow it.'
                    ),
                    {
                        name: 'Status',
                        desc: '',
                        searchable: false,
                        // Read at each opening: registrations change when the plugin reloads.
                        render: (setting): void => {
                            const taken = LANGUAGES.filter(
                                (l) => this.plugin.notationStatus(l) === 'taken'
                            )
                            setting.setDesc(
                                taken.length
                                    ? `Another plugin already draws ${taken.map((l) => `\`\`\`${l}`).join(', ')} blocks, so Music Practice leaves them alone. Turned-off blocks show as code; reload the plugin to let another plugin draw them.`
                                    : 'Turned-off blocks show as code; reload the plugin to let another plugin draw them.'
                            )
                        }
                    }
                ]
            },
            {
                type: 'page',
                name: 'Rules',
                desc: 'Mastery levels, spaced review, practice score and practice plans.',
                items: [
                    {
                        type: 'group',
                        heading: 'Mastery levels',
                        items: [
                            this.num('rules.levels.want', 'Want to learn', 'Wishlist level.'),
                            this.num('rules.levels.learning', 'Learning', 'First active level.'),
                            this.num(
                                'rules.levels.slow',
                                'Can play slowly',
                                'Reaching it starts spaced review.'
                            ),
                            this.num(
                                'rules.levels.tempo',
                                'Can play at tempo',
                                'Offered when the target BPM is reached.'
                            ),
                            this.num(
                                'rules.levels.rusty',
                                'Rusty',
                                'Where a failed review drops a mastered item.'
                            ),
                            this.num(
                                'rules.levels.mastered',
                                'Mastered',
                                'Done; mastered items stay in review.'
                            )
                        ]
                    },
                    {
                        type: 'group',
                        heading: 'Spaced review',
                        items: [
                            this.num(
                                'rules.review.firstInterval',
                                'First interval (days)',
                                'Set when an item reaches "Can play slowly", and after a failed review.'
                            ),
                            this.num(
                                'rules.review.maxInterval',
                                'Maximum interval (days)',
                                'Good reviews never push the interval past this.'
                            ),
                            this.num(
                                'rules.review.goodMultiplier',
                                'Good review multiplier',
                                'A good review multiplies the interval by this.'
                            ),
                            this.num(
                                'rules.review.dueSoonMaxDays',
                                'Due soon window (days)',
                                'At most this many days before the interval ends.'
                            ),
                            this.num(
                                'rules.review.dueSoonDivisor',
                                'Due soon divisor',
                                'The window is also at most the interval divided by this.'
                            )
                        ]
                    },
                    {
                        type: 'group',
                        heading: 'Practice score',
                        items: [
                            this.num(
                                'rules.score.priorityBase',
                                'Priority base',
                                'Priority points are this minus the priority number.'
                            ),
                            this.num(
                                'rules.score.priorityUnknown',
                                'Points without a priority',
                                'When the priority is TBD or missing.'
                            ),
                            this.num(
                                'rules.score.priorityTbd',
                                'TBD priority number',
                                'The priority number that means "to be defined".'
                            ),
                            this.num(
                                'rules.score.stalenessNeverPracticed',
                                'Never practiced',
                                'Staleness points of an item never practiced.'
                            ),
                            this.num(
                                'rules.score.stalenessMaxDays',
                                'Staleness cap without interval (days)',
                                'Days since practiced count up to this.'
                            ),
                            this.num(
                                'rules.score.stalenessIntervalCap',
                                'Staleness cap with interval',
                                'Days since practiced divided by the interval, capped at this.'
                            ),
                            this.num(
                                'rules.score.stalenessIntervalWeight',
                                'Staleness weight with interval',
                                'That ratio is multiplied by this.'
                            ),
                            this.num(
                                'rules.score.bpmGapDivisor',
                                'BPM gap divisor',
                                'The missing BPM percentage is divided by this.'
                            ),
                            this.num(
                                'rules.score.perUnlock',
                                'Points per unlock',
                                'For each item at "Want to learn" that links to this one.'
                            ),
                            this.num(
                                'rules.score.maxUnlocks',
                                'Unlocks counted',
                                'At most this many unlocks count.'
                            ),
                            this.num(
                                'rules.score.rustyBonus',
                                'Rusty bonus',
                                'Extra points for Rusty items.'
                            )
                        ]
                    },
                    {
                        type: 'group',
                        heading: 'Practice plan',
                        items: [
                            this.text(
                                'rules.plan.split',
                                'Blocks (%)',
                                'Warm-up, focus, review and fun, adding up to 100: "15, 50, 20, 15".'
                            ),
                            this.num(
                                'rules.plan.minMinutesPerItem',
                                'Minutes per item (minimum)',
                                'Each planned item gets at least this many minutes.'
                            ),
                            this.num(
                                'rules.plan.maxItemsPerBlock',
                                'Items per block (maximum)',
                                'Fewer items, more depth.'
                            ),
                            this.text(
                                'rules.plan.warmUpKinds',
                                'Warm-up kinds',
                                'Kinds practiced in the warm-up, comma-separated: "technique, exercise".'
                            )
                        ]
                    }
                ]
            },
            {
                type: 'page',
                name: 'Rubric',
                desc: "What each mastery level means, shown when you change an item's mastery.",
                items: (['chord', 'piece', 'pattern'] as const).map((group) => ({
                    type: 'group' as const,
                    heading:
                        group === 'chord'
                            ? 'Chords'
                            : group === 'piece'
                              ? 'Arrangements and pieces'
                              : 'Scales, techniques, exercises and other kinds',
                    items: [
                        this.text(`rubric.${group}.learning`, 'Learning', ''),
                        this.text(`rubric.${group}.slow`, 'Can play slowly', ''),
                        this.text(`rubric.${group}.tempo`, 'Can play at tempo', ''),
                        this.text(`rubric.${group}.mastered`, 'Mastered', '')
                    ]
                }))
            },
            {
                type: 'page',
                name: 'Property names',
                desc: 'Frontmatter properties the plugin reads and writes. Review and time properties follow the Kanban Action Planner when it is installed.',
                items: [
                    {
                        type: 'group',
                        heading: 'Learning notes',
                        items: [
                            this.text('fields.lastPracticed', 'Last practiced', ''),
                            this.text('fields.bpmCurrent', 'Current BPM', ''),
                            this.text('fields.bpmTarget', 'Target BPM', ''),
                            this.text('fields.priority', 'Priority', ''),
                            this.text('fields.prerequisites', 'Prerequisites', ''),
                            this.text('fields.theory', 'Theory', ''),
                            this.text(
                                'fields.shape',
                                'Shape',
                                'Chords and scales: open, barre, CAGED…'
                            ),
                            this.text('fields.chordSymbol', 'Chord symbol', ''),
                            this.text('fields.chordRoot', 'Chord root', ''),
                            this.text('fields.chordQuality', 'Chord quality', ''),
                            this.text('fields.frets', 'Frets', 'Guitar chords: "x02220".'),
                            this.text('fields.fingers', 'Fingers', 'Guitar chords: "x01230".'),
                            this.text(
                                'fields.position',
                                'Position',
                                'Guitar chords: the first fret shown.'
                            ),
                            this.text('fields.pitches', 'Pitches', 'Piano chords: "A3 C#4 E4".'),
                            this.text('fields.fingering', 'Fingering', 'Piano chords: "5 3 1".'),
                            this.text('fields.scaleRoot', 'Scale root', 'Scales: "A".'),
                            this.text(
                                'fields.scaleType',
                                'Scale type',
                                'Scales: "Minor pentatonic".'
                            ),
                            this.text(
                                'fields.fingeringRight',
                                'Scale fingering',
                                'Piano scales, right hand: "1 2 3 1 2 3 4 5".'
                            ),
                            this.text('fields.lastReviewed', 'Last reviewed', ''),
                            this.text('fields.reviewInterval', 'Review interval', ''),
                            this.text('fields.reviewCount', 'Review count', '')
                        ]
                    },
                    {
                        type: 'group',
                        heading: 'Sessions and activities',
                        items: [
                            this.text('fields.date', 'Session date', ''),
                            this.text('fields.startTime', 'Start time', ''),
                            this.text(
                                'fields.timeSpent',
                                'Minutes',
                                'On learning notes, sessions and activities.'
                            ),
                            this.text('fields.quality', 'Session quality', ''),
                            this.text('fields.practiced', 'Practiced items', ''),
                            this.text('fields.activities', 'Activities', ''),
                            this.text('fields.timeEntries', 'Time entries', 'On activities.'),
                            this.text('fields.lastSession', 'Last session date', 'On activities.')
                        ]
                    }
                ]
            },
            {
                type: 'page',
                name: 'Standalone note model',
                desc: 'Used when the Obsidian Starter Kit is not available. Learning notes are the notes tagged type/<domain>/<subject>/<kind> (for example type/music/guitar/chord) with a mastery level.',
                items: [
                    this.text(
                        'local.domains',
                        'Domains',
                        'Comma-separated: only type/<domain>/… tags of these domains mark learning notes ("music").'
                    ),
                    this.text(
                        'local.statusProperty',
                        'Mastery property',
                        'The property holding the level ("20 - Learning").'
                    ),
                    {
                        type: 'group',
                        heading: 'Level names',
                        items: [
                            this.text('local.levelNames.want', 'Want to learn', ''),
                            this.text('local.levelNames.learning', 'Learning', ''),
                            this.text('local.levelNames.slow', 'Can play slowly', ''),
                            this.text('local.levelNames.tempo', 'Can play at tempo', ''),
                            this.text('local.levelNames.rusty', 'Rusty', ''),
                            this.text('local.levelNames.mastered', 'Mastered', '')
                        ]
                    },
                    this.num(
                        'local.topPriority',
                        'Current focus priority',
                        'Items at this priority number are the current focus.'
                    ),
                    this.text(
                        'local.startedField',
                        'Started date property',
                        'Stamped on reaching Learning (empty: none).'
                    ),
                    this.text(
                        'local.masteredField',
                        'Mastered date property',
                        'Stamped on reaching Mastered (empty: none).'
                    ),
                    this.text(
                        'local.sessionFolder',
                        'Session folder',
                        'Tokens: {year} {month} {date} {domain} {subject} {Subject}.'
                    ),
                    this.text(
                        'local.sessionSuffix',
                        'Session name suffix',
                        'Appended to session note names; same tokens.'
                    ),
                    this.text(
                        'local.sessionTemplate',
                        'Session template',
                        'Optional note used as the template of new session notes (vault path).'
                    )
                ]
            },
            {
                type: 'page',
                name: 'Note types in use',
                desc: 'The learning and session types the plugin found.',
                items: [
                    {
                        name: 'Types',
                        searchable: false,
                        render: (setting): (() => void) => {
                            setting.infoEl.remove()
                            setting.settingEl.addClass('settings-stack')
                            const el = setting.settingEl.createDiv({ cls: 'mp-modal' })
                            const { model } = this.plugin.describeModel()
                            el.createDiv({ cls: 'mp-section-title', text: 'Learning types' })
                            const list = el.createDiv({ cls: 'mp-list' })
                            for (const t of model?.learningTypes ?? []) {
                                const row = list.createDiv({ cls: 'mp-item' })
                                row.createDiv({ cls: 'mp-item-name', text: t.name })
                                row.createDiv({
                                    cls: 'mp-item-meta',
                                    text: `${t.typeTag} · ${t.statusProperty}: ${t.statusValues.join(', ')}`
                                })
                            }
                            el.createDiv({ cls: 'mp-section-title', text: 'Session types' })
                            const sessions = el.createDiv({ cls: 'mp-list' })
                            for (const t of model?.sessionTypes ?? []) {
                                const row = sessions.createDiv({ cls: 'mp-item' })
                                row.createDiv({ cls: 'mp-item-name', text: t.name })
                                row.createDiv({ cls: 'mp-item-meta', text: t.typeTag })
                            }
                            return () => el.remove()
                        }
                    }
                ]
            },
            {
                name: 'Reset to defaults',
                desc: 'Restore the rules, rubric, property names and standalone note model. Asks first.',
                render: (setting): void => {
                    setting.addButton((button) =>
                        button
                            .setButtonText('Reset')
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
                        name: 'Support',
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

    private async reset(): Promise<void> {
        const defaults = createDefaultSettings()
        await this.plugin.updateSettings((draft) => {
            draft.rules = defaults.rules
            draft.rubric = defaults.rubric
            draft.fields = defaults.fields
            draft.local = defaults.local
        })
        new Notice('Music Practice settings reset to their defaults.')
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
            new Notice(error ?? 'Invalid value.')
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
        imgEl.alt = 'Buy me a coffee'
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
        this.setTitle('Reset Music Practice settings?')
        this.contentEl.createEl('p', {
            text: 'The rules, rubric, property names and standalone note model go back to their defaults. Your notes are not touched.'
        })
        const actions = this.contentEl.createDiv({ cls: 'mp-actions' })
        actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close())
        actions
            .createEl('button', { cls: 'mod-warning', text: 'Reset' })
            .addEventListener('click', () => {
                void this.onConfirm().then(() => this.close())
            })
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
