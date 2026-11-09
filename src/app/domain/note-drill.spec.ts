import { describe, expect, it } from 'bun:test'
import {
    afterPick,
    drillFileTitle,
    pianoKeys,
    sameChord,
    sameScale,
    weakSlots,
    scalePick,
    startScale,
    type Question,
    CHORD_FAMILIES,
    chordOfName,
    chordsOfText,
    inFamily,
    libraryChords,
    libraryScales,
    missingFrom,
    scaleOf,
    scaleOfName,
    DEFAULT_DRILL_RULES,
    KIND_LABELS,
    choicesFor,
    drillTitle,
    formatStat,
    isRight,
    kindOfLabel,
    mergeStats,
    noteName,
    parseSetting,
    parseStats,
    questions,
    reviewResultOf,
    scoreOf,
    seededRandom,
    settingWords,
    spotsOf,
    weakSpots,
    type Answer,
    type DrillSetting,
    type SpotStat,
    drillDefaults
} from './note-drill'

const fretboard = (over: Partial<Extract<DrillSetting, { kind: 'fretboard' }>> = {}) =>
    ({ kind: 'fretboard', strings: [5], frets: [0, 5], ask: 'both', ...over }) as DrillSetting

describe('drill kinds and settings', () => {
    it('labels kinds as the vault stores them, and reads them back', () => {
        expect(KIND_LABELS).toEqual({
            'fretboard': 'Fretboard notes',
            'keyboard': 'Keyboard notes',
            'chords': 'Chord names',
            'scales': 'Scale shapes',
            'fretboard-ear': 'Fretboard by ear',
            'keyboard-ear': 'Keyboard by ear'
        })
        expect(kindOfLabel('Fretboard notes')).toBe('fretboard')
        expect(kindOfLabel(' scale shapes ')).toBe('scales')
        expect(kindOfLabel('Rhythm')).toBeNull()
        expect(kindOfLabel(3)).toBeNull()
    })

    it('says a setting in words, which name the drill note', () => {
        expect(settingWords(fretboard())).toBe('string 5, frets 0-5')
        expect(settingWords(fretboard({ strings: [1, 2, 3, 4, 5, 6], frets: [0, 12] }))).toBe(
            'strings 1-6, frets 0-12'
        )
        expect(settingWords(fretboard({ strings: [6, 4], ask: 'find' }))).toBe(
            'strings 4 and 6, frets 0-5, find'
        )
        expect(settingWords(fretboard({ ask: 'name' }))).toBe('string 5, frets 0-5, name')
        expect(settingWords({ kind: 'keyboard', keys: [48, 71], ask: 'both' })).toBe('keys C3-B4')
        expect(
            settingWords({ kind: 'chords', instrument: 'guitar', source: 'notes', family: '7th' })
        ).toBe('7th chords, from my notes')
        expect(settingWords({ kind: 'chords', instrument: 'piano', source: 'pieces' })).toBe(
            'from my pieces'
        )
        expect(
            settingWords({ kind: 'scales', instrument: 'guitar', source: 'library', ask: 'name' })
        ).toBe('from the library, name')
        expect(drillTitle(fretboard())).toBe('Fretboard notes, string 5, frets 0-5')
    })

    it('reads a setting back from its words', () => {
        for (const setting of [
            fretboard(),
            fretboard({ strings: [1, 2, 3, 4, 5, 6], frets: [3, 12], ask: 'find' }),
            fretboard({ strings: [4, 6], ask: 'name' }),
            { kind: 'keyboard', keys: [48, 71], ask: 'both' },
            { kind: 'keyboard', keys: [60, 83], ask: 'find' },
            { kind: 'chords', instrument: 'guitar', source: 'notes', family: '7th' },
            { kind: 'chords', instrument: 'guitar', source: 'library' },
            { kind: 'scales', instrument: 'guitar', source: 'focus', ask: 'both' }
        ] as DrillSetting[]) {
            const instrument = 'instrument' in setting ? setting.instrument : undefined
            expect(parseSetting(setting.kind, settingWords(setting), instrument)).toEqual(setting)
        }
        expect(parseSetting('fretboard', 'string 9, frets 0-5')).toBeNull()
        expect(parseSetting('fretboard', 'frets 5-2')).toBeNull()
        expect(parseSetting('keyboard', 'keys B4-C3')).toBeNull()
        expect(parseSetting('chords', 'from nowhere')).toBeNull()
    })
})

