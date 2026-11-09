/**
 * Note names as the learner reads them (letters, solfège or German, music-notation #12). Display
 * only: notes, properties and answers stay in letters.
 */
import { chordInNaming, noteInNaming, type Naming } from '@dsebastien/music-notation'
import type { DrillKind, Question } from './note-drill'

/** The settings' words for each naming, in the library's order. */
export const NAMING_LABELS: Record<Naming, string> = {
    letters: 'Letters (C D E)',
    solfege: 'Solfège (Do Ré Mi)',
    german: 'German (H for B)'
}

const NOTE = /^([A-G](?:#|b|♯|♭){0,2})(-?\d+)?$/
const ROOT = /^([A-G](?:#|b|♯|♭){0,2})(\s.*)$/

/** A note, with or without its octave: `A#3` → `La♯3`; anything else as written. */
export function noteShown(name: string, naming: Naming): string {
    if (naming === 'letters') return name
    const m = NOTE.exec(name)
    if (!m) return name
    return `${noteInNaming(m[1]!, naming)}${m[2] ?? ''}`
}

/** A chord symbol: solfège `Ré m7`, German `H7`. */
export function chordShown(symbol: string, naming: Naming): string {
    return naming === 'letters' ? symbol : chordInNaming(symbol, naming)
}

/** A scale name by its root (`A minor pentatonic` → `La minor pentatonic`), its type as written. */
export function scaleShown(name: string, naming: Naming): string {
    if (naming === 'letters') return name
    const m = ROOT.exec(name)
    return m ? `${noteShown(m[1]!, naming)}${m[2]}` : name
}

/**
 * A question's prompt. Find questions are built again from their parts: a rewrite of the English
 * text would keep the "A" of "Find A on string 5" as an article.
 */
export function promptShown(q: Question, naming: Naming): string {
    if (naming === 'letters') return q.prompt
    switch (q.type) {
        case 'find-fret':
            return `Find ${noteShown(q.note, naming)} on string ${q.string}`
        case 'find-key':
            return `Find ${noteShown(q.spot, naming)}`
        case 'find-scale':
            return `Find the notes of ${scaleShown(q.spot, naming)}`
        default:
            return q.prompt
    }
}

/** The right answer, as the feedback says it ("It was Do."). */
export function expectedShown(q: Question, naming: Naming): string {
    if ('note' in q) return noteShown(q.note, naming)
    return q.type === 'name-chord' ? chordShown(q.spot, naming) : scaleShown(q.spot, naming)
}

/** A choice of a chord or scale question. */
export function choiceShown(q: Question, choice: string, naming: Naming): string {
    return q.type === 'name-chord' ? chordShown(choice, naming) : scaleShown(choice, naming)
}

/** A cell of the weak-spot map: a note (fretboard), a key, a chord or a scale. */
export function spotShown(kind: DrillKind, spot: string, naming: Naming): string {
    if (kind === 'chords') return chordShown(spot, naming)
    if (kind === 'scales') return scaleShown(spot, naming)
    return noteShown(spot, naming)
}
