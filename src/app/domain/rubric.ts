import type { PracticeRules } from './rules'

/**
 * What each mastery level means, per kind of item, shown when changing an item's mastery. Texts are
 * settings (#27), keyed by role so they follow the configured level numbers.
 */
export interface RubricTexts {
    learning: string
    slow: string
    tempo: string
    mastered: string
}

export interface RubricSettings {
    /** Chords. */
    chord: RubricTexts
    /** Arrangements, pieces, works. */
    piece: RubricTexts
    /** Scales, techniques, exercises and every other kind. */
    pattern: RubricTexts
}

export function createDefaultRubric(): RubricSettings {
    return {
        chord: {
            learning: 'Shape known',
            slow: 'Every string rings',
            tempo: 'Switches in time at the target BPM',
            mastered: 'From memory, with any transition'
        },
        piece: {
            learning: 'Sections practiced separately',
            slow: 'Full run-through, slowly',
            tempo: 'Full song at tempo, small mistakes',
            mastered: 'From memory, at tempo, in context'
        },
        pattern: {
            learning: 'Pattern known',
            slow: 'Clean at a slow BPM',
            tempo: 'Clean at the target BPM',
            mastered: 'From memory, in any position'
        }
    }
}

const PIECE_KINDS = new Set(['arrangement', 'piece', 'work'])

/** The rubric of a kind, by level number. */
export function rubricFor(
    kind: string,
    rubric: RubricSettings,
    rules: PracticeRules
): Record<number, string> {
    const texts =
        kind === 'chord' ? rubric.chord : PIECE_KINDS.has(kind) ? rubric.piece : rubric.pattern
    const { levels } = rules
    return {
        [levels.learning]: texts.learning,
        [levels.slow]: texts.slow,
        [levels.tempo]: texts.tempo,
        [levels.mastered]: texts.mastered
    }
}
