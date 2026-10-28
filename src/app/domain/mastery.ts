import { DEFAULT_RULES } from './rules'
import type { PracticeRules } from './rules'

/**
 * The mastery scale. Each note type names its own levels (music: "20 - Learning", languages:
 * "20 - Recognize"…), so the engine only ever reads the number in front of a status value; which
 * number means what comes from the rules (`rules.levels`).
 */

/** The leading number of a numbered value ("20 - Learning" → 20); null when there is none. */
export function levelOf(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const match = /^\s*(\d+)\b/.exec(value)
    return match ? Number(match[1]) : null
}

/** From Learning to Rusty: the levels practice works on. */
export const isActiveLevel = (
    level: number | null,
    rules: PracticeRules = DEFAULT_RULES
): boolean => level !== null && level >= rules.levels.learning && level <= rules.levels.rusty

/** The status value of a type for a level, from the type's own values ("50 - Rusty"); null when absent. */
export function labelFor(level: number, values: readonly string[]): string | null {
    return values.find((v) => levelOf(v) === level) ?? null
}
