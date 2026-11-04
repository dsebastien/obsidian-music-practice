import { normalizePath } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { keyOf, prop } from '../domain/activity-time'
import { isoDate } from '../domain/dates'
import type { FieldNames } from '../domain/fields'
import { mergeTags, tagsOf } from '../domain/item-reader'
import { noteTypeSlug } from '../domain/note-model'
import type { SessionType } from '../domain/note-model'
import {
    activityForSessionType,
    closestActivities,
    proposedActivityName,
    sessionTypesOf,
    usesSessionTypes,
    withSessionType,
    withoutSessionType
} from '../domain/session-activities'
import type { ActivityNote } from '../domain/session-activities'
import { renderTemplate } from '../domain/template-render'
import {
    getNoteTypeStatus,
    isStarterKitAvailable,
    listNoteTypes,
    resolveNoteTypeAffixes,
    resolveNoteTypeFolder
} from './starter-kit.service'
import type { SkNoteType } from './starter-kit.service'

/** Activity notes carry this tag (or a child), as the Kanban Action Planner recognizes them. */
export const ACTIVITY_TAG = 'type/activity'

export interface ActivityContext {
    fields: FieldNames
    /** The proposed activity name for a subject; `{subject}` is replaced ("Learn {subject}"). */
    activityName: string
}

/**
 * The activity a session type counts for. `mapped`: the one activity whose `session_types` lists
 * the type. `fallback`: the vault doesn't use `session_types` (standalone, no Starter Kit): the
 * previous rules (the latest session's activity, else the note named after the activity setting).
 * `ask`: no activity lists the type (or several do): the user chooses, never the plugin.
 */
export type ActivityChoice =
    | { kind: 'mapped'; file: TFile }
    | { kind: 'fallback'; file: TFile | null }
    | {
          kind: 'ask'
          /** The session type's note type name ("guitar-practice-sessions"). */
          typeName: string
          /** The activities that list it, when several do. */
          conflict: TFile[]
          /** Every active activity, closest first. */
          candidates: TFile[]
          /** The name proposed for a new activity ("Learn Guitar"). */
          proposedName: string
      }

