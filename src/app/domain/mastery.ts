/**
 * The mastery scale shared by every learning domain. The numbers and their roles are fixed; each
 * note type names its own levels (music: "20 - Learning", languages: "20 - Recognize"…), so the
 * engine only ever reads the number in front of a status value.
 */
export const LEVEL = {
    WANT: 10,
    LEARNING: 20,
    SLOW: 30,
    TEMPO: 40,
    RUSTY: 50,
    MASTERED: 60
} as const

export type Level = (typeof LEVEL)[keyof typeof LEVEL]

/** The priority number used when the priority is TBD or missing. */
export const PRIORITY_TBD = 99

/** The leading number of a numbered value ("20 - Learning" → 20); null when there is none. */
export function levelOf(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const match = /^\s*(\d+)\b/.exec(value)
    return match ? Number(match[1]) : null
}

/** Learning, Can play slowly, Can play at tempo, Rusty: the levels practice works on. */
export const isActiveLevel = (level: number | null): boolean =>
    level !== null && level >= LEVEL.LEARNING && level <= LEVEL.RUSTY

/** The status value of a type for a level, from the type's own values ("50 - Rusty"); null when absent. */
export function labelFor(level: number, values: readonly string[]): string | null {
    return values.find((v) => levelOf(v) === level) ?? null
}
