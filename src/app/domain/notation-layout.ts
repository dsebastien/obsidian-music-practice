/** Default layout of notation diagrams: orientation per kind of diagram, left-handed (#32). */
import type { LayoutDefaults, Orientation } from '@dsebastien/music-notation'

/** How diagrams are drawn unless a block says otherwise (#32). */
export interface NotationLayout {
    /** Mirror guitar chord diagrams and fretboards. */
    leftHanded: boolean
    chord: Orientation
    fretboard: Orientation
    keyboard: Orientation
}

export const ORIENTATIONS: readonly Orientation[] = ['vertical', 'horizontal']

/** The library's render defaults for the plugin's layout settings. */
export function layoutDefaults(layout: NotationLayout): LayoutDefaults {
    return {
        orientation: {
            chord: layout.chord,
            fretboard: layout.fretboard,
            keyboard: layout.keyboard
        },
        ...(layout.leftHanded ? { hand: 'left' as const } : {})
    }
}
