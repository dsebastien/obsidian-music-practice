import type { App, CachedMetadata, TFile } from 'obsidian'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { learningTypeOf, toLearningItemInput } from '../domain/item-reader'
import type { NoteSnapshot } from '../domain/item-reader'
import type { LearningType, NoteModel } from '../domain/note-model'
import { computeItems } from '../domain/practice'
import type { LearningItem, LearningItemInput } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'

/**
 * Learning notes read from Obsidian's metadata cache. The scan of the vault is cached and rebuilt
 * only after a change (`invalidate`, called on metadata changes, renames and deletes) or when the
 * note model or the field names change.
 */
export class ItemRepository {
    private cache: { model: NoteModel; fields: FieldNames; inputs: LearningItemInput[] } | null =
        null

    constructor(
        private readonly app: App,
        private readonly model: () => NoteModel,
        private readonly settings: () => { rules: PracticeRules; fields: FieldNames }
    ) {}

    invalidate(): void {
        this.cache = null
    }

    /** The learning type of a file, or null when it isn't a learning note. */
    typeOf(file: TFile): LearningType | null {
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
        return fm ? learningTypeOf(this.model().learningTypes, fm) : null
    }

    /** Every learning note as engine input. */
    inputs(): LearningItemInput[] {
        const model = this.model()
        const { fields } = this.settings()
        const cached = this.cache
        if (
            cached &&
            cached.model === model &&
            JSON.stringify(cached.fields) === JSON.stringify(fields)
        )
            return cached.inputs
        const inputs: LearningItemInput[] = []
        if (model.learningTypes.length > 0) {
            for (const file of this.app.vault.getMarkdownFiles()) {
                const cache = this.app.metadataCache.getFileCache(file)
                const fm = cache?.frontmatter
                if (!cache || !fm) continue
                const type = learningTypeOf(model.learningTypes, fm)
                if (type) inputs.push(toLearningItemInput(this.snapshot(file, cache), type, fields))
            }
        }
        this.cache = { model, fields, inputs }
        return inputs
    }

    /** Every learning note with its derived state, as of a date (today by default). */
    items(today: string = isoDate()): LearningItem[] {
        return computeItems(this.inputs(), today, this.settings().rules)
    }

    private snapshot(file: TFile, cache: CachedMetadata): NoteSnapshot {
        const resolve = (link: string): string => {
            const path = link.split('#')[0] ?? link
            const target = this.app.metadataCache.getFirstLinkpathDest(path, file.path)
            return target?.basename ?? path.split('/').pop()!.replace(/\.md$/, '')
        }
        const propertyLinks: Record<string, string[]> = {}
        for (const l of cache.frontmatterLinks ?? []) {
            const property = l.key.split('.')[0]!
            ;(propertyLinks[property] ??= []).push(resolve(l.link))
        }
        const bodyLinks = (cache.links ?? []).map((l) => resolve(l.link))
        return {
            path: file.path,
            basename: file.basename,
            frontmatter: cache.frontmatter ?? {},
            propertyLinks,
            allLinks: [...new Set([...Object.values(propertyLinks).flat(), ...bodyLinks])]
        }
    }
}