describe('the weak-spot map', () => {
    it('reads and writes items, keeping the ones it does not read', () => {
        const { stats, other } = parseStats([
            's5f3 C: 7/9 1.8s',
            'F#4: 2/5 3.25s, 2 in a row',
            'A minor pentatonic: 1/1 4s',
            'not a stat',
            12
        ])
        expect([...stats.values()]).toEqual([
            { spot: 's5f3', answer: 'C', right: 7, asked: 9, seconds: 1.8, streak: 0 },
            { spot: 'F#4', answer: '', right: 2, asked: 5, seconds: 3.25, streak: 2 },
            { spot: 'A minor pentatonic', answer: '', right: 1, asked: 1, seconds: 4, streak: 0 }
        ])
        expect(other).toEqual(['not a stat', '12'])
        expect(formatStat(stats.get('s5f3')!)).toBe('s5f3 C: 7/9 1.8s')
        expect(formatStat(stats.get('F#4')!)).toBe('F#4: 2/5 3.3s, 2 in a row')
        expect(parseStats(null).stats.size).toBe(0)
        expect(parseStats('s5f3 C: 1/1 1s').stats.get('s5f3')?.right).toBe(1)
    })

    it('merges answers: counts, average time and the streak of fast right answers', () => {
        const { stats } = parseStats(['s5f3 C: 1/2 3s, 1 in a row'])
        const answers: Answer[] = [
            { spot: 's5f3', answer: 'C', right: true, seconds: 1 },
            { spot: 's5f3', answer: 'C', right: true, seconds: 1.5 },
            { spot: 's4f2', answer: 'E', right: false, seconds: 4 },
            { spot: 's4f2', answer: 'E', right: true, seconds: 2.5 }
        ]
        const merged = mergeStats(stats, answers, DEFAULT_DRILL_RULES)
        expect(merged.get('s5f3')).toEqual({
            spot: 's5f3',
            answer: 'C',
            right: 3,
            asked: 4,
            seconds: 2.125,
            streak: 3
        })
        // Right but slow breaks the streak.
        expect(merged.get('s4f2')).toMatchObject({ right: 1, asked: 2, seconds: 3.25, streak: 0 })
        // The map given is not changed.
        expect(stats.get('s5f3')!.asked).toBe(2)
    })

    it('finds the weak spots, weakest first: most misses, then slowest', () => {
        const stat = (
            spot: string,
            right: number,
            asked: number,
            seconds: number,
            streak = 0
        ): SpotStat => ({ spot, answer: '', right, asked, seconds, streak })
        const stats = new Map(
            [
                stat('a', 5, 9, 2),
                stat('b', 4, 5, 3),
                stat('c', 4, 5, 5),
                stat('d', 3, 3, 1),
                stat('e', 3, 3, 3),
                // Cleared: 3 fast right answers in a row.
                stat('f', 2, 9, 1, 3)
            ].map((s) => [s.spot, s])
        )
        expect(weakSpots(stats, DEFAULT_DRILL_RULES).map((s) => s.spot)).toEqual([
            'a',
            'c',
            'b',
            'e'
        ])
    })
})

