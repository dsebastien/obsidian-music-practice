/**
 * Simplify this chart (#68): what a piece's chord chart becomes with easier chords and its best
 * capo (the library's `easierChart`), the chart with those options switched on, and a simpler
 * copy of it. Pure: no Obsidian imports.
 */
import {
    chordInNaming,
    easierChart,
    lettersInBlock,
    parseChordPro
} from '@dsebastien/music-notation'
import type { CapoChoice, Naming } from '@dsebastien/music-notation'
import { inLetters } from './block-letters'

/** A chord chart of a note: its block and where its body is in the note's text. */
export interface NoteChart {
    /** The body as written, without the fence lines. */
    body: string
    /** Where the body starts and ends in the text. */
    from: number
    to: number
    /** Where the whole block ends (after its closing fence). */
    end: number
    /** The fence that opens and closes the block ("```", "~~~~"). */
    fence: string
}

/** The chord charts (```chords or ~~~chords fences) of a note's text, in order. */
export function noteCharts(text: string): NoteChart[] {
    const charts: NoteChart[] = []
    // The closing fence ends the block: the blank lines after it are the note's.
    const fence = /^(`{3,}|~{3,})[ \t]*chords\b[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm
    let m: RegExpExecArray | null
    while ((m = fence.exec(text))) {
        const from = m.index + m[0].indexOf('\n') + 1
        charts.push({
            body: m[2]!,
            from,
            to: from + m[2]!.length,
            end: m.index + m[0].length,
            fence: m[1]!
        })
    }
    return charts
}

/** What Simplify this chart offers for a chart. */
export interface SimplerChart {
    /** The chart's title, when it has one. */
    title: string | null
    /** The chords with an easier one, as the chart shows them. */
    easier: { from: string; to: string }[]
    /**
     * The best capo for the chart's chords (the easier ones), with the shapes to play. Null when
     * no capo does better, when the chart has a capo already, or on a piano chart.
     */
    capo: CapoChoice | null
    /** The capo the chart writes itself (`{capo: 2}`): its chords are shapes already. */
    ownCapo: number | null
    /** Whether the chart asks for them already. */
    simplifyOn: boolean
    capoAutoOn: boolean
    piano: boolean
    /** The chart's own naming (`{naming: solfege}`); null when it has none. */
    naming: Naming | null
}

/** A chart's own naming (its `{naming: …}` line); null without one, or with one that doesn't read. */
export function chartNaming(body: string): Naming | null {
    try {
        return lettersInBlock('chords', body).naming
    } catch {
        return null
    }
}

/** What a chart's easier version is; null when the chart has no chord. */
export function simplerChart(body: string): SimplerChart | null {
    const song = parseChordPro(inLetters('chords', body))
    const chords = song.sections.some((section) =>
        section.lines.some(
            (line) => line.kind === 'lyrics' && line.segments.some((s) => s.chord !== null)
        )
    )
    if (!chords) return null
    const easy = easierChart(song, { simplify: true, capo: song.capo === null })
    return {
        title: song.title,
        easier: easy.easier,
        capo: easy.capo && easy.capo.capo > 0 ? easy.capo : null,
        ownCapo: song.capo,
        simplifyOn: song.simplify === true,
        capoAutoOn: song.capoAuto === true,
        piano: song.instrument === 'piano',
        naming: chartNaming(body)
    }
}

/** Whether Simplify this chart has something to offer for a chart. */
export const offersSomething = (chart: SimplerChart): boolean =>
    chart.easier.length > 0 || chart.capo !== null

const DIRECTIVE = (name: string) =>
    new RegExp(`^[ \\t]*\\{[ \\t]*${name}\\b[^}\\n]*\\}[ \\t]*$`, 'i')
const SIMPLIFY = DIRECTIVE('simplify')
const CAPO = DIRECTIVE('capo')
const TRANSPOSE = DIRECTIVE('transpose')
const KEY = DIRECTIVE('key')

/**
 * The chart with its options switched on: `{simplify}` when it has easier chords, `{capo: auto}`
 * when a capo does better. The lines go at the top; a `{simplify: …}` or `{capo: auto}` the chart
 * has already is replaced. The rest of the chart is as written.
 */
export function withOptionsOn(body: string, chart: SimplerChart): string {
    const simplify = chart.easier.length > 0
    const capo = chart.capo !== null
    const kept = body
        .split('\n')
        .filter((line) => !(simplify && SIMPLIFY.test(line)))
        .filter((line) => !(capo && CAPO.test(line)))
    const added = [...(simplify ? ['{simplify}'] : []), ...(capo ? ['{capo: auto}'] : [])]
    return [...added, ...kept].join('\n')
}

/**
 * A simpler copy of the chart, written out: its chords are the easier ones, or the shapes of the
 * best capo with a `{capo: N}` line. The copy is in the chart's own naming: a chord that changes
 * is written in it, the others stay as written, and its `{naming: …}` line stays. Tab and grid
 * sections stay as written.
 */
export function simplerCopy(body: string): string {
    const naming = chartNaming(body) ?? 'letters'
    const song = parseChordPro(inLetters('chords', body))
    const easy = easierChart(song, { simplify: true, capo: song.capo === null })
    const capo = easy.capo && easy.capo.capo > 0 ? easy.capo.capo : null
    /** A chord as the chart writes it → as the copy writes it; null when it stays. */
    const renamed = (written: string): string | null => {
        // As the library reads it: in letters.
        const letters = naming === 'letters' ? written : chordInLetters(written, naming)
        const next = easy.renames.get(letters) ?? easy.renames.get(letters.trim())
        return next === undefined ? null : chordInNaming(next, naming)
    }
    let verbatim = false
    const lines: string[] = []
    for (const line of body.split('\n')) {
        const directive = /^[ \t]*\{[ \t]*([\w-]+)/.exec(line)?.[1]?.toLowerCase()
        if (directive) {
            if (/^(start_of_(tab|grid)|sot|sog)$/.test(directive)) verbatim = true
            if (/^(end_of_(tab|grid)|eot|eog)$/.test(directive)) verbatim = false
            // Written out in the copy: the switches go, and with a capo its line and the song's
            // transposition, which the chords now hold.
            if (SIMPLIFY.test(line)) continue
            if (capo !== null && (CAPO.test(line) || TRANSPOSE.test(line))) continue
            if (CAPO.test(line) && /auto/i.test(line)) continue
            if (capo !== null && KEY.test(line) && easy.key) {
                lines.push(`{key: ${chordInNaming(easy.key, naming)}}`)
                continue
            }
            lines.push(line)
            continue
        }
        if (verbatim || /^\s*#/.test(line)) {
            lines.push(line)
            continue
        }
        lines.push(
            line.replace(/\[([^\]\n]*)\]/g, (whole: string, chord: string) => {
                const next = renamed(chord)
                return next === null ? whole : `[${next}]`
            })
        )
    }
    if (capo === null) return lines.join('\n')
    // After the title lines, where a reader looks for it.
    const head = lines.findIndex(
        (line) => !/^[ \t]*\{[ \t]*(title|t|subtitle|st|artist|naming)\b/i.test(line)
    )
    const at = head === -1 ? lines.length : head
    return [...lines.slice(0, at), `{capo: ${capo}}`, ...lines.slice(at)].join('\n')
}

/** A chord written in a chart's naming, in letters, as the library reads a chart's brackets. */
function chordInLetters(written: string, naming: Naming): string {
    try {
        const read = lettersInBlock('chords', `{naming: ${naming}}\n[${written}]`).text
        return /\[([^\]\n]*)\]/.exec(read)?.[1] ?? written
    } catch {
        return written
    }
}

/** The note's text with a chart's body replaced; null when the chart is no longer as it was. */
export function replaceChart(
    text: string,
    index: number,
    was: string,
    body: string
): string | null {
    const chart = noteCharts(text)[index]
    if (!chart || chart.body !== was) return null
    return `${text.slice(0, chart.from)}${body}${text.slice(chart.to)}`
}

/**
 * The note's text with a new chart after one of its charts, in a block of the same fence; null
 * when that chart is no longer as it was.
 */
export function insertChartAfter(
    text: string,
    index: number,
    was: string,
    body: string
): string | null {
    const chart = noteCharts(text)[index]
    if (!chart || chart.body !== was) return null
    const block = `\n\n${chart.fence}chords\n${body}${body.endsWith('\n') ? '' : '\n'}${chart.fence}`
    return `${text.slice(0, chart.end)}${block}${text.slice(chart.end)}`
}
