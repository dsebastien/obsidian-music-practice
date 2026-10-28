/**
 * What a new chord note gets from the notation library: its frets and fingers as text properties
 * and a ```chord block under the title.
 */
import { baseFretOf } from '@dsebastien/music-notation'
import type { FrettedVoicing } from '@dsebastien/music-notation'

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
 * Put a chord block in a new note: into the template's empty ```chord block when it has one,
 * else right under the title.
 */
export function placeChordBlock(content: string, block: string): string {
    // An empty block, blank lines and CRLF included.
    const empty = /^```chord[ \t]*\r?\n(?:[ \t]*\r?\n)*[ \t]*```[ \t]*$/m
    return empty.test(content)
        ? content.replace(empty, () => block)
        : insertUnderTitle(content, block)
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
