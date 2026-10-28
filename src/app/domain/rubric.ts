/**
 * What each mastery level means, per kind of item. Shown when changing an item's mastery. Default
 * texts; configurable with the other rules (#27).
 */
export type Rubric = Record<number, string>

const CHORD: Rubric = {
    20: 'Shape known',
    30: 'Every string rings',
    40: 'Switches in time at the target BPM',
    60: 'From memory, with any transition'
}

const PIECE: Rubric = {
    20: 'Sections practiced separately',
    30: 'Full run-through, slowly',
    40: 'Full song at tempo, small mistakes',
    60: 'From memory, at tempo, in context'
}

const PATTERN: Rubric = {
    20: 'Pattern known',
    30: 'Clean at a slow BPM',
    40: 'Clean at the target BPM',
    60: 'From memory, in any position'
}

/** The rubric for a kind: chords, pieces (arrangements, works), patterns (scales, techniques, exercises). */
export function rubricFor(kind: string): Rubric {
    if (kind === 'chord') return CHORD
    if (kind === 'arrangement' || kind === 'piece' || kind === 'work') return PIECE
    return PATTERN
}
