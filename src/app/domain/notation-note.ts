/**
 * What a new chord note gets from the notation library: its frets and fingers as text properties
 * and a ```chord block under the title.
 */
import {
    baseFretOf,
    detectChordFromFrets,
    detectChordFromPitches,
    listNoteSet,
    parseFrets
} from '@dsebastien/music-notation'
import type { DetectedChord } from '@dsebastien/music-notation'
import type { FrettedVoicing, PropertyNames } from '@dsebastien/music-notation'
import type { FieldNames } from './fields'

/** "x02220"; separated by dashes when a fret has two digits ("x-10-12-12-11-10"). */
export function formatFrets(frets: (number | null)[]): string {
    const parts = frets.map((f) => (f === null ? 'x' : String(f)))
    return parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('')
}

/** "x01230": x on muted strings, 0 where no finger presses. */
export function formatFingers(voicing: FrettedVoicing): string {
    const parts = voicing.frets.map((f, i) => (f === null ? 'x' : (voicing.fingers[i] ?? '0')))
    return parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('')
}

/** The ```chord block for a chord note: a guitar voicing, or a piano chord from its symbol. */
export function chordBlock(
    symbol: string,
    instrument: 'guitar' | 'piano',
    voicing: FrettedVoicing | null
): string | null {
    const lines = [`symbol: ${symbol}`]
    if (instrument === 'piano') lines.push('instrument: piano')
    else if (voicing) {
        lines.push(`frets: ${formatFrets(voicing.frets)}`, `fingers: ${formatFingers(voicing)}`)
        // Only when the diagram wouldn't pick the same first fret by itself.
        if (voicing.baseFret && voicing.baseFret !== baseFretOf(voicing.frets))
            lines.push(`position: ${voicing.baseFret}`)
    } else return null
    return ['```chord', ...lines, '```'].join('\n')
}

/**
 * Make sure a new note has an empty block of a language (```chord, ```fretboard, ```keyboard)
 * that draws from its properties: the template's when it has one, else one under the title.
 */
export function ensureBlock(content: string, language: string): string {
    const fence = new RegExp(`^\`\`\`${language}[ \\t]*\\r?$`, 'm')
    return fence.test(content) ? content : insertUnderTitle(content, `\`\`\`${language}\n\`\`\``)
}

/**
 * The voicings shown side by side when adding a guitar chord: the first `size`, plus the selected
 * one when it's further down the list (picked from the dropdown).
 */
export function voicingRow(count: number, selected: number, size = 4): number[] {
    const row = Array.from({ length: Math.min(count, size) }, (_, i) => i)
    if (selected >= size && selected < count) row.push(selected)
    return row
}

/** The source inside a fenced block (without its fences). */
export const blockSource = (block: string): string => block.split('\n').slice(1, -1).join('\n')

/** Insert a block right under the note's H1 (or after the frontmatter when there is none). */
export function insertUnderTitle(content: string, block: string): string {
    const eol = content.includes('\r\n') ? '\r\n' : '\n'
    const lines = content.split(/\r?\n/)
    let start = 0
    if (lines[0] === '---') {
        const end = lines.indexOf('---', 1)
        if (end > 0) start = end + 1
    }
    const h1 = lines.findIndex((line, i) => i >= start && /^# /.test(line))
    const at = h1 >= 0 ? h1 + 1 : start
    lines.splice(at, 0, ...block.split('\n'))
    return lines.join(eol)
}

/** The library's property names for empty notation blocks, from the plugin's settings. */
export const propertyNamesOf = (fields: FieldNames): Partial<PropertyNames> => ({
    chordSymbol: fields.chordSymbol,
    frets: fields.frets,
    fingers: fields.fingers,
    position: fields.position,
    pitches: fields.pitches,
    fingering: fields.fingering,
    scaleRoot: fields.scaleRoot,
    scaleType: fields.scaleType,
    shape: fields.shape,
    fingeringRight: fields.fingeringRight
})

/**
 * The chord a note's notes play: six frets for guitar notes, pitches for piano notes ("A3 C#4 E4",
 * or "A C# E" stacked upwards from middle C). Null when there's nothing to read or no chord fits.
 */
export function chordFromNotes(
    frets: string,
    pitches: string,
    subject: string | null
): DetectedChord | null {
    if (subject !== 'piano') {
        const parsed = frets ? parseFrets(frets) : null
        return parsed?.length === 6 ? detectChordFromFrets(parsed) : null
    }
    const set = pitches ? listNoteSet(pitches) : null
    if (!set) return null
    let previous = 59
    const midis =
        set.pitches ??
        set.members.map((m) => {
            let midi = 60 + m.chroma
            while (midi <= previous) midi += 12
            previous = midi
            return midi
        })
    return detectChordFromPitches(midis)
}
