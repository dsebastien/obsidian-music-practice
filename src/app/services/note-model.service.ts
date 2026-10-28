import type { App } from 'obsidian'
import { buildNoteModel } from '../domain/note-model'
import type { NoteModel, TypeDescriptor } from '../domain/note-model'
import type { FieldNames } from '../domain/fields'
import type { PracticeRules } from '../domain/rules'
import {
    getNoteTypeStatus,
    isStarterKitAvailable,
    listGlobalPropertyNames,
    listNoteTypes
} from './starter-kit.service'

export type NoteModelSource = 'starter-kit' | 'none'

/**
 * The learning and session types, read from the Obsidian Starter Kit when it is available.
 * Without it the model is empty until the plugin's own note model lands (#4).
 */
export class NoteModelService {
    private model: NoteModel = { learningTypes: [], sessionTypes: [] }
    private currentSource: NoteModelSource = 'none'

    constructor(
        private readonly app: App,
        private readonly settings: () => { rules: PracticeRules; fields: FieldNames }
    ) {}

    get source(): NoteModelSource {
        return this.currentSource
    }

    get(): NoteModel {
        return this.model
    }

    /** Rebuild from OSK; call on load, on OSK note type changes and after settings changes. */
    refresh(): NoteModel {
        const { rules, fields } = this.settings()
        if (!isStarterKitAvailable(this.app)) {
            this.currentSource = 'none'
            this.model = { learningTypes: [], sessionTypes: [] }
            return this.model
        }
        // Global properties (the review fields among them) belong to every type.
        const globals = listGlobalPropertyNames(this.app).map((name) => ({ name }))
        const descriptors: TypeDescriptor[] = listNoteTypes(this.app).map((t) => {
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
        this.currentSource = 'starter-kit'
        this.model = buildNoteModel(descriptors, rules, fields)
        return this.model
    }
}
