import { normalizePath } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { parseChord } from '../domain/chord'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { levelOf } from '../domain/mastery'
import { mergeTags } from '../domain/item-reader'
import { levelChange } from '../domain/log'
import type { LearningItem } from '../domain/practice'
import type { LearningType } from '../domain/note-model'
import type { PracticeRules } from '../domain/rules'
import { renderTemplate } from '../domain/template-render'
import { ensureBlock, formatFingers, formatFrets, withAlias } from '../domain/notation-note'
import type { FrettedVoicing } from '@dsebastien/music-notation'
import {
    resolveNoteTypeAffixes,
    resolveNoteTypeFolder,
    starterKitRunsAutomations
} from './starter-kit.service'

/** A learning item with no state yet: what a new note starts from. */
const EMPTY_ITEM: LearningItem = {
    path: '',
    name: '',
    kind: '',
    typeId: '',
    level: null,
    priority: null,
    topPriority: null,
    lastPracticed: null,
    lastReviewed: null,
    reviewInterval: null,
    reviewCount: null,
    bpmCurrent: null,
    bpmTarget: null,
    prerequisites: [],
    links: [],
    daysSincePracticed: null,
    daysSinceReview: null,
    review: null,
    bpmProgress: null,
    prerequisitesOpen: 0,
    missingPrerequisites: [],
    ready: false,
    unlocks: 0,
    focus: false,
    score: 0
}
import type { ItemRepository } from './item-repository'

export interface NewLearningNote {
    title: string
    /** Chord types: the symbol ("F#m7"), stored with its root, quality and as an alias. */
    chordSymbol?: string
    /** A value of the type's shape property ("Open"). */
    shape?: string
    /** Initial level; the "want to learn" level by default. */
    level?: number
    /** Guitar chords: the voicing picked from the notation library, stored as frets and fingers. */
    voicing?: FrettedVoicing
    /** Scales and other notes: more properties, by name (scale root and type). */
    properties?: Record<string, unknown>
    /** An empty notation block the note gets (```chord, ```fretboard, ```keyboard): it draws from the properties. */
    block?: string
}

/** Creates learning notes in their type's folder, name and template. */
export class NoteCreatorService {
    constructor(
        private readonly app: App,
        private readonly repo: ItemRepository,
        private readonly context: () => { rules: PracticeRules; fields: FieldNames }
    ) {}

    /**
     * The type's folder: the Obsidian Starter Kit's, else the folder most of the type's notes live
     * in, else the vault root.
     */
    private folderFor(type: LearningType): string {
        const osk = resolveNoteTypeFolder(this.app, type.id, isoDate())
        if (osk) return osk
        const counts = new Map<string, number>()
        for (const item of this.repo.inputs().filter((i) => i.typeId === type.id)) {
            const folder = item.path.includes('/')
                ? item.path.slice(0, item.path.lastIndexOf('/'))
                : ''
            counts.set(folder, (counts.get(folder) ?? 0) + 1)
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    }

    /** Where a note of this type and title goes (its folder, prefix and suffix). */
    pathFor(type: LearningType, title: string): string {
        const folder = this.folderFor(type)
        const affixes = resolveNoteTypeAffixes(this.app, type.id)
        const prefix = affixes && !affixes.prefixOptional ? affixes.prefix : ''
        const suffix = affixes && !affixes.suffixOptional ? affixes.suffix : ''
        return normalizePath(`${folder ? `${folder}/` : ''}${prefix}${title}${suffix}.md`)
    }

    /** Whether a note of this type already has this title. */
    exists(type: LearningType, title: string): boolean {
        return this.app.vault.getAbstractFileByPath(this.pathFor(type, title)) !== null
    }

    async create(type: LearningType, spec: NewLearningNote): Promise<TFile> {
        const { rules, fields } = this.context()
        const path = this.pathFor(type, spec.title)
        const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
        if (this.app.vault.getAbstractFileByPath(path))
            throw new Error(`"${spec.title}" already exists.`)
        if (folder && !this.app.vault.getAbstractFileByPath(folder))
            await this.app.vault.createFolder(folder)

        // The type's template without its scripts: the Add modal already asked what its prompts would.
        const template = type.templatePath ? this.app.vault.getFileByPath(type.templatePath) : null
        const content = template
            ? renderTemplate(await this.app.vault.read(template), spec.title)
            : `---\n---\n# ${spec.title}\n`
        const file = await this.app.vault.create(path, content)

        const chord = spec.chordSymbol ? parseChord(spec.chordSymbol) : null
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            const put = (name: string, value: unknown) => {
                if (type.fields.has(name) && value !== undefined) fm[name] = value
            }
            fm['tags'] = mergeTags(fm['tags'], type.tags)
            // The requested level (or the template's, else "want to learn"), with what comes with
            // it: the first review interval from "slow" up, and date stamps when the Obsidian
            // Starter Kit doesn't stamp them itself.
            const level = spec.level ?? levelOf(fm[type.statusProperty]) ?? rules.levels.want
            const blank = { ...EMPTY_ITEM, typeId: type.id, kind: type.kind }
            Object.assign(
                fm,
                levelChange(blank, type, level, {
                    date: isoDate(),
                    fields,
                    rules,
                    stampDates: !starterKitRunsAutomations(this.app),
                    current: fm
                })
            )
            if (spec.shape) put(fields.shape, spec.shape)
            if (chord) {
                put(fields.chordSymbol, chord.symbol)
                put(fields.chordRoot, chord.root)
                put(fields.chordQuality, chord.quality)
                fm['aliases'] = withAlias(fm['aliases'], chord.symbol)
            }
            for (const [name, value] of Object.entries(spec.properties ?? {})) put(name, value)
            if (spec.voicing) {
                put(fields.frets, formatFrets(spec.voicing.frets))
                // Typed frets come without fingers: none written.
                if (spec.voicing.fingers.some((f) => f !== null))
                    put(fields.fingers, formatFingers(spec.voicing))
            }
        })
        const block = spec.block
        if (block) await this.app.vault.process(file, (text) => ensureBlock(text, block))
        return file
    }
}
