/**
 * Tab exercises (#70): a scale or arpeggio note's run, from one position, as a ```tab block the
 * library writes (`exerciseTab`, music-notation #47), so it plays in time with alphaTab's count-in,
 * metronome and speed control. Guitar only: the tab is a guitar's. Pure: no Obsidian imports.
 */
import {
    chordNoteSet,
    exerciseTab,
    positionCount,
    readChord,
    scaleNoteSet
} from '@dsebastien/music-notation'
import type { ExerciseDirection, ExerciseRhythm } from '@dsebastien/music-notation'
import type { FieldNames } from './fields'
import { cagedShape } from './practice-blocks'

type Properties = Record<string, unknown>

/** What a note's exercise plays: a scale or a chord's arpeggio, and how many notes it has. */
export interface ExerciseSubject {
    notes: { scale: string } | { arpeggio: string }
    /** "A Minor pentatonic", "Am7". */
    name: string
    size: number
}

/** One position to play the run from, as the library's options take it. */
export interface ExercisePosition {
    /** "Box 2", "E shape", "3NPS 4". */
    label: string
    position?: number
    shape?: string
}

export interface ExerciseChoice {
    direction: ExerciseDirection
    rhythm: ExerciseRhythm
    /** Quarters a minute; the library's 60 without one. */
    tempo?: number
}

/** A property as one line of text: a string, a number, or a list's first value. */
function textOf(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (Array.isArray(value)) return textOf(value[0])
    return ''
}

/**
 * A scale note's scale (root and type) or an arpeggio note's chord, as the library reads them;
 * null for other kinds, or when the library doesn't read the note's values.
 */
export function exerciseSubject(
    kind: string,
    properties: Properties,
    fields: Pick<FieldNames, 'scaleRoot' | 'scaleType' | 'chordSymbol'>
): ExerciseSubject | null {
    if (kind === 'scale') {
        const root = textOf(properties[fields.scaleRoot])
        const type = textOf(properties[fields.scaleType])
        if (!root || !type) return null
        const name = `${root} ${type}`
        const set = scaleNoteSet(name)
        return set && set.root !== null && !set.list
            ? { notes: { scale: name }, name, size: set.members.length }
            : null
    }
    if (kind === 'arpeggio') {
        const text = textOf(properties[fields.chordSymbol])
        const symbol = text ? readChord(text)?.symbol : null
        const set = symbol ? chordNoteSet(symbol) : null
        return symbol && set
            ? { notes: { arpeggio: symbol }, name: symbol, size: set.members.length }
            : null
    }
    return null
}

const CAGED = ['C', 'A', 'G', 'E', 'D'] as const

/** Whether the library plays the run from this position. */
const plays = (subject: ExerciseSubject, at: ExercisePosition): boolean => {
    try {
        exerciseTab(subject.notes, optionsOf(at))
        return true
    } catch {
        return false
    }
}

/**
 * The positions to pick from: a pentatonic's five boxes, then the CAGED shapes (C A G E D, as the
 * neck goes up); scales of six notes or more, the CAGED shapes then their 3NPS positions; an
 * arpeggio, the CAGED shapes. Only those the library plays.
 */
export function exercisePositions(subject: ExerciseSubject): ExercisePosition[] {
    const caged = CAGED.map((letter) => ({ label: `${letter} shape`, shape: letter }))
    const list: ExercisePosition[] = []
    if ('scale' in subject.notes && subject.size === 5) {
        for (let n = 1; n <= 5; n++) list.push({ label: `Box ${n}`, position: n })
    }
    list.push(...caged)
    if ('scale' in subject.notes && subject.size >= 6) {
        const set = scaleNoteSet(subject.notes.scale)
        const count = set ? positionCount(set, '3nps') : 0
        for (let n = 1; n <= count; n++)
            list.push({ label: `3NPS ${n}`, shape: '3nps', position: n })
    }
    return list.filter((at) => plays(subject, at))
}

/**
 * Where the choice starts: the note's own shape ("Box 3", "CAGED E", "E-shape barre", "A",
 * "3NPS") when it is one of the positions, else the first.
 */
export function defaultPosition(positions: ExercisePosition[], shape: unknown): number {
    const text = textOf(shape)
    const box = /^box\s*(\d+)$/i.exec(text)
    const letter = cagedShape(text)
    const nps = /^3\s*nps(?:\s*(\d+))?$/i.exec(text)
    const found = positions.findIndex((at) =>
        box
            ? at.label === `Box ${box[1]}`
            : letter
              ? at.shape === letter
              : nps
                ? at.label === `3NPS ${nps[1] ?? 1}`
                : false
    )
    return Math.max(0, found)
}

/** The note's current BPM as the tab's tempo: a whole number from 20 to 240, else none. */
export function exerciseTempo(bpm: unknown): number | undefined {
    const value = Number(textOf(bpm))
    return Number.isInteger(value) && value >= 20 && value <= 240 ? value : undefined
}

const optionsOf = (at: ExercisePosition, choice?: ExerciseChoice) => ({
    ...(at.position !== undefined ? { position: at.position } : {}),
    ...(at.shape ? { shape: at.shape } : {}),
    ...(choice ? { direction: choice.direction, rhythm: choice.rhythm } : {}),
    ...(choice?.tempo !== undefined ? { tempo: choice.tempo } : {})
})

/** The ```tab block of the run; throws the library's message when it can't be played. */
export function exerciseBlock(
    subject: ExerciseSubject,
    at: ExercisePosition,
    choice: ExerciseChoice
): string {
    return '```tab\n' + exerciseTab(subject.notes, optionsOf(at, choice)) + '\n```'
}

const DIRECTION: Record<ExerciseDirection, string> = { up: 'up', down: 'down', both: 'up-down' }

/** The same run as a ```fretboard block with `exercise:`: the diagram and its tab (the preview). */
export function exerciseFretboard(
    subject: ExerciseSubject,
    at: ExercisePosition,
    choice: ExerciseChoice
): string {
    return [
        'scale' in subject.notes
            ? `scale: ${subject.notes.scale}`
            : `arpeggio: ${subject.notes.arpeggio}`,
        ...(at.shape ? [`shape: ${at.shape}`] : []),
        ...(at.position !== undefined ? [`position: ${at.position}`] : []),
        `exercise: ${DIRECTION[choice.direction]}`,
        `rhythm: ${choice.rhythm}`,
        ...(choice.tempo !== undefined ? [`tempo: ${choice.tempo}`] : [])
    ].join('\n')
}
