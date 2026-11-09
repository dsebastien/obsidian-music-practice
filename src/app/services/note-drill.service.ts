/**
 * Note, chord and scale drills (#73): the drill notes (guitar and piano exercise notes, one per
 * kind and setting), the chords and scales to ask (decision 10), Save (kind, setting, the
 * weak-spot map and the review, in one frontmatter write) and Create note for a chord or scale
 * that has none yet.
 */
import type { TFile } from 'obsidian'
import { parseChord } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'
import { chordTitle, safeTitle, scaleTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import { levelChange } from '../domain/log'
import type { LearningType, NoteModel } from '../domain/note-model'
import {
    KIND_LABELS,
    chordOfName,
    chordsOfText,
    drillFileTitle,
    formatStat,
    inFamily,
    kindOfLabel,
    libraryChords,
    libraryScales,
    mergeStats,
    missingFrom,
    parseSetting,
    parseStats,
    reviewResultOf,
    sameChord,
    sameScale,
    scaleOf,
    scaleOfName,
    scoreOf,
    settingWords,
    type Answer,
    type DrillInstrument,
    type DrillRules,
    type DrillSetting,
    type Score
} from '../domain/note-drill'
import type { LearningItem } from '../domain/practice'
import { reviewOutcome, type ReviewResult } from '../domain/review'
import type { PracticeRules } from '../domain/rules'
import type { NewLearningNote } from './note-creator.service'

/** What the service needs of Obsidian's app (a narrow host, for specs). */
export interface NoteDrillHost {
    vault: {
        getFileByPath(path: string): TFile | null
        cachedRead(file: TFile): Promise<string>
    }
    metadataCache: {
        getFileCache(file: TFile): { frontmatter?: Record<string, unknown> } | null
    }
    fileManager: {
        processFrontMatter(file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void>
    }
}

export interface NoteDrillDeps {
    model: () => NoteModel
    items: () => LearningItem[]
    fields: () => FieldNames
    rules: () => PracticeRules
    drillRules: () => DrillRules
    create: (type: LearningType, spec: NewLearningNote) => Promise<TFile>
    /** Today, as the log writes dates (YYYY-MM-DD). */
    today: () => string
    /** A type's name affixes (the Obsidian Starter Kit's prefix and suffix, or the local model's). */
    affixes?: (type: LearningType) => { prefix: string; suffix: string }
    /** Where a new note of a type and title goes, to find one the index doesn't list yet. */
    pathFor?: (type: LearningType, title: string) => string
    /** Whether new notes get an empty block of this language (Music Practice draws it). */
    blocksOn?: (language: 'chord' | 'fretboard' | 'keyboard') => boolean
}

/** A drill note: its path and what it drills. */
export interface DrillNote {
    path: string
    name: string
    setting: DrillSetting
}

export interface SavedDrill {
    path: string
    score: Score
    review: ReviewResult
}

const instrumentOf = (setting: DrillSetting): DrillInstrument =>
    setting.kind === 'keyboard'
        ? 'piano'
        : setting.kind === 'fretboard'
          ? 'guitar'
          : setting.instrument

export class NoteDrillService {
    constructor(
        private readonly host: NoteDrillHost,
        private readonly deps: NoteDrillDeps
    ) {}

    private typeOf(instrument: DrillInstrument, kind: string): LearningType | null {
        return (
            this.deps
                .model()
                .learningTypes.find((t) => t.subject === instrument && t.kind === kind) ?? null
        )
    }

    /** The exercise type that keeps an instrument's drill notes; null when the vault has none. */
    exerciseType(instrument: DrillInstrument): LearningType | null {
        return this.typeOf(instrument, 'exercise')
    }

    private frontmatter(path: string): Record<string, unknown> {
        const file = this.host.vault.getFileByPath(path)
        return (file && this.host.metadataCache.getFileCache(file)?.frontmatter) || {}
    }

    /** What a note drills; null when it isn't a drill note (or its setting doesn't read). */
    drillOf(path: string): DrillSetting | null {
        const item = this.deps.items().find((i) => i.path === path)
        return item ? this.settingOf(item) : null
    }

    /** What a learning item drills (one item: no computing of every item again). */
    private settingOf(item: LearningItem): DrillSetting | null {
        const path = item.path
        const type = this.deps.model().learningTypes.find((t) => t.id === item.typeId)
        if (
            !type ||
            type.kind !== 'exercise' ||
            (type.subject !== 'guitar' && type.subject !== 'piano')
        )
            return null
        const { drillKind, drillSetting } = this.deps.fields()
        const fm = this.frontmatter(path)
        const kind = kindOfLabel(fm[drillKind])
        const words = fm[drillSetting]
        return kind && typeof words === 'string' ? parseSetting(kind, words, type.subject) : null
    }

    /**
     * Every drill note of the vault. The items are computed once here: computing them for each
     * note froze Obsidian on a real vault (the work grew with the cube of the notes).
     */
    drillNotes(items: LearningItem[] = this.deps.items()): (DrillNote & { typeId: string })[] {
        const exercises = new Set(
            this.deps
                .model()
                .learningTypes.filter((t) => t.kind === 'exercise')
                .map((t) => t.id)
        )
        return items.flatMap((i) => {
            if (!exercises.has(i.typeId)) return []
            const setting = this.settingOf(i)
            return setting ? [{ path: i.path, name: i.name, setting, typeId: i.typeId }] : []
        })
    }

    /**
     * The drill note of a kind and setting; null before its first save. Two notes with the same
     * setting (made by hand): the most asked one, then the first by path.
     */
    noteFor(setting: DrillSetting): DrillNote | null {
        const words = settingWords(setting)
        const type = this.exerciseType(instrumentOf(setting))
        const asked = (path: string) =>
            [...this.statsOf(path).stats.values()].reduce((n, s) => n + s.asked, 0)
        const matches = this.drillNotes().filter(
            (n) =>
                n.setting.kind === setting.kind &&
                settingWords(n.setting) === words &&
                n.typeId === type?.id
        )
        return (
            matches.sort(
                (a, b) => asked(b.path) - asked(a.path) || a.path.localeCompare(b.path)
            )[0] ?? null
        )
    }

    /** A drill note's weak-spot map (and the items it doesn't read). */
    statsOf(path: string): ReturnType<typeof parseStats> {
        return parseStats(this.frontmatter(path)[this.deps.fields().drillStats])
    }

    private itemsOf(instrument: DrillInstrument, kind: string): LearningItem[] {
        const type = this.typeOf(instrument, kind)
        return type ? this.deps.items().filter((i) => i.typeId === type.id) : []
    }

    /** Chord notes' symbols, scale notes' scales. */
    private known(
        kind: 'chords' | 'scales',
        instrument: DrillInstrument
    ): { path: string; name: string; item: LearningItem }[] {
        const f = this.deps.fields()
        return this.itemsOf(instrument, kind === 'chords' ? 'chord' : 'scale').flatMap((item) => {
            const fm = this.frontmatter(item.path)
            const name =
                kind === 'chords'
                    ? typeof fm[f.chordSymbol] === 'string'
                        ? (parseChord(String(fm[f.chordSymbol]))?.symbol ?? null)
                        : chordOfName(item.name)
                    : typeof fm[f.scaleRoot] === 'string' && typeof fm[f.scaleType] === 'string'
                      ? scaleOf(String(fm[f.scaleRoot]), String(fm[f.scaleType]))
                      : scaleOfName(item.name)
            return name ? [{ path: item.path, name, item }] : []
        })
    }

    /** The note of a chord or scale on an instrument; null when there is none. */
    noteOf(kind: 'chords' | 'scales', name: string, instrument: DrillInstrument): string | null {
        const same = kind === 'chords' ? sameChord : sameScale
        return (
            this.known(kind, instrument).find((k) => k.name === name || same(k.name, name))?.path ??
            null
        )
    }

    /**
     * The chords or scales a drill asks (decision 10): from my notes (the current focus ones when
     * two or more, else those being learned, else all), from my pieces (chords their charts and
     * progressions play without a chord note), from my focus (prerequisites of current-focus notes
     * that have no note yet), or from the library (a chord family, the common scales).
     */
    async pool(setting: DrillSetting): Promise<string[]> {
        if (setting.kind !== 'chords' && setting.kind !== 'scales') return []
        const { instrument, source } = setting
        const family = setting.kind === 'chords' ? setting.family : undefined
        const keep = (names: string[]) => [
            ...new Set(family ? names.filter((n) => inFamily(n, family)) : names)
        ]
        const known = this.known(setting.kind, instrument)
        if (source === 'notes') {
            const { learning, mastered } = this.deps.rules().levels
            const all = family ? known.filter((k) => inFamily(k.name, family)) : known
            const focus = all.filter((k) => k.item.focus)
            const being = all.filter(
                (k) => k.item.level !== null && k.item.level >= learning && k.item.level < mastered
            )
            return keep(
                (focus.length > 1 ? focus : being.length > 1 ? being : all).map((k) => k.name)
            )
        }
        if (source === 'library')
            return setting.kind === 'chords' ? libraryChords(family) : libraryScales()
        if (source === 'pieces') {
            if (setting.kind === 'scales') return []
            const pieces = this.itemsOf(instrument, 'arrangement')
            const played: string[] = []
            for (const piece of pieces) {
                const file = this.host.vault.getFileByPath(piece.path)
                if (file) played.push(...chordsOfText(await this.host.vault.cachedRead(file)))
            }
            return keep(
                missingFrom(
                    played,
                    known.map((k) => k.name)
                )
            )
        }
        // From my focus: what current-focus notes need and the vault has no note for. A name with
        // a type's affixes is that type's: only this instrument's chord (or scale) type counts.
        const wantedKind = setting.kind === 'chords' ? 'chord' : 'scale'
        const own = this.typeOf(instrument, wantedKind)
        const types = this.deps.model().learningTypes
        const affixed = (name: string): { type: LearningType; bare: string } | null => {
            for (const t of types) {
                const a = this.deps.affixes?.(t)
                if (!a || (!a.prefix && !a.suffix)) continue
                if (name.startsWith(a.prefix) && name.endsWith(a.suffix))
                    return {
                        type: t,
                        bare: name.slice(a.prefix.length, name.length - a.suffix.length)
                    }
            }
            return null
        }
        const subjectOf = (i: LearningItem) => types.find((t) => t.id === i.typeId)?.subject ?? null
        const names = this.deps
            .items()
            .filter((i) => i.focus)
            .flatMap((i) =>
                i.missingPrerequisites.flatMap((name) => {
                    const typed = affixed(name)
                    if (typed) return typed.type.id === own?.id ? [typed.bare] : []
                    // No type's affixes: the note that needs it says the instrument.
                    const subject = subjectOf(i)
                    return subject === null || subject === instrument ? [name] : []
                })
            )
        if (setting.kind === 'chords')
            return keep(
                missingFrom(
                    names.map(chordOfName).filter((c): c is string => c !== null),
                    known.map((k) => k.name)
                )
            )
        const out: string[] = []
        for (const scale of names.map(scaleOfName)) {
            if (
                scale &&
                !known.some((k) => sameScale(k.name, scale)) &&
                !out.some((o) => sameScale(o, scale))
            )
                out.push(scale)
        }
        return out
    }

    /** Creates the note of a chord or scale that has none, through its type (template, folder, name). */
    async createNote(
        kind: 'chords' | 'scales',
        name: string,
        instrument: DrillInstrument
    ): Promise<string> {
        const type = this.typeOf(instrument, kind === 'chords' ? 'chord' : 'scale')
        if (!type)
            throw new Error(
                `This vault has no ${instrument} ${kind === 'chords' ? 'chord' : 'scale'} note type.`
            )
        const on = (language: 'chord' | 'fretboard' | 'keyboard') =>
            this.deps.blocksOn?.(language) ?? true
        if (kind === 'chords') {
            const chord = parseChord(name)
            if (!chord) throw new Error(`"${name}" is not a chord the library reads.`)
            const voicing = instrument === 'guitar' ? lookupGuitarVoicing(chord.symbol, 0) : null
            const file = await this.deps.create(type, {
                title: safeTitle(chordTitle(chord)),
                chordSymbol: chord.symbol,
                ...(voicing ? { voicing } : {}),
                ...(on('chord') ? { block: 'chord' } : {})
            })
            return file.path
        }
        const m = /^([A-G][#b]?)\s+(.+)$/.exec(name.trim())
        if (!m) throw new Error(`"${name}" is not a scale the library reads.`)
        const f = this.deps.fields()
        const scaleType = m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1)
        const language = instrument === 'piano' ? 'keyboard' : 'fretboard'
        const file = await this.deps.create(type, {
            title: safeTitle(scaleTitle(m[1]!, scaleType)),
            ...(type.fields.has(f.scaleRoot) && type.fields.has(f.scaleType)
                ? { properties: { [f.scaleRoot]: m[1]!, [f.scaleType]: scaleType } }
                : {}),
            ...(on(language) ? { block: language } : {})
        })
        return file.path
    }

    /**
     * Saves a drill: its note (created on the first save, level Learning) gets the kind, the
     * setting, the merged weak-spot map and the review from the score, in one write.
     */
    async save(setting: DrillSetting, answers: Answer[]): Promise<SavedDrill> {
        const instrument = instrumentOf(setting)
        const type = this.exerciseType(instrument)
        if (!type)
            throw new Error(`This vault has no ${instrument} exercise note type to keep drills in.`)
        const f = this.deps.fields()
        for (const field of [f.drillKind, f.drillSetting, f.drillStats])
            if (!type.fields.has(field))
                throw new Error(
                    `The ${instrument} exercise type has no "${field}" property: add it to keep drill results.`
                )
        const rules = this.deps.rules()
        let path = this.noteFor(setting)?.path ?? null
        let file = path ? this.host.vault.getFileByPath(path) : null
        if (!file) {
            const title = safeTitle(drillFileTitle(setting))
            // Created moments ago and not indexed yet: use it, never a second note.
            const lagging = this.deps.pathFor
                ? this.host.vault.getFileByPath(this.deps.pathFor(type, title))
                : null
            file =
                lagging ??
                (await this.deps.create(type, {
                    title,
                    level: rules.levels.learning,
                    // A drill note is private: publishing is the user's choice, never the template's.
                    ...(type.fields.has(f.publicNote)
                        ? { properties: { [f.publicNote]: false } }
                        : {})
                }))
            path = file.path
        }
        const item = this.deps.items().find((i) => i.path === path)
        const score = scoreOf(answers)
        const review = reviewResultOf(score.share)
        const today = this.deps.today()
        await this.host.fileManager.processFrontMatter(file, (fm) => {
            const { stats, other } = parseStats(fm[f.drillStats])
            const merged = mergeStats(stats, answers, this.deps.drillRules())
            fm[f.drillKind] = KIND_LABELS[setting.kind]
            fm[f.drillSetting] = settingWords(setting)
            fm[f.drillStats] = [
                ...[...merged.values()]
                    .sort((a, b) => a.spot.localeCompare(b.spot))
                    .map(formatStat),
                ...other
            ]
            const count =
                typeof fm[f.reviewCount] === 'number'
                    ? (fm[f.reviewCount] as number)
                    : (item?.reviewCount ?? null)
            const interval =
                typeof fm[f.reviewInterval] === 'number'
                    ? (fm[f.reviewInterval] as number)
                    : (item?.reviewInterval ?? null)
            // One review a day: a second drill the same day adds to the map, not to the review.
            if (fm[f.lastReviewed] === today) return
            const outcome = reviewOutcome(
                review,
                { level: item?.level ?? null, interval, count },
                today,
                rules
            )
            if (type.fields.has(f.lastReviewed)) fm[f.lastReviewed] = outcome.lastReviewed
            if (type.fields.has(f.reviewCount)) fm[f.reviewCount] = outcome.reviewCount
            if (type.fields.has(f.reviewInterval)) fm[f.reviewInterval] = outcome.reviewInterval
            // A failed review drops a mastered drill to Rusty, like every other review.
            if (outcome.level !== undefined && item)
                Object.assign(
                    fm,
                    levelChange(item, type, outcome.level, {
                        date: today,
                        fields: f,
                        rules,
                        stampDates: false,
                        current: fm
                    })
                )
        })
        return { path: path!, score, review }
    }
}