describe('questions', () => {
    it('lists the spots of a setting', () => {
        expect(spotsOf(fretboard({ frets: [0, 2] }))).toEqual(['s5f0', 's5f1', 's5f2'])
        expect(spotsOf({ kind: 'keyboard', keys: [60, 62], ask: 'both' })).toEqual([
            'C4',
            'C#4',
            'D4'
        ])
    })

    it('asks the count, 6 in 10 from the weakest spots, never one spot twice in a row', () => {
        const setting = fretboard({ strings: [1, 2, 3, 4, 5, 6], frets: [0, 12] })
        const stats = new Map<string, SpotStat>([
            ['s5f3', { spot: 's5f3', answer: 'C', right: 0, asked: 4, seconds: 5, streak: 0 }],
            ['s6f1', { spot: 's6f1', answer: 'F', right: 1, asked: 4, seconds: 5, streak: 0 }]
        ])
        const asked = questions(setting, {
            stats,
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(7)
        })
        expect(asked).toHaveLength(20)
        const weak = asked.filter((q) => q.spot === 's5f3' || q.spot === 's6f1')
        expect(weak.length).toBeGreaterThanOrEqual(12)
        for (let i = 1; i < asked.length; i++) expect(asked[i]!.spot).not.toBe(asked[i - 1]!.spot)
        // The same seed asks the same questions.
        const again = questions(setting, {
            stats,
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(7)
        })
        expect(again.map((q) => q.spot)).toEqual(asked.map((q) => q.spot))
    })

    it('asks at random in the range without weak spots, with the count from the rules', () => {
        const asked = questions(fretboard({ frets: [0, 3] }), {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, questions: 8 },
            random: seededRandom(1)
        })
        expect(asked).toHaveLength(8)
        for (const q of asked) expect(['s5f0', 's5f1', 's5f2', 's5f3']).toContain(q.spot)
    })

    it('asks to find or to name a fretboard note, as the setting says', () => {
        const find = questions(fretboard({ ask: 'find' }), {
            stats: new Map(),
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(3)
        })
        expect(find.every((q) => q.type === 'find-fret')).toBe(true)
        const q = find.find((x) => x.spot === 's5f3')!
        expect(q).toMatchObject({ type: 'find-fret', string: 5, pitch: 48, note: 'C' })
        expect(q.prompt).toBe('Find C on string 5')
        const name = questions(fretboard({ ask: 'name' }), {
            stats: new Map(),
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(3)
        })
        expect(name.every((x) => x.type === 'name-fret')).toBe(true)
        expect(name[0]!.prompt).toBe('Name the marked note')
        const both = questions(fretboard({ frets: [0, 12] }), {
            stats: new Map(),
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(3)
        })
        expect(new Set(both.map((x) => x.type))).toEqual(new Set(['find-fret', 'name-fret']))
    })

    it('asks keys on a keyboard', () => {
        const asked = questions(
            { kind: 'keyboard', keys: [60, 71], ask: 'find' },
            { stats: new Map(), rules: DEFAULT_DRILL_RULES, random: seededRandom(2) }
        )
        const q = asked[0]!
        expect(q.type).toBe('find-key')
        expect(q.prompt).toBe(`Find ${q.spot}`)
    })

    it('asks chords and scales from a pool, with 4 choices', () => {
        const pool = ['C', 'Cm', 'C7', 'G', 'D', 'Am', 'Em']
        const asked = questions(
            { kind: 'chords', instrument: 'guitar', source: 'notes' },
            { stats: new Map(), rules: DEFAULT_DRILL_RULES, random: seededRandom(4), pool }
        )
        expect(asked).toHaveLength(20)
        for (const q of asked) {
            expect(q.type).toBe('name-chord')
            expect(q.prompt).toBe('Name this chord')
            if (q.type !== 'name-chord') continue
            expect(q.choices).toHaveLength(4)
            expect(q.choices).toContain(q.spot)
            expect(new Set(q.choices).size).toBe(4)
        }
        const scales = questions(
            { kind: 'scales', instrument: 'guitar', source: 'notes', ask: 'find' },
            {
                stats: new Map(),
                rules: DEFAULT_DRILL_RULES,
                random: seededRandom(4),
                pool: ['A minor pentatonic', 'C major']
            }
        )
        expect(scales[0]!.type).toBe('find-scale')
        expect(scales[0]!.prompt).toBe(`Find the notes of ${scales[0]!.spot}`)
        // A pool of one asks it every time: there is nothing else to ask.
        expect(
            questions(
                { kind: 'chords', instrument: 'guitar', source: 'notes' },
                {
                    stats: new Map(),
                    rules: DEFAULT_DRILL_RULES,
                    random: seededRandom(1),
                    pool: ['C']
                }
            ).map((q) => q.spot)
        ).toEqual(Array<string>(20).fill('C'))
        expect(
            questions(
                { kind: 'chords', instrument: 'guitar', source: 'notes' },
                { stats: new Map(), rules: DEFAULT_DRILL_RULES, random: seededRandom(1), pool: [] }
            )
        ).toEqual([])
    })

    it('picks choices with the same root first, the right one among them', () => {
        const choices = choicesFor('Cmaj7', ['C', 'C7', 'Cm7', 'G', 'D', 'Am'], seededRandom(5))
        expect(choices).toHaveLength(4)
        expect(choices).toContain('Cmaj7')
        expect(choices.filter((c) => c.startsWith('C')).length).toBe(4)
        expect(choicesFor('C', ['C'], seededRandom(1))).toEqual(['C'])
    })
})

