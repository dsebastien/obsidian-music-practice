/**
 * Default layout of notation diagrams: orientation per kind of diagram, left-handed (#32), and how
 * note names show.
 */
import type { LayoutDefaults, Naming, Orientation, RenderOptions } from '@dsebastien/music-notation'

/** How diagrams are drawn unless a block says otherwise (#32). */
export interface NotationLayout {
    /** Mirror guitar chord diagrams and fretboards. */
    leftHanded: boolean
    chord: Orientation
    fretboard: Orientation
    keyboard: Orientation
    /** How note names show (display only, music-notation #12). */
    naming: Naming
}

/** The render options the layout settings give the library. */
export type RenderDefaults = LayoutDefaults & Pick<RenderOptions, 'naming'>

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
        ...(layout.naming !== 'letters' ? { naming: layout.naming } : {})
    }
}
