import type { App } from 'obsidian'
import type { FieldNames } from '../domain/fields'
import { tagsOf } from '../domain/item-reader'
import { buildLocalModel } from '../domain/local-model'
import type { LocalModelSettings, ObservedNote } from '../domain/local-model'
import { levelOf } from '../domain/mastery'
import { buildNoteModel } from '../domain/note-model'
import type { NoteModel, TypeDescriptor } from '../domain/note-model'
import type { PracticeRules } from '../domain/rules'
import {
    getNoteTypeStatus,
    isStarterKitAvailable,
    listGlobalPropertyNames,
    listNoteTypes
} from './starter-kit.service'

/** Where the note types come from: the Obsidian Starter Kit, or the plugin's own settings. */
export type NoteModelSource = 'starter-kit' | 'local'

export interface NoteModelSettings {
    rules: PracticeRules
    fields: FieldNames
    local: LocalModelSettings
}

/**
 * The learning and session types. With the Obsidian Starter Kit (OSK), its note types are the
 * source of truth (status values and roles, folders, templates, date stamps). Without it, the
 * plugin's own model applies: learning types inferred from the notes, session types from the
 * settings. Switching OSK on or off later loses nothing: notes stay as they are.
 */
export class NoteModelService {
    private model: NoteModel = { learningTypes: [], sessionTypes: [] }
    private currentSource: NoteModelSource = 'local'

    constructor(
        private readonly app: App,
        private readonly settings: () => NoteModelSettings
    ) {}

    get source(): NoteModelSource {
        return this.currentSource
    }

    get(): NoteModel {
        return this.model
    }

    /** Rebuild: on load, on OSK note type changes, after settings changes, before each command. */
    refresh(): NoteModel {
        const { rules, fields, local } = this.settings()
        if (isStarterKitAvailable(this.app)) {
            this.currentSource = 'starter-kit'
            this.model = buildNoteModel(this.starterKitTypes(), rules, fields)
        } else {
            this.currentSource = 'local'
            this.model = buildLocalModel(
                this.observedNotes(local.statusProperty),
                local,
                rules,
                fields
            )
        }
        return this.model
    }

    private starterKitTypes(): TypeDescriptor[] {
        // Global properties (the review fields among them) belong to every type.
        const globals = listGlobalPropertyNames(this.app).map((name) => ({ name }))
        return listNoteTypes(this.app).map((t) => {
            const status = getNoteTypeStatus(this.app, t.id)
            return {
                id: t.id,
                name: t.name,
                tags: (t.tags ?? []).map((g) => g.replace(/^#/, '')),
                properties: [
                    ...globals,
                    ...(t.properties ?? []).map((p) => ({
                        name: p.name,
                        allowedValues: p.allowedValues
                    }))
                ],
                templatePath: t.templatePath ?? null,
                status:
                    status?.explicit === true
                        ? {
                              property: status.property,
                              values: status.values.map((v) => v.value),
                              stamps: Object.fromEntries(
                                  status.values
                                      .filter((v) => v.stampsDate)
                                      .map((v) => [v.value, v.stampsDate!])
                              )
                          }
                        : null
            }
        })
    }

    /** Tags and mastery level of every note that has the status property. */
    private observedNotes(statusProperty: string): ObservedNote[] {
        const out: ObservedNote[] = []
        for (const file of this.app.vault.getMarkdownFiles()) {
            const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
            if (!fm || !(statusProperty in fm)) continue
            out.push({ tags: tagsOf(fm), level: levelOf(fm[statusProperty]) })
        }
        return out
    }
}