describe('answers and score', () => {
    it('checks picks and named notes', () => {
        const [find] = questions(fretboard({ ask: 'find', frets: [3, 3] }), {
            stats: new Map(),
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(1)
        })
        expect(isRight(find!, { string: 5, pitch: 48 })).toBe(true)
        expect(isRight(find!, { string: 5, pitch: 60 })).toBe(true) // any C on the string
        expect(isRight(find!, { string: 4, pitch: 48 })).toBe(false)
        const [name] = questions(fretboard({ ask: 'name', frets: [1, 1] }), {
            stats: new Map(),
            rules: DEFAULT_DRILL_RULES,
            random: seededRandom(1)
        })
        expect(isRight(name!, { note: 'A#' })).toBe(true)
        expect(isRight(name!, { note: 'Bb' })).toBe(true)
        expect(isRight(name!, { note: 'B' })).toBe(false)
        expect(noteName(70)).toBe('A#')
    })

    it('scores a drill and turns it into a review', () => {
        const answers: Answer[] = [
            ...Array<Answer>(18).fill({ spot: 'a', answer: '', right: true, seconds: 2 }),
            ...Array<Answer>(2).fill({ spot: 'b', answer: '', right: false, seconds: 6 })
        ]
        expect(scoreOf(answers)).toEqual({ right: 18, total: 20, share: 0.9, seconds: 2 })
        expect(reviewResultOf(0.9)).toBe('good')
        expect(reviewResultOf(0.6)).toBe('shaky')
        expect(reviewResultOf(0.59)).toBe('failed')
        expect(scoreOf([])).toEqual({ right: 0, total: 0, share: 0, seconds: 0 })
    })
})

describe('pools: chords and scales to ask (decision 10)', () => {
    it('knows the chord families, and the library has every root of one', () => {
        expect(CHORD_FAMILIES.map((f) => f.name)).toContain('7th')
        expect(inFamily('G7', '7th')).toBe(true)
        expect(inFamily('Gmaj7', '7th')).toBe(false)
        expect(inFamily('Am', 'Minor')).toBe(true)
        expect(inFamily('A', 'Minor')).toBe(false)
        expect(inFamily('C/G', 'Major')).toBe(true)
        expect(inFamily('nonsense', 'Major')).toBe(false)
        const sevenths = libraryChords('7th')
        expect(sevenths).toHaveLength(12)
        expect(sevenths).toContain('Bb7')
        expect(libraryChords('Nope')).toEqual([])
        const scales = libraryScales()
        expect(scales).toContain('A minor pentatonic')
        expect(scales).toContain('F# dorian')
    })

    it("reads the chords a piece's charts and progressions play", () => {
        const text = [
            '```chords',
            '[G]Hello [D]world [Em]again [G]and',
            '```',
            '',
            '```progression',
            'key: C',
            'I vi IV V7',
            '```',
            '',
            '```progression',
            'Am F C G',
            '```'
        ].join('\n')
        expect(chordsOfText(text)).toEqual(['G', 'D', 'Em', 'C', 'Am', 'F', 'G7'])
    })

    it('keeps the chords without a note, read the same way whatever their spelling', () => {
        expect(missingFrom(['G', 'D', 'Em', 'Bm', 'B min'], ['G', 'Em'])).toEqual(['D', 'Bm'])
    })

    it('reads a chord or a scale from the name of a note that does not exist yet', () => {
        expect(chordOfName('F Sharp Minor 7 - Barre (Guitar Chord)')).toBe('F#m7')
        expect(chordOfName('A Major')).toBe('A')
        expect(chordOfName('Barre chords (Guitar Technique)')).toBeNull()
        expect(scaleOfName('A Minor Pentatonic - Box 1 (Guitar Scale)')).toBe('A minor pentatonic')
        expect(scaleOfName('C Sharp Major (Piano Scale)')).toBe('C# major')
        expect(scaleOfName('Alternate picking (Guitar Technique)')).toBeNull()
    })

    it('reads a scale from its root and type, as scale notes store them', () => {
        expect(scaleOf('A', 'Minor pentatonic')).toBe('A minor pentatonic')
        expect(scaleOf('C#', 'Major')).toBe('C# major')
        expect(scaleOf('H', 'Major')).toBeNull()
        expect(scaleOf('C', 'Nothing')).toBeNull()
    })
})

