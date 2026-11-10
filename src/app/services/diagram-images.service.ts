/**
 * Save a diagram, or a whole block, as a PNG or SVG file in the vault (#51): the right-click menu
 * on a drawn notation block, the image (the library's export), the file, and the optional link
 * after the block.
 */
import { Menu, Notice } from 'obsidian'
import type { App, TFile } from 'obsidian'
import { toPng, toSvgString } from '@dsebastien/music-notation'
import {
    blockImageName,
    imageFileName,
    numberedPath,
    withEmbedAfter
} from '../domain/diagram-images'
import type { ImageFormat } from '../domain/diagram-images'
import type { DiagramImageSettings } from '../types/plugin-settings.intf'
import type { BlockMenuRequest } from './notation.service'

export interface DiagramImagesHost {
    app: Pick<App, 'vault' | 'fileManager'>
    settings: () => DiagramImageSettings
}

/** An element, from any window (a popout's elements aren't this window's `Element`). */
const isElement = (x: unknown): x is Element =>
    typeof x === 'object' && x !== null && 'closest' in x && typeof x.closest === 'function'

const FORMATS: readonly ImageFormat[] = ['png', 'svg']

/** The text of a drawing's visible title, else of its accessible name; empty without either. */
function titleOf(drawing: Element): string {
    const shown = drawing.querySelector('text.mn-title')?.textContent?.trim()
    if (shown) return shown
    return drawing.querySelector('title')?.textContent?.trim() ?? ''
}

/** A diagram's image: its captioned figure when it has one, else its playable wrapper or itself. */
function diagramImage(drawing: Element): Element {
    const wrap = drawing.parentElement?.closest('.mn-playable') ?? drawing
    const parent = wrap.parentElement
    return parent?.classList.contains('mn-captioned') ? parent : wrap
}

/** The note's name, from its path ("Music/Song.md" → "Song"). */
const noteNameOf = (path: string): string => (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '')

/** The background behind `el` on the page: its own or an ancestor's, else white. */
function pageBackground(el: Element): string {
    const win = el.ownerDocument.defaultView
    for (let at: Element | null = el; at && win; at = at.parentElement) {
        const color = win.getComputedStyle(at).backgroundColor
        if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) return color
    }
    return 'white'
}

export class DiagramImages {
    constructor(private readonly host: DiagramImagesHost) {}

    /** The menu of a right-click on a drawn block: save the diagram under the pointer, or the block. */
    readonly menu = (event: MouseEvent, request: BlockMenuRequest): void => {
        const target = isElement(event.target) ? event.target : null
        const block = target?.closest('.mn-block') ?? request.el.querySelector('.mn-block')
        if (!block || !request.el.contains(block)) return
        const drawings = [...block.querySelectorAll('svg.mn-svg')]
        if (!drawings.length && !block.textContent?.trim()) return
        const drawing = target?.closest('svg.mn-svg') ?? null
        const menu = new Menu()
        if (drawing && block.contains(drawing)) {
            const what = titleOf(drawing) || 'Diagram'
            for (const format of FORMATS) {
                menu.addItem((item) =>
                    item
                        .setTitle(`Save diagram as ${format.toUpperCase()}`)
                        .setIcon('image')
                        .onClick(() => void this.save(diagramImage(drawing), what, format, request))
                )
            }
        }
        if (!drawing || drawings.length > 1) {
            const what = blockImageName(drawings.map(titleOf), request.language)
            for (const format of FORMATS) {
                menu.addItem((item) =>
                    item
                        .setTitle(`Save block as ${format.toUpperCase()}`)
                        .setIcon('image')
                        .onClick(() => void this.save(block, what, format, request))
                )
            }
        }
        // Instead of the browser's menu and Obsidian's editor menu on the block.
        event.preventDefault()
        event.stopPropagation()
        menu.showAtMouseEvent(event)
    }

    /** Writes the image, says where, and puts the link after the block when the setting says so. */
    async save(
        image: Element,
        what: string,
        format: ImageFormat,
        request: BlockMenuRequest
    ): Promise<void> {
        const { vault, fileManager } = this.host.app
        const settings = this.host.settings()
        let file: TFile
        try {
            // Made first, while the drawing is on the page as it was clicked.
            const data =
                format === 'png'
                    ? await (await toPng(image, { scale: 2 })).arrayBuffer()
                    : // The page's colors need the page's background, as the PNG has: a dark
                      // theme's light lines on a transparent SVG vanish on a white page.
                      toSvgString(image, { background: pageBackground(image) })
            const name = imageFileName(noteNameOf(request.sourcePath), what, format)
            const path = settings.folder
                ? await this.inFolder(settings.folder, name, format)
                : await fileManager.getAvailablePathForAttachment(name, request.sourcePath)
            file =
                typeof data === 'string'
                    ? await vault.create(path, data)
                    : await vault.createBinary(path, data)
        } catch (error) {
            new Notice(
                `Couldn't save the image: ${error instanceof Error ? error.message : String(error)}`
            )
            return
        }
        if (!settings.embed) {
            new Notice(`Saved ${file.path}`)
            return
        }
        const added = await this.embed(file, request)
        new Notice(
            added
                ? `Saved ${file.path} and linked it after the block.`
                : `Saved ${file.path}. The link wasn't added: the block isn't where it was drawn (edit the note, then save again), or this isn't a note.`
        )
    }

    /** A free path in the folder, the folder (and its parents) made when missing. */
    private async inFolder(folder: string, name: string, format: ImageFormat): Promise<string> {
        const { vault } = this.host.app
        const parts = folder.split('/')
        for (let i = 1; i <= parts.length; i++) {
            const path = parts.slice(0, i).join('/')
            const found = vault.getAbstractFileByPath(path)
            if (!found) await vault.createFolder(path)
            else if (!('children' in found)) throw new Error(`"${path}" is a file, not a folder.`)
        }
        const base = name.slice(0, -(format.length + 1))
        return numberedPath(folder, base, format, (p) => vault.getAbstractFileByPath(p) !== null)
    }

    /** The link on its own line after the block; false when the block can't be found as drawn. */
    private async embed(file: TFile, request: BlockMenuRequest): Promise<boolean> {
        const { vault, fileManager } = this.host.app
        const section = request.section()
        const note = vault.getFileByPath(request.sourcePath)
        if (!section || !note || note.extension !== 'md') return false
        const link = `!${fileManager.generateMarkdownLink(file, request.sourcePath)}`
        let added = false
        await vault.process(note, (text) => {
            const next = withEmbedAfter(text, section, link)
            if (next === null) return text
            added = true
            return next
        })
        return added
    }
}
