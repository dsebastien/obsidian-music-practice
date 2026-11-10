/**
 * Default layout of notation diagrams: orientation per kind of diagram, left-handed (#32), how
 * note names show, and how the root is marked.
 */
import type {
    LayoutDefaults,
    Naming,
    Orientation,
    RenderOptions,
    RootMark
} from '@dsebastien/music-notation'

/** How diagrams are drawn unless a block says otherwise (#32). */
export interface NotationLayout {
    /** Mirror guitar chord diagrams and fretboards. */
    leftHanded: boolean
    chord: Orientation
    fretboard: Orientation
    keyboard: Orientation
    /** How note names show (display only, music-notation #12). */
    naming: Naming
    /** The root by color only, or by color and a shape (music-notation #14). */
    rootMark: RootMark
}

/** The dropdown's labels for the root marks. */
export const ROOT_MARK_LABELS: Record<RootMark, string> = {
    color: 'Color',
    shape: 'Color and shape'
}

/** The render options the layout settings give the library. */
export type RenderDefaults = LayoutDefaults & Pick<RenderOptions, 'naming' | 'rootMark'>

export const ORIENTATIONS: readonly Orientation[] = ['vertical', 'horizontal']

/** The library's render defaults for the plugin's layout settings. */
export function layoutDefaults(layout: NotationLayout): RenderDefaults {
    return {
        orientation: {
            chord: layout.chord,
            fretboard: layout.fretboard,
            keyboard: layout.keyboard
        },
        ...(layout.leftHanded ? { hand: 'left' as const } : {}),
        // Letters are the library's default: no option, so letters output is unchanged.
        ...(layout.naming !== 'letters' ? { naming: layout.naming } : {}),
        // Color is the library's default: no option, so the output is unchanged.
        ...(layout.rootMark !== 'color' ? { rootMark: layout.rootMark } : {})
    }
}
