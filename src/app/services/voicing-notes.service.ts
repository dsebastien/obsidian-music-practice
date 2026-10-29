import type { App, TFile } from 'obsidian'
import type { GeneratedVoicing } from '@dsebastien/music-notation'
import { chordTitle, parseChord, safeTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import type { LearningType } from '../domain/note-model'
import { formatFingers, formatFrets } from '../domain/notation-note'
import { shapeConflict, shapeValue, voicingNoteTitle } from '../domain/voicings'
import type { NoteCreatorService } from './note-creator.service'

/** Chord notes from the library's generated voicings (#54): add one, or switch a note to one. */
export class VoicingNotesService {
    constructor(
        private readonly app: App,
        private readonly creator: NoteCreatorService,
        private readonly fields: () => FieldNames
    ) {}

    /** The type's shape value for the voicing's shape, when the type has one. */
    shapeFor(type: LearningType, voicing: GeneratedVoicing): string | null {
        const name = this.fields().shape
        if (!type.fields.has(name)) return null
        return shapeValue(voicing.shape, type.allowedValues[name] ?? [])
    }

    /** A new chord note for the voicing; its title gets the fret when the usual one is taken. */
    async add(
        type: LearningType,
        voicing: GeneratedVoicing,
        symbol: string,
        drawsBlock: boolean
    ): Promise<TFile> {
        const chord = parseChord(symbol)
        if (!chord) throw new Error(`Unknown chord "${symbol}".`)
        const shape = this.shapeFor(type, voicing)
        const title = voicingNoteTitle(
            safeTitle(chordTitle(chord, shape ?? undefined)),
            voicing,
            (t) => this.creator.exists(type, t)
        )
        if (!title)
            throw new Error(`${chordTitle(chord, shape ?? undefined)} already has a note there.`)
        return this.creator.create(type, {
            title,
            chordSymbol: chord.symbol,
            ...(shape ? { shape } : {}),
            voicing,
            ...(drawsBlock ? { block: 'chord' } : {})
        })
    }

    /**
     * Why a voicing can't become this note's: the note is another shape, and a shape is its own
     * thing to learn (its own note and mastery). Null when the note has no shape yet, or the same.
     */
    cantUse(note: TFile, type: LearningType, voicing: GeneratedVoicing): string | null {
        const name = this.fields().shape
        const value = this.app.metadataCache.getFileCache(note)?.frontmatter?.[name] as unknown
        return shapeConflict(typeof value === 'string' ? value : '', this.shapeFor(type, voicing))
    }

    /**
     * Make the voicing this note's: its frets, fingers and shape (and position, when the note has
     * one). Only voicings of the note's own shape (or any, when it has none): mastery and history
     * stay with the note.
     */
    async use(file: TFile, type: LearningType, voicing: GeneratedVoicing): Promise<void> {
        const fields = this.fields()
        const shape = this.shapeFor(type, voicing)
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            const put = (name: string, value: unknown) => {
                if (type.fields.has(name)) fm[name] = value
            }
            put(fields.frets, formatFrets(voicing.frets))
            put(fields.fingers, formatFingers(voicing))
            // Same shape, or the note had none yet.
            if (shape) put(fields.shape, shape)
            if (fields.position in fm) put(fields.position, voicing.baseFret)
        })
    }
}
