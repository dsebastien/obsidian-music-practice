/**
 * Every number the practice rules use. These are settings (#27); the defaults below apply on
 * install and are the values documented in Business Rules.
 */
export interface PracticeRules {
    /** The mastery scale, by number. Labels live on the note types. */
    levels: {
        want: number
        learning: number
        slow: number
        tempo: number
        rusty: number
        mastered: number
    }
    review: {
        /** Days; also the interval set when an item reaches `levels.slow`. */
        firstInterval: number
        maxInterval: number
        goodMultiplier: number
        /** Due soon within min(dueSoonMaxDays, interval / dueSoonDivisor) days of the interval. */
        dueSoonMaxDays: number
        dueSoonDivisor: number
    }
    score: {
        /** Priority points: `priorityBase` − priority number; `priorityUnknown` when TBD or missing. */
        priorityBase: number
        priorityUnknown: number
        /** Priority number meaning TBD. */
        priorityTbd: number
        stalenessNeverPracticed: number
        stalenessMaxDays: number
        stalenessIntervalCap: number
        stalenessIntervalWeight: number
        bpmGapDivisor: number
        perUnlock: number
        maxUnlocks: number
        rustyBonus: number
    }
    plan: {
        /** Warm-up, focus, review, fun in percent. */
        split: [number, number, number, number]
        minMinutesPerItem: number
        maxItemsPerBlock: number
        /** Kinds practiced in the warm-up block. */
        warmUpKinds: string[]
    }
}

export function createDefaultRules(): PracticeRules {
    return {
        levels: { want: 10, learning: 20, slow: 30, tempo: 40, rusty: 50, mastered: 60 },
        review: {
            firstInterval: 3,
            maxInterval: 90,
            goodMultiplier: 2,
            dueSoonMaxDays: 3,
            dueSoonDivisor: 3
        },
        score: {
            priorityBase: 70,
            priorityUnknown: 25,
            priorityTbd: 99,
            stalenessNeverPracticed: 30,
            stalenessMaxDays: 30,
            stalenessIntervalCap: 3,
            stalenessIntervalWeight: 10,
            bpmGapDivisor: 5,
            perUnlock: 3,
            maxUnlocks: 5,
            rustyBonus: 10
        },
        plan: {
            split: [15, 50, 20, 15],
            minMinutesPerItem: 5,
            maxItemsPerBlock: 3,
            warmUpKinds: ['technique', 'exercise']
        }
    }
}

/** The defaults, for reading and comparing. */
export const DEFAULT_RULES: PracticeRules = createDefaultRules()
