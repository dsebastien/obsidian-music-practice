import { describe, expect, it } from 'bun:test'
import {
    chartNaming,
    insertChartAfter,
    noteCharts,
    offersSomething,
    replaceChart,
    simplerChart,
    simplerCopy,
    withOptionsOn
} from './simpler-chart'

const BODY = '{title: Song}\n[Cmaj9]Hello [G5]world [Am7]again [E9]end\n'
const NOTE = `# Piece\n\nIntro.\n\n\`\`\`chords\n${BODY}\`\`\`\n\nAfter.\n`

describe('noteCharts', () => {
    it("finds a note's chord charts with where their bodies are", () => {
        const text = `${NOTE}\n~~~~chords\n[A]One\n~~~~\n\n\`\`\`chord\nA x02220\n\`\`\`\n`
        const charts = noteCharts(text)
        expect(charts.map((c) => c.body)).toEqual([BODY, '[A]One\n'])
        expect(charts.map((c) => c.fence)).toEqual(['```', '~~~~'])
        for (const c of charts) expect(text.slice(c.from, c.to)).toBe(c.body)
        expect(text.slice(charts[0]!.end - 3, charts[0]!.end)).toBe('```')
        expect(noteCharts('No chart here.')).toEqual([])
    })
})

describe('simplerChart', () => {
    it('says which chords have an easier one', () => {
        const chart = simplerChart(BODY)!
        expect(chart.title).toBe('Song')
        expect(chart.easier).toEqual([
            { from: 'Cmaj9', to: 'Cmaj7' },
            { from: 'G5', to: 'G' },
            { from: 'E9', to: 'E7' }
        ])
        expect([chart.simplifyOn, chart.capoAutoOn, chart.ownCapo, chart.piano]).toEqual([
            false,
            false,
            null,
            false
        ])
        expect(offersSomething(chart)).toBe(true)
    })

    it('gives the best capo with the shapes to play, only when a capo does better', () => {
        const capo = simplerChart('[Bb]One [Eb]two [F]three [Gm]four')!
        expect(capo.easier).toEqual([])
        expect(capo.capo!.capo).toBe(3)
        expect(capo.capo!.shapes.map((s) => s.shape)).toEqual(['G', 'C', 'D', 'Em'])
        expect(capo.capo!.open).toBe(4)
        const open = simplerChart('[G]One [C]two [D]three [Em]four')!
        expect(open.capo).toBeNull()
        expect(offersSomething(open)).toBe(false)
    })

    it('offers no capo for a chart that writes its own: its chords are shapes already', () => {
        const own = simplerChart('{capo: 2}\n[Bb]One [Eb]two [F]three [Gm]four')!
        expect(own.ownCapo).toBe(2)
        expect(own.capo).toBeNull()
    })

    it('says what the chart asks for already', () => {
        const on = simplerChart(`{simplify}\n{capo: auto}\n${BODY}`)!
        expect([on.simplifyOn, on.capoAutoOn]).toEqual([true, true])
        // What it offers is the same: the chart's own wishes don't hide it.
        expect(on.easier.map((c) => c.to)).toEqual(['Cmaj7', 'G', 'E7'])
    })

    it('offers nothing for a piano chart, and gives null for a chart without a chord', () => {
        const piano = simplerChart(`{instrument: piano}\n${BODY}`)!
        expect(piano.piano).toBe(true)
        expect(offersSomething(piano)).toBe(false)
        expect(simplerChart('{title: Words}\nJust lyrics')).toBeNull()
        expect(simplerChart('')).toBeNull()
    })

    it('reads a chart written in another naming, and says which', () => {
        const solfege = simplerChart('{naming: solfege}\n[Domaj9]Hello [Sol5]world')
        expect(solfege?.easier.map((c) => c.to)).toEqual(['Cmaj7', 'G'])
        expect(solfege?.naming).toBe('solfege')
        expect(simplerChart(BODY)?.naming).toBeNull()
        expect(chartNaming('{naming: german}\n[H7]la')).toBe('german')
        expect(chartNaming('{naming: klingon}\n[C]la')).toBeNull()
    })
})

describe('withOptionsOn', () => {
    it('adds only the options that change something, at the top, and keeps the rest as written', () => {
        expect(withOptionsOn(BODY, simplerChart(BODY)!)).toBe(`{simplify}\n${BODY}`)
        const capo = '[Bb]One [Eb]two [F]three [Gm]four'
        expect(withOptionsOn(capo, simplerChart(capo)!)).toBe(`{capo: auto}\n${capo}`)
        const both = '[Bbmaj9]One [Eb]two [F]three [Gm]four'
        const chart = simplerChart(both)!
        expect(chart.easier.length).toBeGreaterThan(0)
        expect(chart.capo).not.toBeNull()
        expect(withOptionsOn(both, chart)).toBe(`{simplify}\n{capo: auto}\n${both}`)
    })

    it('replaces a switch the chart has already, and never writes one twice', () => {
        const off = `{simplify: no}\n${BODY}`
        expect(withOptionsOn(off, simplerChart(off)!)).toBe(`{simplify}\n${BODY}`)
        const once = withOptionsOn(BODY, simplerChart(BODY)!)
        expect(withOptionsOn(once, simplerChart(once)!)).toBe(once)
    })
})

