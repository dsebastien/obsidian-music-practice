import type { App } from 'obsidian'
import { labelFor } from '../domain/mastery'
import type { NoteModel } from '../domain/note-model'
import type { LearningItem } from '../domain/practice'
import { t } from '../i18n/i18n'

/** The item's mastery as its type names it ("30 - Can play slowly"), or the bare level. */
export function masteryLabel(model: NoteModel, item: LearningItem): string {
    if (item.level === null) return t('panel.item.noMastery')
    const type = model.learningTypes.find((t) => t.id === item.typeId)
    return (type && labelFor(item.level, type.statusValues)) ?? String(item.level)
}

/** The label without its number ("Can play slowly"). */
const plain = (label: string) => label.replace(/^\s*\d+\s*-\s*/, '')

/** Mastery badge, colored by level. */
export function renderBadge(parent: HTMLElement, model: NoteModel, item: LearningItem): void {
    const badge = parent.createSpan({ cls: 'mp-badge', text: plain(masteryLabel(model, item)) })
    if (item.level !== null) badge.dataset['level'] = String(item.level)
}

/** Review, focus and BPM indicators, and a short practiced line. */
export function renderMeta(parent: HTMLElement, item: LearningItem, extra: string[] = []): void {
    const meta = parent.createDiv({ cls: 'mp-item-meta' })
    if (item.review === 'overdue')
        meta.createSpan({ cls: 'mp-pill mp-pill-overdue', text: t('panel.item.reviewOverdue') })
    if (item.review === 'due-soon')
        meta.createSpan({ cls: 'mp-pill mp-pill-due', text: t('panel.item.reviewDueSoon') })
    if (item.focus) meta.createSpan({ cls: 'mp-pill mp-pill-focus', text: t('panel.item.focus') })
    meta.createSpan({
        text:
            item.daysSincePracticed === null
                ? t('panel.item.neverPracticed')
                : item.daysSincePracticed === 0
                  ? t('panel.item.practicedToday')
                  : t('panel.item.practicedAgo', { days: item.daysSincePracticed })
    })
    if (item.bpmProgress !== null) {
        const bar = meta.createDiv({
            cls: 'mp-progress',
            attr: { title: t('panel.item.bpmProgress', { percent: item.bpmProgress }) }
        })
        bar.createDiv({ cls: 'mp-progress-bar' }).setCssProps({
            width: `${Math.min(item.bpmProgress, 100)}%`
        })
        meta.createSpan({
            text: t('panel.item.bpmCurrent', {
                current: item.bpmCurrent ?? 0,
                target: item.bpmTarget ?? 0
            })
        })
    }
    for (const e of extra) meta.createSpan({ text: e })
}

/** Open the item's note (in a new tab with Ctrl/Cmd). */
export function linkTo(app: App, el: HTMLElement, item: LearningItem): void {
    // A real link target, so the keyboard reaches it and hover previews work.
    el.setAttr('href', item.path)
    el.setAttr('data-href', item.path)
    el.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        void app.workspace.openLinkText(item.path, '', event.ctrlKey || event.metaKey)
    })
}

/** One item card: name (opens the note), mastery badge, optional minutes, and its state. */
export function renderItemRow(
    app: App,
    parent: HTMLElement,
    model: NoteModel,
    item: LearningItem,
    options: { minutes?: number; extra?: string[] } = {}
): HTMLElement {
    const row = parent.createDiv({ cls: 'mp-item' })
    const head = row.createDiv({ cls: 'mp-item-head' })
    const name = head.createEl('a', { cls: 'mp-item-name internal-link', text: item.name })
    linkTo(app, name, item)
    renderBadge(head, model, item)
    if (options.minutes !== undefined)
        head.createSpan({
            cls: 'mp-item-minutes',
            text: t('panel.item.minutes', { minutes: options.minutes })
        })
    renderMeta(row, item, options.extra)
    return row
}
