/**
 * Chord change drills (#40): which pairs to drill, their exercise notes (created on the first
 * drill, linking both chords through `trains`), and saving a drill's count.
 */
import type { App, TFile } from 'obsidian'
import { afterDrill, pairTitle, pairsOf, type DrillPair } from '../domain/drill'
import type { FieldNames } from '../domain/fields'
import type { LearningType, NoteModel } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import { safeTitle } from '../domain/chord'
import type { PracticeRules } from '../domain/rules'
import type { ItemRepository } from './item-repository'
import type { NewLearningNote } from './note-creator.service'

/** A chord note's title without its type's suffix ("A Major - Open"). */
const bare = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim()

/** A count as stored: a number, or a number typed as text ("30"). */
const numberOf = (value: unknown): number | null => {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
    return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Pair notes are titled "<chord> ↔ <chord>": other exercises training two chords aren't pairs. */
const PAIR_TITLE = / ↔ /

export class DrillService {
    constructor(
        private readonly app: App,
        private readonly model: () => NoteModel,
        private readonly repo: ItemRepository,
        private readonly fields: () => FieldNames,
        private readonly rules: () => PracticeRules,
        private readonly create: (type: LearningType, spec: NewLearningNote) => Promise<TFile>
    ) {}

    /** The guitar exercise type pair notes belong to; null when the vault has none. */
    exerciseType(): LearningType | null {
        return (
            this.model().learningTypes.find(
                (t) => t.subject === 'guitar' && t.kind === 'exercise'
            ) ?? null
        )
    }

    /** Guitar chord notes. */
    chords(): LearningItem[] {
        const types = new Set(
            this.model()
                .learningTypes.filter((t) => t.subject === 'guitar' && t.kind === 'chord')
                .map((t) => t.id)
        )
        return this.repo.items().filter((i) => types.has(i.typeId))
    }

    /** The chords a pair note trains, as note paths (its `trains` links that lead to chords). */
    private chordsOf(file: TFile, chordPaths: Set<string>): string[] {
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}
        const raw: unknown = fm[this.fields().trains]
        const links = (Array.isArray(raw) ? raw : [raw]).filter(
            (l): l is string => typeof l === 'string'
        )
        return links
            .map(
                (l) =>
                    l
                        .replace(/^\[\[|\]\]$/g, '')
                        .split('|')[0]!
                        .split('#')[0]!
            )
            .map((l) => this.app.metadataCache.getFirstLinkpathDest(l, file.path)?.path)
            .filter((p): p is string => p !== undefined && chordPaths.has(p))
    }

    /** Existing pair notes: exercise notes training exactly two chords. */
    private pairNotes(): {
        path: string
        chords: string[]
        best: number | null
        last: number | null
    }[] {
        const type = this.exerciseType()
        if (!type) return []
        const chordPaths = new Set(this.chords().map((c) => c.path))
        const { changesBest, changesLast } = this.fields()
        return this.repo
            .items()
            .filter((i) => i.typeId === type.id && PAIR_TITLE.test(i.name))
            .flatMap((i) => {
                const file = this.app.vault.getFileByPath(i.path)
                if (!file) return []
                const chords = this.chordsOf(file, chordPaths)
                const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}
                return chords.length === 2
                    ? [
                          {
                              path: i.path,
                              chords,
                              best: numberOf(fm[changesBest]),
                              last: numberOf(fm[changesLast])
                          }
                      ]
                    : []
            })
    }

    /**
     * Pairs to drill, slowest first: among the current-focus chords (else the chords being
     * learned, else all), or with one chord when given.
     */
    suggestions(withChord?: string): DrillPair[] {
        const chords = this.chords()
        const focus = chords.filter((c) => c.focus)
        const { learning: from, mastered } = this.rules().levels
        const learning = chords.filter(
            (c) => c.level !== null && c.level >= from && c.level < mastered
        )
        const pool = (focus.length > 1 ? focus : learning.length > 1 ? learning : chords).map(
            (c) => c.path
        )
        const notes = this.pairNotes()
        if (!withChord) return pairsOf(pool, notes)
        const partners = (pool.includes(withChord) ? pool : [withChord, ...pool]).filter(
            (p) => p !== withChord
        )
        return pairsOf([withChord, ...partners], notes).filter(
            (p) => p.a === withChord || p.b === withChord
        )
    }

    /** The pair a pair note drills; null for other notes. */
    pairOfNote(path: string): DrillPair | null {
        const note = this.pairNotes().find((n) => n.path === path)
        return note
            ? {
                  a: note.chords[0]!,
                  b: note.chords[1]!,
                  note: note.path,
                  best: note.best,
                  last: note.last
              }
            : null
    }

    /** A chord note's name for titles. */
    nameOf(path: string): string {
        return bare(
            this.repo.items().find((i) => i.path === path)?.name ??
                path.replace(/^.*\//, '').replace(/\.md$/, '')
        )
    }

    /**
     * Save a drill: the pair's note (created on its first drill) gets the count as its last, and
     * as its best when it beats it. Returns the note's path and the counts.
     */
    async save(
        pair: DrillPair,
        count: number
    ): Promise<{ path: string; best: number; improved: boolean }> {
        const type = this.exerciseType()
        if (!type)
            throw new Error(
                'This vault has no guitar exercise type to keep chord change drills in.'
            )
        const { trains, changesBest, changesLast } = this.fields()
        for (const field of [trains, changesBest, changesLast])
            if (!type.fields.has(field))
                throw new Error(
                    `The guitar exercise type has no "${field}" property: add it to keep drill results.`
                )
        let path = pair.note
        if (!path || !this.app.vault.getFileByPath(path)) {
            const title = safeTitle(pairTitle(this.nameOf(pair.a), this.nameOf(pair.b)))
            // Created moments ago and not indexed yet, or created by hand: use it.
            const existing = this.app.vault
                .getMarkdownFiles()
                .find((f) => f.basename === title || f.basename.startsWith(`${title} (`))
            if (existing) path = existing.path
        }
        if (!path || !this.app.vault.getFileByPath(path)) {
            const title = safeTitle(pairTitle(this.nameOf(pair.a), this.nameOf(pair.b)))
            const link = (p: string) =>
                `[[${this.app.metadataCache.fileToLinktext(this.app.vault.getFileByPath(p)!, '')}]]`
            const file = await this.create(type, {
                title,
                ...(type.fields.has(trains)
                    ? { properties: { [trains]: [link(pair.a), link(pair.b)] } }
                    : {})
            })
            path = file.path
        }
        const file = this.app.vault.getFileByPath(path)!
        let result = afterDrill(null, count)
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            result = afterDrill(numberOf(fm[changesBest]), count)
            fm[changesBest] = result.best
            fm[changesLast] = result.last
        })
        return { path, best: result.best, improved: result.improved }
    }
}
