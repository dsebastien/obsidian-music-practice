import { describe, expect, it } from 'bun:test'
import { generateVoicings } from '@dsebastien/music-notation'
import { TFile } from 'obsidian'
import { VoicingNotesService } from './voicing-notes.service'
import type { VoicingNoteCreator, VoicingNotesHost } from './voicing-notes.service'
import { createDefaultFieldNames } from '../domain/fields'
import type { LearningType } from '../domain/note-model'
import type { NewLearningNote } from './note-creator.service'

const fields = createDefaultFieldNames()

const type = (
    allowed: string[] = ['Open', 'E-shape barre', 'A-shape barre'],
    frets = true
): LearningType => ({
    id: 'guitar-chords',
    name: 'Guitar Chords',
    typeTag: 'type/music/guitar/chord',
    domain: 'music',
    subject: 'guitar',
    kind: 'chord',
    tags: ['type/music/guitar/chord'],
    statusProperty: 'mastery',
    statusValues: [],
    stamps: {},
    fields: new Set([
        fields.shape,
        fields.chordSymbol,
        fields.fingers,
        fields.position,
        ...(frets ? [fields.frets] : [])
    ]),
    topPriority: null,
    templatePath: null,
    allowedValues: { [fields.shape]: allowed }
})

/** A vault of notes (path → frontmatter) and a creator that records what it creates. */
function setup(notes: Record<string, Record<string, unknown>>) {
    const created: NewLearningNote[] = []
    const file = (path: string): TFile =>
        Object.assign(new TFile(), { path, basename: path.replace(/\.md$/, '') })
    const app: VoicingNotesHost = {
        vault: { getFileByPath: (path: string) => (notes[path] ? file(path) : null) },
        metadataCache: {
            getFileCache: (f: TFile) => ({ frontmatter: notes[f.path] ?? {} })
        },
        fileManager: {
            processFrontMatter: (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
                fn(notes[f.path]!)
                return Promise.resolve()
            }
        }
    }
    const creator: VoicingNoteCreator = {
        exists: (_t: LearningType, title: string) => Boolean(notes[`${title}.md`]),
        pathFor: (_t: LearningType, title: string) => `${title}.md`,
        create: (_t: LearningType, spec: NewLearningNote) => {
            created.push(spec)
            notes[`${spec.title}.md`] = {}
            return Promise.resolve(file(`${spec.title}.md`))
        }
    }
    const service = new VoicingNotesService(
        app,
        creator,
        () => fields,
        () => Object.keys(notes)
    )
    return { service, created, file, notes }
}

const a = generateVoicings('A')
const open = a.find((v) => v.shape === 'Open')!
const eShape = a.find((v) => v.shape === 'E-shape barre')!

describe('VoicingNotesService', () => {
    it('refuses another shape for a note, whatever its shape property says', () => {
        const { service, file } = setup({
            'A Major.md': { frets: 'x02220', chord_symbol: 'A' }
        })
        expect(service.cantUse(file('A Major.md'), type(), eShape, 'A')).toContain('Open shape')
        expect(service.cantUse(file('A Major.md'), type(), open, 'A')).toBeNull()
    })

    it('reads a shape stored as a list, and never overwrites it', async () => {
        const notes: Record<string, Record<string, unknown>> = {
            'A Major.md': { shape: ['Open'], chord_symbol: 'A' }
        }
        const { service, file } = setup(notes)
        expect(service.cantUse(file('A Major.md'), type(), eShape, 'A')).toContain('Open shape')
        await service.use(file('A Major.md'), type(), open)
        expect(notes['A Major.md']).toMatchObject({ shape: ['Open'], frets: 'x02220' })
    })

    it('writes the shape only when the note had none, and the position only when it has one', async () => {
        const notes: Record<string, Record<string, unknown>> = { 'A.md': { position: 0 } }
        const { service, file } = setup(notes)
        await service.use(file('A.md'), type(), eShape)
        expect(notes['A.md']).toMatchObject({
            frets: '577655',
            fingers: '134211',
            shape: 'E-shape barre',
            position: 5
        })
    })

    it('opens the note that already plays a voicing instead of adding another', async () => {
        const { service, created } = setup({
            'A Major - Open.md': { frets: 'x02220', chord_symbol: 'A' }
        })
        const added = await service.add(type(), open, 'A Major', true)
        expect(added.existed).toBe(true)
        expect(added.file.path).toBe('A Major - Open.md')
        expect(created).toHaveLength(0)
    })

    it('titles a new note with its shape, or its fret when taken', async () => {
        const { service, created } = setup({
            'A Major - E-shape barre.md': { frets: 'x-12-14-14-14-12' }
        })
        const added = await service.add(type(), eShape, 'A', true)
        expect(added.existed).toBe(false)
        expect(created[0]).toMatchObject({
            title: 'A Major - E-shape barre at fret 5',
            chordSymbol: 'A',
            shape: 'E-shape barre',
            block: 'chord'
        })
    })

    it('only works with types whose notes hold frets', async () => {
        const { service, file } = setup({ 'A.md': {} })
        expect(service.holdsVoicings(type(undefined, false))).toBe(false)
        const failure = (run: () => Promise<unknown>) =>
            run().then(
                () => null,
                (error: unknown) => (error instanceof Error ? error.message : String(error))
            )
        expect(await failure(() => service.add(type(undefined, false), open, 'A', true))).toContain(
            'frets'
        )
        expect(
            await failure(() => service.use(file('A.md'), type(undefined, false), open))
        ).toContain('frets')
    })

    it('adds a triad with its own title and shape, after its root position', async () => {
        const { service, created } = setup({
            'G Major - Triad (strings 1-3, root position).md': { frets: 'x-x-x-12-12-10' }
        })
        const triad = generateVoicings('G', {
            strings: [1, 2, 3],
            minStrings: 3,
            inversion: 'any'
        }).find((v) => v.inversion === 1)!
        const root = service.existingName(type(), 'G Major - Triad (strings 1-3, root position)')
        expect(root).toBe('G Major - Triad (strings 1-3, root position)')
        await service.add(type(['Triad']), triad, 'G', true, {
            title: 'G Major - Triad (strings 1-3, 1st inversion)',
            shape: service.shapeNamed(type(['Triad']), 'Triad'),
            prerequisite: root
        })
        expect(created[0]).toMatchObject({
            title: 'G Major - Triad (strings 1-3, 1st inversion)',
            shape: 'Triad',
            properties: { prerequisites: ['[[G Major - Triad (strings 1-3, root position)]]'] }
        })
    })
})
