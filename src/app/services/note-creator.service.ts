import { normalizePath } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { parseChord } from '../domain/chord'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { labelFor } from '../domain/mastery'
import type { LearningType } from '../domain/note-model'
import type { PracticeRules } from '../domain/rules'
import { renderTemplate } from '../domain/template-render'
import { resolveNoteTypeAffixes, resolveNoteTypeFolder } from './starter-kit.service'
import type { ItemRepository } from './item-repository'

export interface NewLearningNote {
    title: string
    /** Chord types: the symbol ("F#m7"), stored with its root, quality and as an alias. */
    chordSymbol?: string
    /** A value of the type's shape property ("Open"). */
    shape?: string
    /** Initial level; the "want to learn" level by default. */
    level?: number
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

    async create(type: LearningType, spec: NewLearningNote): Promise<TFile> {
        const { rules, fields } = this.context()
        const folder = this.folderFor(type)
        const affixes = resolveNoteTypeAffixes(this.app, type.id)
        const prefix = affixes && !affixes.prefixOptional ? affixes.prefix : ''
        const suffix = affixes && !affixes.suffixOptional ? affixes.suffix : ''
        const path = normalizePath(
            `${folder ? `${folder}/` : ''}${prefix}${spec.title}${suffix}.md`
        )
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
            const tags = Array.isArray(fm['tags']) ? (fm['tags'] as unknown[]).map(String) : []
            fm['tags'] = [...tags, ...type.tags.filter((t) => !tags.includes(t))]
            // A level the template didn't set (or set to nothing) starts at the requested one.
            const level = spec.level ?? rules.levels.want
            if (!fm[type.statusProperty])
                put(type.statusProperty, labelFor(level, type.statusValues) ?? undefined)
            if (spec.level !== undefined)
                put(type.statusProperty, labelFor(spec.level, type.statusValues) ?? undefined)
            if (spec.shape) put(fields.shape, spec.shape)
            if (chord) {
                put(fields.chordSymbol, chord.symbol)
                put(fields.chordRoot, chord.root)
                put(fields.chordQuality, chord.quality)
                const aliases = Array.isArray(fm['aliases'])
                    ? (fm['aliases'] as unknown[]).map(String)
                    : []
                if (!aliases.includes(chord.symbol)) fm['aliases'] = [...aliases, chord.symbol]
            }
        })
        return file
    }
}
