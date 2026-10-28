import { SESSION_TAG_ROOT } from '../constants'
import type { FieldNames } from './fields'
import type { LearningType, NoteModel, SessionType } from './note-model'
import type { PracticeRules } from './rules'

/**
 * The plugin's own note model, used when the Obsidian Starter Kit isn't available (#4). Learning
 * types are inferred from the notes themselves: a `type/<domain>/<subject>/<kind>` tag (or
 * `type/<domain>/<kind>`) on notes whose status property holds a mastery level.
 */
export interface LocalModelSettings {
    /** Domains whose `type/<domain>/…` tags mark learning notes ("music"). */
    domains: string[]
    /** The mastery property of learning notes. */
    statusProperty: string
    /** Level names, by role; status values read `<number> - <name>` ("20 - Learning"). */
    levelNames: {
        want: string
        learning: string
        slow: string
        tempo: string
        rusty: string
        mastered: string
    }
    /** Priority number of the current focus (the highest priority). */
    topPriority: number
    /** Dates stamped on entering Learning and Mastered (empty: none). */
    startedField: string
    masteredField: string
    /** Folder of session notes; tokens {year} {month} {date} {domain} {subject} {Subject}. */
    sessionFolder: string
    /** Appended to session note names; same tokens. */
    sessionSuffix: string
    /** Optional template for new session notes (vault path). */
    sessionTemplate: string
}

export function createDefaultLocalModel(): LocalModelSettings {
    return {
        domains: ['music'],
        statusProperty: 'mastery',
        levelNames: {
            want: 'Want to learn',
            learning: 'Learning',
            slow: 'Can play slowly',
            tempo: 'Can play at tempo',
            rusty: 'Rusty',
            mastered: 'Mastered'
        },
        topPriority: 10,
        startedField: 'date_started',
        masteredField: 'date_mastered',
        sessionFolder: 'Practice sessions/{Subject}/{year}',
        sessionSuffix: ' ({Subject} Practice Session)',
        sessionTemplate: ''
    }
}

/** What the model needs to know about one note. */
export interface ObservedNote {
    tags: string[]
    /** The note's mastery level, when its status property holds one. */
    level: number | null
}

const titleCase = (s: string) =>
    s
        .replace(/_/g, ' ')
        .replace(/(^|\s)(\w)/g, (_m, sep: string, c: string) => sep + c.toUpperCase())

/** Status values from the rules' numbers and the level names: "20 - Learning"… */
export function localStatusValues(settings: LocalModelSettings, rules: PracticeRules): string[] {
    const { levels } = rules
    const names = settings.levelNames
    return (
        [
            [levels.want, names.want],
            [levels.learning, names.learning],
            [levels.slow, names.slow],
            [levels.tempo, names.tempo],
            [levels.rusty, names.rusty],
            [levels.mastered, names.mastered]
        ] as const
    ).map(([n, name]) => `${n} - ${name}`)
}

/** Expand the session folder or suffix tokens for a date and subject. */
export function expandTokens(
    pattern: string,
    date: string,
    domain: string,
    subject: string
): string {
    return pattern
        .replaceAll('{year}', date.substring(0, 4))
        .replaceAll('{month}', date.substring(5, 7))
        .replaceAll('{date}', date)
        .replaceAll('{domain}', domain)
        .replaceAll('{Subject}', titleCase(subject))
        .replaceAll('{subject}', subject)
}

/** Learning and session types inferred from the notes. */
export function buildLocalModel(
    notes: readonly ObservedNote[],
    settings: LocalModelSettings,
    rules: PracticeRules,
    fields: FieldNames
): NoteModel {
    const statusValues = localStatusValues(settings, rules)
    const stamps: Record<string, string> = {}
    if (settings.startedField) stamps[statusValues[1]!] = settings.startedField
    if (settings.masteredField) stamps[statusValues[5]!] = settings.masteredField
    const learningFields = new Set([
        ...(Object.values(fields) as string[]),
        settings.statusProperty,
        ...Object.values(stamps),
        'tags'
    ])
    const typeTags = new Set<string>()
    const domains = new Set(settings.domains.map((d) => d.trim().toLowerCase()).filter(Boolean))
    for (const note of notes) {
        if (note.level === null) continue
        for (const tag of note.tags) {
            if (!tag.startsWith('type/') || tag.startsWith(SESSION_TAG_ROOT)) continue
            const segments = tag.split('/')
            if (segments.length >= 3 && domains.has(segments[1]!)) typeTags.add(tag)
        }
    }
    const learningTypes: LearningType[] = [...typeTags].sort().map((typeTag) => {
        const segments = typeTag.split('/').slice(1)
        const domain = segments[0]!
        const kind = segments[segments.length - 1]!
        const subject = segments.length >= 3 ? segments[1]! : null
        return {
            id: `local:${typeTag}`,
            name: titleCase(`${subject ? `${subject} ` : ''}${kind}s`),
            typeTag,
            domain,
            subject,
            kind,
            tags: [typeTag],
            statusProperty: settings.statusProperty,
            statusValues,
            stamps,
            fields: learningFields,
            topPriority: settings.topPriority,
            templatePath: null,
            allowedValues: {}
        }
    })
    const subjects = new Map<string, { domain: string; subject: string }>()
    for (const t of learningTypes)
        if (t.subject)
            subjects.set(`${t.domain}/${t.subject}`, { domain: t.domain, subject: t.subject })
    const sessionFields = new Set([
        fields.date,
        fields.startTime,
        fields.timeSpent,
        fields.quality,
        fields.practiced,
        fields.activities,
        'tags'
    ])
    const sessionTypes: SessionType[] = [...subjects.values()].map(({ domain, subject }) => {
        const typeTag = `${SESSION_TAG_ROOT}${domain}/${subject}`
        return {
            id: `local:${typeTag}`,
            name: `${titleCase(subject)} Practice Sessions`,
            typeTag,
            domain,
            subject,
            tags: [typeTag],
            fields: sessionFields,
            templatePath: settings.sessionTemplate || null,
            allowedValues: {},
            naming: { folder: settings.sessionFolder, prefix: '', suffix: settings.sessionSuffix }
        }
    })
    return { learningTypes, sessionTypes }
}
