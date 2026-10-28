import type { App, CachedMetadata, TFile } from 'obsidian'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { learningTypeOf, toLearningItemInput } from '../domain/item-reader'
import type { NoteSnapshot } from '../domain/item-reader'
import type { LearningType, NoteModel } from '../domain/note-model'
import { computeItems } from '../domain/practice'
import type { LearningItem, LearningItemInput } from '../domain/practice'
import type { PracticeRules } from '../domain/rules'

/** Learning notes read from Obsidian's metadata cache. */
export class ItemRepository {
    constructor(
        private readonly app: App,
        private readonly model: () => NoteModel,
        private readonly settings: () => { rules: PracticeRules; fields: FieldNames }
    ) {}

    /** The learning type of a file, or null when it isn't a learning note. */
    typeOf(file: TFile): LearningType | null {
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
        return fm ? learningTypeOf(this.model().learningTypes, fm) : null
    }

    /** Every learning note as engine input. */
    inputs(): LearningItemInput[] {
        const types = this.model().learningTypes
        if (types.length === 0) return []
        const { fields } = this.settings()
        const out: LearningItemInput[] = []
        for (const file of this.app.vault.getMarkdownFiles()) {
            const cache = this.app.metadataCache.getFileCache(file)
            const fm = cache?.frontmatter
            if (!cache || !fm) continue
            const type = learningTypeOf(types, fm)
            if (!type) continue
            out.push(toLearningItemInput(this.snapshot(file, cache), type, fields))
        }
        return out
    }

    /** Every learning note with its derived state, as of today. */
    items(today: string = isoDate()): LearningItem[] {
        return computeItems(this.inputs(), today, this.settings().rules)
    }

    private snapshot(file: TFile, cache: CachedMetadata): NoteSnapshot {
        const resolve = (link: string): string => {
            const target = this.app.metadataCache.getFirstLinkpathDest(
                link.split('#')[0] ?? link,
                file.path
            )
            return target?.basename ?? link.split('#')[0]!.split('/').pop()!.replace(/\.md$/, '')
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