describe('picks on the drawing: what they mark', () => {
    const ask = (setting: DrillSetting) =>
        questions(setting, {
            stats: new Map(),
            rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
            random: seededRandom(1)
        })[0]!

    it('marks a right fretboard pick, and after a miss every right place on the string', () => {
        const q = ask(fretboard({ ask: 'find', frets: [3, 3] })) // Find C on string 5
        expect(afterPick(q, { string: 5, fret: 3, pitch: 48 }, [0, 12])).toEqual({
            right: true,
            done: true,
            marks: [{ at: { string: 5, fret: 3 }, result: 'right' }]
        })
        expect(afterPick(q, { string: 5, fret: 2, pitch: 47 }, [0, 12])).toEqual({
            right: false,
            done: true,
            marks: [
                { at: { string: 5, fret: 2 }, result: 'wrong' },
                { at: { string: 5, fret: 3 }, result: 'right' }
            ]
        })
    })

    it('marks a key, and after a miss the right key', () => {
        const q = ask({ kind: 'keyboard', keys: [60, 60], ask: 'find' }) // Find C4
        expect(afterPick(q, { string: null, fret: null, pitch: 60 }, [0, 0]).marks).toEqual([
            { at: { pitch: 60 }, result: 'right' }
        ])
        expect(afterPick(q, { string: null, fret: null, pitch: 62 }, [0, 0]).marks).toEqual([
            { at: { pitch: 62 }, result: 'wrong' },
            { at: { pitch: 60 }, result: 'right' }
        ])
    })

    it('finds the notes of a scale one pick at a time; right only without a wrong pick', () => {
        const scale: Question = {
            type: 'find-scale',
            spot: 'C major pentatonic',
            prompt: 'Find the notes of C major pentatonic',
            classes: [0, 2, 4, 7, 9]
        }
        let state = startScale()
        const pick = (pitch: number) => {
            const r = scalePick(scale, state, { string: null, fret: null, pitch })
            state = r.state
            return r
        }
        expect(pick(60).marks).toEqual([{ at: { pitch: 60 }, result: 'right' }])
        expect(pick(61)).toMatchObject({
            done: false,
            marks: [{ at: { pitch: 61 }, result: 'wrong' }]
        })
        pick(62)
        pick(64)
        pick(67)
        const last = pick(69)
        expect(last.done).toBe(true)
        expect(last.right).toBe(false) // one wrong pick on the way
        expect(state).toEqual({ found: [0, 2, 4, 7, 9], misses: 1 })
    })
})