describe('simplerCopy', () => {
    it('writes the easier chords out, and nothing else changes', () => {
        expect(simplerCopy(BODY)).toBe('{title: Song}\n[Cmaj7]Hello [G]world [Am7]again [E7]end\n')
        // The switches are written out too.
        expect(simplerCopy(`{simplify}\n${BODY}`)).toBe(
            '{title: Song}\n[Cmaj7]Hello [G]world [Am7]again [E7]end\n'
        )
    })

    it('writes the shapes of the best capo, with its line after the title', () => {
        expect(simplerCopy('{title: Song}\n{artist: Me}\n[Bb]One [Eb]two [F]three [Gm]four')).toBe(
            '{title: Song}\n{artist: Me}\n{capo: 3}\n[G]One [C]two [D]three [Em]four'
        )
        expect(simplerCopy('{capo: auto}\n[A]One [D]two [E]three [F#m]four')).toBe(
            '{capo: 2}\n[G]One [C]two [D]three [Em]four'
        )
    })

    it("takes the song's transposition into the chords with a capo, and into the key", () => {
        expect(simplerCopy('{key: G}\n{transpose: 2}\n[G]One [C]two [D]three [Em]four')).toBe(
            '{capo: 2}\n{key: A}\n[G]One [C]two [D]three [Em]four'
        )
    })

    it('leaves a chart with its own capo, comments, and tab sections as written', () => {
        const own = '{capo: 2}\n[Bb]One [Eb]two'
        expect(simplerCopy(own)).toBe(own)
        const tab = '# [G5] in a comment\n{sot}\ne|--[3]--|\n{eot}\n[G5]Hello'
        expect(simplerCopy(tab)).toBe('# [G5] in a comment\n{sot}\ne|--[3]--|\n{eot}\n[G]Hello')
    })

    it("writes the copy in the chart's own naming, and keeps its naming line", () => {
        // A chord that changes is written in the naming; one that stays is as written.
        expect(simplerCopy('{naming: solfege}\n[Domaj9]Hello [Sol5]world [La m7]end')).toBe(
            '{naming: solfege}\n[Do maj7]Hello [Sol]world [La m7]end'
        )
        // German: H is B and B is B flat, read before the capo is found.
        expect(
            simplerCopy('{naming: german}\n{title: Lied}\n[H]Eins [E]zwei [F#]drei [G#m]vier')
        ).toBe('{naming: german}\n{title: Lied}\n{capo: 4}\n[G]Eins [C]zwei [D]drei [Em]vier')
        expect(simplerCopy('{naming: german}\n[Hmaj9]Eins [B5]zwei')).toBe(
            '{naming: german}\n{capo: 4}\n[Gmaj7]Eins [Gb5]zwei'
        )
        const capo = simplerCopy(
            '{naming: solfege}\n{title: Chanson}\n[Si♭]Un [Mi♭]deux [Fa]trois [Sol m]quatre'
        )
        expect(capo).toBe(
            '{naming: solfege}\n{title: Chanson}\n{capo: 3}\n[Sol]Un [Do]deux [Ré]trois [Mi m]quatre'
        )
        // The copy reads as the same easier chart.
        expect(simplerChart(capo)?.ownCapo).toBe(3)
    })
})

describe('writing into the note', () => {
    it('replaces a chart, or adds one after it, only while the chart is as it was', () => {
        const replaced = replaceChart(NOTE, 0, BODY, `{simplify}\n${BODY}`)!
        expect(noteCharts(replaced)[0]!.body).toBe(`{simplify}\n${BODY}`)
        expect(replaced.startsWith('# Piece\n\nIntro.')).toBe(true)
        expect(replaced.endsWith('After.\n')).toBe(true)
        const added = insertChartAfter(NOTE, 0, BODY, '[C]Copy')!
        expect(noteCharts(added).map((c) => c.body)).toEqual([BODY, '[C]Copy\n'])
        expect(added.endsWith('After.\n')).toBe(true)
        expect(added).toContain('```\n\n```chords\n[C]Copy\n```\n\nAfter.')
        // Changed since, or gone: nothing is written.
        expect(replaceChart(NOTE, 0, 'other', 'x')).toBeNull()
        expect(replaceChart(NOTE, 3, BODY, 'x')).toBeNull()
        expect(insertChartAfter(NOTE.replace('Hello', 'Hi'), 0, BODY, 'x')).toBeNull()
    })

    it('keeps the fence of the chart it copies', () => {
        const tilde = `~~~~chords\n${BODY}~~~~\n`
        expect(insertChartAfter(tilde, 0, BODY, '[C]Copy')).toBe(
            `~~~~chords\n${BODY}~~~~\n\n~~~~chords\n[C]Copy\n~~~~\n`
        )
    })
})
