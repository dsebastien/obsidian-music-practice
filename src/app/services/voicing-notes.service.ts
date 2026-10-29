import type { App, TFile } from 'obsidian'
import { readChord, voicingShape } from '@dsebastien/music-notation'
import type { GeneratedVoicing } from '@dsebastien/music-notation'
import { chordTitle, safeTitle } from '../domain/chord'
import type { FieldNames } from '../domain/fields'
import type { LearningType } from '../domain/note-model'
import { formatFingers, formatFrets } from '../domain/notation-note'
import {
    fretsOfProperty,
    sameFrets,
    shapeText,
    shapeValue,
    voicingConflict,
    voicingNoteTitle
} from '../domain/voicings'
import type { NoteCreatorService } from './note-creator.service'

/** What the service needs from Obsidian. */
export interface VoicingNotesHost {
    vault: Pick<App['vault'], 'getFileByPath'>
    metadataCache: Pick<App['metadataCache'], 'getFileCache'>
    fileManager: Pick<App['fileManager'], 'processFrontMatter'>
}

/** What the service needs to create notes. */
export type VoicingNoteCreator = Pick<NoteCreatorService, 'exists' | 'create'>

/** What adding a voicing as a note did: a new note, or the note that already plays it. */
export interface AddedVoicing {
    file: TFile
    existed: boolean
}

/** Chord notes from the library's generated voicings (#54): add one, or switch a note to one. */
export class VoicingNotesService {
    constructor(
        private readonly app: VoicingNotesHost,
        private readonly creator: VoicingNoteCreator,
        private readonly fields: () => FieldNames,
        /** The paths of a type's notes (from the item index, not a vault scan). */
        private readonly notesOf: (type: LearningType) => string[]
    ) {}

    /** The type's shape value for the voicing's shape, when the type has one. */
    shapeFor(type: LearningType, voicing: GeneratedVoicing): string | null {
        const name = this.fields().shape
        if (!type.fields.has(name)) return null
        return shapeValue(voicing.shape, type.allowedValues[name] ?? [])
    }

    /** Whether notes of this type can hold a voicing (they have a frets property). */
    holdsVoicings(type: LearningType): boolean {
        return type.fields.has(this.fields().frets)
    }

    private frontmatterOf(path: string): Record<string, unknown> | undefined {
        const file = this.app.vault.getFileByPath(path)
        return file ? this.app.metadataCache.getFileCache(file)?.frontmatter : undefined
    }

    /** The note of this type that already plays the voicing of this chord, if any. */
    noteWith(type: LearningType, voicing: GeneratedVoicing, symbol: string): TFile | null {
        const fields = this.fields()
        const wanted = readChord(symbol)?.symbol ?? symbol
        for (const path of this.notesOf(type)) {
            const fm = this.frontmatterOf(path)
            const frets = fretsOfProperty(fm?.[fields.frets])
            if (!frets || !sameFrets(frets, voicing.frets)) continue
            const stored = fm?.[fields.chordSymbol]
            const chord =
                typeof stored === 'string' || typeof stored === 'number'
                    ? readChord(String(stored).trim())?.symbol
                    : null
            if (chord === wanted) return this.app.vault.getFileByPath(path)
        }
        return null
    }

    /**
     * A chord note for the voicing: the note that already plays it, else a new one titled with
     * its shape (or its fret when that title is taken anywhere in the vault).
     */
    async add(
        type: LearningType,
        voicing: GeneratedVoicing,
        symbol: string,
        drawsBlock: boolean
    ): Promise<AddedVoicing> {
        const chord = readChord(symbol)
        if (!chord) throw new Error(`Unknown chord "${symbol}".`)
        if (!this.holdsVoicings(type))
            throw new Error(`${type.name} notes have no "${this.fields().frets}" property.`)
        const existing = this.noteWith(type, voicing, chord.symbol)
        if (existing) return { file: existing, existed: true }
        const shape = this.shapeFor(type, voicing)
        const title = voicingNoteTitle(
            safeTitle(chordTitle(chord, shape ?? undefined)),
            voicing,
            (t) => this.creator.exists(type, t)
        )
        if (!title)
            throw new Error(`${chordTitle(chord, shape ?? undefined)} already has a note there.`)
        const file = await this.creator.create(type, {
            title,
            chordSymbol: chord.symbol,
            ...(shape ? { shape } : {}),
            voicing,
            ...(drawsBlock ? { block: 'chord' } : {})
        })
        return { file, existed: false }
    }

    /**
     * Why a voicing can't become this note's (see voicingConflict); null when it can.
     */
    cantUse(
        note: TFile,
        type: LearningType,
        voicing: GeneratedVoicing,
        symbol: string
    ): string | null {
        const fields = this.fields()
        const fm = this.app.metadataCache.getFileCache(note)?.frontmatter
        const frets = fretsOfProperty(fm?.[fields.frets])
        return voicingConflict({
            frets,
            fretsShape: frets ? voicingShape(frets, symbol) : null,
            shape: shapeText(fm?.[fields.shape]),
            voicing,
            voicingShape: this.shapeFor(type, voicing)
        })
    }

    /**
     * Make the voicing this note's: its frets, fingers and position (when the note has one), and
     * its shape when the note had none. Only voicings of the note's own shape (cantUse): mastery
     * and history stay with the note.
     */
    async use(file: TFile, type: LearningType, voicing: GeneratedVoicing): Promise<void> {
        const fields = this.fields()
        if (!this.holdsVoicings(type))
            throw new Error(`${type.name} notes have no "${fields.frets}" property.`)
        const shape = this.shapeFor(type, voicing)
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            const put = (name: string, value: unknown) => {
                if (type.fields.has(name)) fm[name] = value
            }
            put(fields.frets, formatFrets(voicing.frets))
            put(fields.fingers, formatFingers(voicing))
            if (shape && !shapeText(fm[fields.shape])) put(fields.shape, shape)
            if (fields.position in fm) put(fields.position, voicing.baseFret)
        })
    }
}