/** Characters a note name can't hold. */
const BAD_NAME = /[\\/:*?"<>|#^[\]]/

const isActivityTag = (tag: string, root: string): boolean =>
    tag === root || tag.startsWith(`${root}/`)

/** A type folder without its date tokens ("Activities/{{year}}" → "Activities"). */
const folderBase = (folder: string | null | undefined): string | null => {
    if (!folder) return null
    const cut = folder.split(/\{/)[0]!.replace(/\/+$/, '').trim()
    return cut ? normalizePath(cut) : null
}

/**
 * Finds activities, reads and writes their `session_types`, and creates a new activity when the
 * user asks for one. With the Obsidian Starter Kit, activities are the notes of its activities
 * type in that type's folder (archived ones live elsewhere and take no new sessions); without it,
 * every note tagged `type/activity` or a child tag.
 */
export class ActivityService {
    constructor(
        private readonly app: App,
        private readonly context: () => ActivityContext
    ) {}

    /** The Obsidian Starter Kit's activities type: named "activities", else tagged type/activity. */
    private starterKitType(): SkNoteType | null {
        if (!isStarterKitAvailable(this.app)) return null
        const types = listNoteTypes(this.app)
        const slug = (t: SkNoteType) => t.slug?.trim() || noteTypeSlug(t.name)
        return (
            types.find((t) => slug(t) === 'activities') ??
            types.find((t) =>
                (t.tags ?? []).some((g) => g.replace(/^#/, '').toLowerCase() === ACTIVITY_TAG)
            ) ??
            null
        )
    }

    /** The tag activity notes carry: the activities type's own `type/` tag, else type/activity. */
    private activityTag(type: SkNoteType | null): string {
        const own = (type?.tags ?? [])
            .map((g) => g.replace(/^#/, '').toLowerCase())
            .find((g) => g.startsWith('type/'))
        return own ?? ACTIVITY_TAG
    }

    /** The active activity notes. */
    activities(): { file: TFile; note: ActivityNote }[] {
        const type = this.starterKitType()
        const base = type ? folderBase(type.associatedFolder) : null
        const tag = this.activityTag(type)
        const cache = this.app.metadataCache
        const out: { file: TFile; note: ActivityNote }[] = []
        for (const file of this.app.vault.getMarkdownFiles()) {
            if (base !== null && !file.path.startsWith(`${base}/`)) continue
            const fm = cache.getFileCache(file)?.frontmatter
            if (!fm || !tagsOf(fm).some((t) => isActivityTag(t, tag))) continue
            out.push({ file, note: { path: file.path, name: file.basename, frontmatter: fm } })
        }
        return out
    }

    /** Which activity a session of this type counts for (see `ActivityChoice`). */
    choiceFor(session: SessionType): ActivityChoice {
        const { fields, activityName } = this.context()
        const activities = this.activities()
        const mapping = activityForSessionType(
            activities.map((a) => a.note),
            session.typeName,
            fields.sessionTypes
        )
        const fileOf = (note: ActivityNote) => activities.find((a) => a.note === note)!.file
        if (mapping.kind === 'mapped') return { kind: 'mapped', file: fileOf(mapping.activity) }
        if (mapping.kind === 'unmapped' && !this.usesSessionTypes())
            return { kind: 'fallback', file: this.fallback(session) }
        const proposedName = proposedActivityName(activityName, session.subject)
        return {
            kind: 'ask',
            typeName: session.typeName,
            conflict: mapping.kind === 'conflict' ? mapping.activities.map(fileOf) : [],
            candidates: closestActivities(
                activities.map((a) => a.file),
                proposedName,
                session.subject
            ),
            proposedName
        }
    }

    /**
     * Whether activities choose their sessions through `session_types`: always with the Obsidian
     * Starter Kit; without it, once any note lists a session type there.
     */
    usesSessionTypes(): boolean {
        if (isStarterKitAvailable(this.app)) return true
        const { fields } = this.context()
        const cache = this.app.metadataCache
        return usesSessionTypes(
            this.app.vault.getMarkdownFiles().map((f) => cache.getFileCache(f)?.frontmatter),
            fields.sessionTypes
        )
    }

    /**
     * The activity before `session_types` (standalone vaults): the one the latest session of that type
     * (by its date) linked to, else a note named after the activity pattern ("Learn Guitar"), or
     * "Learn Guitar (…)" when that note is tagged as an activity.
     */
    fallback(session: SessionType): TFile | null {
        const { fields, activityName } = this.context()
        const cache = this.app.metadataCache
        const sessions = this.app.vault
            .getMarkdownFiles()
            .map((f) => ({ f, fm: cache.getFileCache(f)?.frontmatter ?? {} }))
            .filter(({ fm }) => tagsOf(fm).includes(session.typeTag.toLowerCase()))
            .sort(
                (a, b) =>
                    String(b.fm[fields.date] ?? '').localeCompare(
                        String(a.fm[fields.date] ?? '')
                    ) || b.f.stat.ctime - a.f.stat.ctime
            )
        for (const { f } of sessions) {
            const link = cache
                .getFileCache(f)
                ?.frontmatterLinks?.find((l) => l.key.split('.')[0] === fields.activities)
            const target = link ? cache.getFirstLinkpathDest(link.link, f.path) : null
            if (target) return target
        }
        const wanted = proposedActivityName(activityName, session.subject).toLowerCase()
        const files = this.app.vault.getMarkdownFiles()
        const exact = files.filter((f) => f.basename.toLowerCase() === wanted)
        if (exact.length === 1) return exact[0]!
        const affixed = files.filter(
            (f) =>
                f.basename.toLowerCase().startsWith(`${wanted} (`) &&
                tagsOf(cache.getFileCache(f)?.frontmatter ?? {}).some((t) => /activit/.test(t))
        )
        return affixed.length === 1 ? affixed[0]! : null
    }

    /**
     * Record that a session type counts for this activity: add it to the activity's
     * `session_types`, and drop it from any other activity listing it (one activity per type).
     * Returns the activities it was moved from.
     */
    async mapSessionType(typeName: string, activity: TFile): Promise<TFile[]> {
        const { fields } = this.context()
        const key = fields.sessionTypes
        const others = this.activities()
            .filter(
                (a) =>
                    a.file.path !== activity.path &&
                    sessionTypesOf(a.note.frontmatter, key).includes(typeName)
            )
            .map((a) => a.file)
        for (const other of others)
            await this.app.fileManager.processFrontMatter(other, (fm: Record<string, unknown>) => {
                fm[keyOf(fm, key)] = withoutSessionType(prop(fm, key), typeName)
            })
        await this.app.fileManager.processFrontMatter(activity, (fm: Record<string, unknown>) => {
            const next = withSessionType(prop(fm, key), typeName)
            if (JSON.stringify(next) !== JSON.stringify(prop(fm, key))) fm[keyOf(fm, key)] = next
        })
        return others
    }

    /**
     * Where a new activity of this name goes, or why it can't be created. With the Obsidian Starter
     * Kit: its activities type's folder and name affixes (in a folder of its own when the existing
     * activities each have one); without it: the folder most activities live in.
     */
    newActivityPath(name: string): { path: string } | { error: string } {
        const clean = name.trim()
        if (!clean) return { error: 'Name the new activity.' }
        if (BAD_NAME.test(clean))
            return {
                error: `An activity name can't hold any of these: \\ / : * ? " < > | # ^ [ ].`
            }
        const type = this.starterKitType()
        const affixes = type ? resolveNoteTypeAffixes(this.app, type.id) : null
        const prefix = affixes && !affixes.prefixOptional ? affixes.prefix : ''
        const suffix = affixes && !affixes.suffixOptional ? affixes.suffix : ''
        const basename = `${prefix}${clean}${suffix}`
        const existing = this.activities()
        let folder =
            (type
                ? (resolveNoteTypeFolder(this.app, type.id, isoDate()) ??
                  folderBase(type.associatedFolder))
                : null) ?? mostCommonFolder(existing.map((a) => a.file.path))
        // Activities filed in a folder of their own name (the Starter Kit's activity template does).
        const own = existing.filter((a) => {
            const parts = a.file.path.split('/')
            const bare = a.file.basename.slice(
                prefix.length,
                a.file.basename.length - (suffix ? suffix.length : 0)
            )
            return parts.length >= 2 && parts[parts.length - 2] === bare
        })
        if (existing.length > 0 && own.length * 2 > existing.length)
            folder = folder ? `${folder}/${clean}` : clean
        const path = normalizePath(`${folder ? `${folder}/` : ''}${basename}.md`)
        if (
            this.app.vault.getAbstractFileByPath(path) ||
            this.app.metadataCache.getFirstLinkpathDest(basename, '')
        )
            return { error: `"${basename}" already exists: count the sessions for it instead.` }
        return { path }
    }

    /**
     * Create an activity (only on the user's request) that counts this session type: the Obsidian
     * Starter Kit's activities type (template, tags, an active status) when available, else a note
     * tagged type/activity.
     */
    async create(name: string, typeName: string): Promise<TFile> {
        const target = this.newActivityPath(name)
        if ('error' in target) throw new Error(target.error)
        const { fields } = this.context()
        const type = this.starterKitType()
        const path = target.path
        const basename = path.substring(path.lastIndexOf('/') + 1).replace(/\.md$/, '')
        const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
        if (folder && !this.app.vault.getAbstractFileByPath(folder))
            await this.app.vault.createFolder(folder)
        const template = type?.templatePath ? this.app.vault.getFileByPath(type.templatePath) : null
        const content = template
            ? renderTemplate(await this.app.vault.read(template), basename)
            : `---\n---\n# ${basename}\n`
        const file = await this.app.vault.create(path, content)
        const status = type ? getNoteTypeStatus(this.app, type.id) : null
        const active = status?.values.find((v) => v.role === 'active' && !v.done)?.value
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            fm['tags'] = mergeTags(
                fm['tags'],
                type?.tags?.length ? type.tags.map((g) => g.replace(/^#/, '')) : [ACTIVITY_TAG]
            )
            fm[keyOf(fm, fields.sessionTypes)] = withSessionType(
                prop(fm, fields.sessionTypes),
                typeName
            )
            if (status && active && !fm[status.property]) fm[status.property] = active
        })
        return file
    }
}

/** The folder most of these paths are in; '' (the vault root) when none. */
function mostCommonFolder(paths: readonly string[]): string {
    const counts = new Map<string, number>()
    for (const p of paths) {
        const folder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
        // A folder of the activity's own: count its parent.
        const parent = folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : ''
        const key = folder.endsWith(p.slice(p.lastIndexOf('/') + 1).replace(/\.md$/, ''))
            ? parent
            : folder
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}