describe('review findings (domain)', () => {
    it('reads scale names with # and b, and the type affixes it is given', () => {
        expect(scaleOfName('C# Major (Piano Scale)')).toBe('C# major')
        expect(scaleOfName('Bb Minor (Guitar Scale)')).toBe('Bb minor')
        expect(scaleOfName('E♭ Major')).toBe('Eb major')
    })

    it('compares chords and scales whatever their spelling', () => {
        expect(sameChord('Db', 'C#')).toBe(true)
        expect(sameChord('Dbm7', 'C#m7')).toBe(true)
        expect(sameChord('C/G', 'C')).toBe(false)
        expect(sameScale('Eb major', 'D# major')).toBe(true)
        expect(missingFrom(['C#', 'Gb7'], ['Db', 'F#7'])).toEqual([])
    })

    it('asks every family of the library when no family is picked', () => {
        const all = libraryChords()
        expect(all).toContain('C')
        expect(all).toContain('Am7')
        expect(all.length).toBe(CHORD_FAMILIES.reduce((n, f) => n + f.suffixes.length * 12, 0))
    })

    it('keeps strict numbers in the map, turns objects back into text, merges repeated spots', () => {
        const { stats, other } = parseStats([
            'C3: 1/2 1.2.3s',
            'D3: 0/0 1s',
            { 's5f3 C': '7/9 1.8s' },
            'E3: 1/2 2s',
            'E3: 2/2 1s, 2 in a row'
        ])
        expect(other).toEqual(['C3: 1/2 1.2.3s', 'D3: 0/0 1s'])
        expect(stats.get('s5f3')).toMatchObject({ answer: 'C', right: 7, asked: 9 })
        expect(stats.get('E3')).toEqual({
            spot: 'E3',
            answer: '',
            right: 3,
            asked: 4,
            seconds: 1.5,
            streak: 2
        })
    })

    it('spreads weak slots exactly for any share', () => {
        const stats = new Map<string, SpotStat>([
            ['s5f1', { spot: 's5f1', answer: 'A#', right: 0, asked: 3, seconds: 5, streak: 0 }],
            ['s5f2', { spot: 's5f2', answer: 'B', right: 0, asked: 3, seconds: 5, streak: 0 }]
        ])
        for (const share of [0.29, 0.57, 0.6]) {
            const asked = questions(fretboard({ frets: [0, 12], ask: 'name' }), {
                stats,
                rules: { ...DEFAULT_DRILL_RULES, questions: 100, weakShare: share },
                random: seededRandom(9)
            })
            // Weak slots are those from the weak list (the random ones may hit a weak spot too).
            expect(
                asked.filter((q) => q.spot === 's5f1' || q.spot === 's5f2').length
            ).toBeGreaterThanOrEqual(Math.round(share * 100))
        }
        expect(weakSlots(100, 0.29)).toBe(29)
        expect(weakSlots(100, 0.57)).toBe(57)
        expect(weakSlots(20, 0.6)).toBe(12)
    })

    it('gives 4 choices even from a small pool, the others from the library', () => {
        const [q] = questions(
            { kind: 'chords', instrument: 'guitar', source: 'notes' },
            {
                stats: new Map(),
                rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
                random: seededRandom(2),
                pool: ['C', 'G']
            }
        )
        expect(q?.type === 'name-chord' && q.choices.length).toBe(4)
        const [s] = questions(
            { kind: 'scales', instrument: 'guitar', source: 'notes', ask: 'name' },
            {
                stats: new Map(),
                rules: { ...DEFAULT_DRILL_RULES, questions: 1 },
                random: seededRandom(2),
                pool: ['A minor pentatonic']
            }
        )
        expect(s?.type === 'name-scale' && s.choices.length).toBe(4)
        expect(s?.type === 'name-scale' && s.choices).toContain('A minor pentatonic')
    })

    it("reads a piano chord note's keys: exact pitches, a list, or pitch classes stacked from middle C", () => {
        expect(pianoKeys('A3 C#4 E4')).toEqual([57, 61, 64])
        expect(pianoKeys(['C4', 'E4', 'G4'])).toEqual([60, 64, 67])
        expect(pianoKeys('A C# E')).toEqual([69, 73, 76])
        expect(pianoKeys('')).toEqual([])
        expect(pianoKeys(null)).toEqual([])
    })

    it('spells sharps in a drill title, so a file name keeps them', () => {
        expect(drillFileTitle({ kind: 'keyboard', keys: [49, 70], ask: 'both' })).toBe(
            'Keyboard notes, keys C Sharp 3-A Sharp 4'
        )
        expect(drillFileTitle(fretboard())).toBe('Fretboard notes, string 5, frets 0-5')
    })
})

describe('new drills on a phone', () => {
    it('start a keyboard drill on one octave on narrow touch screens, two elsewhere', () => {
        // Two octaves on a 412 px phone left 18 px black keys: one octave gives 24 px or more.
        expect(drillDefaults('keyboard', false)).toEqual({
            kind: 'keyboard',
            keys: [48, 71],
            ask: 'both'
        })
        expect(drillDefaults('keyboard', true)).toEqual({
            kind: 'keyboard',
            keys: [60, 71],
            ask: 'both'
        })
        expect(drillDefaults('fretboard', true)).toEqual(drillDefaults('fretboard', false))
        // A copy each time: the modal edits it.
        expect(drillDefaults('chords', false)).not.toBe(drillDefaults('chords', false))
    })
})

describe('my pieces in solfège or German (music-notation #12)', () => {
    it("reads a progression block's own naming", () => {
        expect(chordsOfText('```progression\nnaming: solfege\nDo Fa Sol7 Ré m7\n```')).toEqual([
            'C',
            'F',
            'G7',
            'Dm7'
        ])
        expect(chordsOfText('```progression\nnaming: german\nH7 B E\n```')).toEqual([
            'B7',
            'Bb',
            'E'
        ])
    })
})
