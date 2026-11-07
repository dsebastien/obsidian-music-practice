import { describe, expect, it } from 'bun:test'
import {
    MAX_SPEED,
    MIN_LOOP_SECONDS,
    MIN_SPEED,
    clampSpeed,
    countInPlan,
    formatTime,
    insertSection,
    mediaKindOf,
    parsePlayAlong,
    parseTime,
    playAlongKey,
    playedTempo,
    sectionLine,
    sectionLoop,
    setMark,
    stepSpeed,
    tappedTempo,
    tempoOf,
    withTempo,
    wrapTarget
} from './playalong'

describe('parseTime', () => {
    it('reads m:ss, mm:ss and h:mm:ss with up to three decimals', () => {
        expect(parseTime('0:12')).toBe(12)
        expect(parseTime('3:05')).toBe(185)
        expect(parseTime('12:00')).toBe(720)
        expect(parseTime('1:02:03')).toBe(3723)
        expect(parseTime('0:45.5')).toBe(45.5)
        expect(parseTime('0:01.125')).toBeCloseTo(1.125)
    })
    it('refuses anything else', () => {
        for (const text of ['12', '0:7', '0:60', '1:2:03', '0:12.1234', 'a:12', '', '-0:12'])
            expect(parseTime(text)).toBeNull()
    })
})

describe('formatTime', () => {
    it('writes m:ss, h:mm:ss past an hour, and tenths on request', () => {
        expect(formatTime(0)).toBe('0:00')
        expect(formatTime(12)).toBe('0:12')
        expect(formatTime(185.4)).toBe('3:05')
        expect(formatTime(3723)).toBe('1:02:03')
        expect(formatTime(45.46, true)).toBe('0:45.5')
        expect(formatTime(59.96, true)).toBe('1:00.0')
        expect(formatTime(Number.NaN)).toBe('0:00')
        expect(formatTime(-3)).toBe('0:00')
    })
})

describe('mediaKindOf', () => {
    it('knows the audio and video types Obsidian plays', () => {
        for (const ext of ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'oga', 'opus', '3gp', 'aac'])
            expect(mediaKindOf(`song.${ext}`)).toBe('audio')
        for (const ext of ['mp4', 'webm', 'ogv', 'mov', 'mkv', 'm4v'])
            expect(mediaKindOf(`clip.${ext}`)).toBe('video')
        expect(mediaKindOf('SONG.MP3')).toBe('audio')
        expect(mediaKindOf('notes.md')).toBeNull()
        expect(mediaKindOf('noextension')).toBeNull()
    })
})

describe('parsePlayAlong', () => {
    it('reads the file line and the sections, in time order', () => {
        const block = parsePlayAlong(
            ['file: [[Wonderwall.mp3]]', '0:45.5 Chorus', '0:00 Intro', '0:12 Verse', ''].join('\n')
        )
        expect(block.file).toBe('Wonderwall.mp3')
        expect(block.sections).toEqual([
            { time: 0, name: 'Intro', line: 2 },
            { time: 12, name: 'Verse', line: 3 },
            { time: 45.5, name: 'Chorus', line: 1 }
        ])
        expect(block.problems).toEqual([])
    })
    it('takes a line that is only a link, an embed, a Markdown link or a path', () => {
        expect(parsePlayAlong('![[a b.mp3]]').file).toBe('a b.mp3')
        expect(parsePlayAlong('[[song.mp3|My song]]').file).toBe('song.mp3')
        expect(parsePlayAlong('[[song.mp3#x]]').file).toBe('song.mp3')
        expect(parsePlayAlong('[Take](Music/take%201.m4a)').file).toBe('Music/take 1.m4a')
        expect(parsePlayAlong('[Take](<Music/take 1.m4a>)').file).toBe('Music/take 1.m4a')
        expect(parsePlayAlong('Music/take.mp4').file).toBe('Music/take.mp4')
        expect(parsePlayAlong('file: Music/take.mp4').file).toBe('Music/take.mp4')
        expect(parsePlayAlong('File:   [[take.mp4]]  ').file).toBe('take.mp4')
    })
    it('allows a section without a name', () => {
        expect(parsePlayAlong('file: a.mp3\n1:00').sections).toEqual([
            { time: 60, name: '', line: 1 }
        ])
    })
    it('names each line it cannot read, and keeps the rest', () => {
        const block = parsePlayAlong(
            ['file: a.mp3', 'Verse at 0:12', '0:12 Verse', 'b.mp3'].join('\n')
        )
        expect(block.file).toBe('a.mp3')
        expect(block.sections).toHaveLength(1)
        expect(block.problems).toEqual([
            'Line 2 is not a section: write 0:12 Verse',
            'Line 4: the block already has a file (line 1)'
        ])
    })
    it('has no file when no line names one', () => {
        const block = parsePlayAlong('0:12 Verse')
        expect(block.file).toBeNull()
        expect(block.sections).toHaveLength(1)
    })
    it('keeps sections of the same time in their written order', () => {
        const block = parsePlayAlong('file: a.mp3\n0:10 B\n0:10 A')
        expect(block.sections.map((s) => s.name)).toEqual(['B', 'A'])
    })
})

describe('sectionLine and insertSection', () => {
    it('writes the time to a tenth, without a needless decimal', () => {
        expect(sectionLine(12, 'Verse')).toBe('0:12 Verse')
        expect(sectionLine(45.46, 'Chorus')).toBe('0:45.5 Chorus')
        expect(sectionLine(59.98, 'Solo')).toBe('1:00 Solo')
        expect(sectionLine(30, '  ')).toBe('0:30')
    })
    it('puts the line before the first later section', () => {
        const body = ['file: [[a.mp3]]', '0:00 Intro', '0:45 Chorus'].join('\n')
        expect(insertSection(body, '0:12 Verse')).toBe(
            ['file: [[a.mp3]]', '0:00 Intro', '0:12 Verse', '0:45 Chorus'].join('\n')
        )
    })
    it('puts it after the last section line, else after the file line', () => {
        expect(insertSection('file: a.mp3\n0:00 Intro\n\n// notes', '1:00 Outro')).toBe(
            'file: a.mp3\n0:00 Intro\n1:00 Outro\n\n// notes'
        )
        expect(insertSection('file: a.mp3\n', '0:12 Verse')).toBe('file: a.mp3\n0:12 Verse\n')
        expect(insertSection('', '0:12 Verse')).toBe('0:12 Verse')
    })
    it('puts a section of an existing time after the ones already there', () => {
        expect(insertSection('file: a.mp3\n0:12 A\n0:20 C', '0:12 B')).toBe(
            'file: a.mp3\n0:12 A\n0:12 B\n0:20 C'
        )
    })
})

describe('setMark', () => {
    it('sets A, then B, and turns the loop on once both are set', () => {
        const a = setMark({ a: null, b: null, loop: false }, 'a', 10)
        expect(a).toEqual({ ok: true, loop: { a: 10, b: null, loop: false } })
        const b = setMark({ a: 10, b: null, loop: false }, 'b', 20)
        expect(b).toEqual({ ok: true, loop: { a: 10, b: 20, loop: true } })
    })
    it('swaps A set after B, and B set before A', () => {
        expect(setMark({ a: 10, b: 20, loop: true }, 'a', 25)).toEqual({
            ok: true,
            loop: { a: 20, b: 25, loop: true }
        })
        expect(setMark({ a: 10, b: 20, loop: true }, 'b', 4)).toEqual({
            ok: true,
            loop: { a: 4, b: 10, loop: true }
        })
    })
    it('refuses a loop shorter than half a second', () => {
        expect(MIN_LOOP_SECONDS).toBe(0.5)
        const r = setMark({ a: 10, b: null, loop: false }, 'b', 10.3)
        expect(r.ok).toBe(false)
        expect(setMark({ a: 10, b: 20, loop: true }, 'a', 19.8).ok).toBe(false)
    })
    it('keeps the loop off when it was turned off and A moves', () => {
        expect(setMark({ a: 10, b: 20, loop: false }, 'a', 12)).toEqual({
            ok: true,
            loop: { a: 12, b: 20, loop: false }
        })
    })
})

describe('sectionLoop', () => {
    const sections = [
        { time: 0, name: 'Intro', line: 1 },
        { time: 12, name: 'Verse', line: 2 },
        { time: 45, name: 'Chorus', line: 3 }
    ]
    it('loops from a section to the next one, the last one to the end', () => {
        expect(sectionLoop(sections, 1, 180)).toEqual({ a: 12, b: 45, loop: true })
        expect(sectionLoop(sections, 2, 180)).toEqual({ a: 45, b: 180, loop: true })
    })
    it('has no loop for the last section before the duration is known, or a short one', () => {
        expect(sectionLoop(sections, 2, Number.NaN)).toBeNull()
        expect(sectionLoop(sections, 2, 45.2)).toBeNull()
        expect(sectionLoop(sections, 5, 180)).toBeNull()
    })
})

describe('wrapTarget', () => {
    it('goes back to A minus the pre-roll, never before 0', () => {
        expect(wrapTarget(12, 0.2)).toBeCloseTo(11.8)
        expect(wrapTarget(0.1, 0.2)).toBe(0)
        expect(wrapTarget(12, 0)).toBe(12)
    })
})

describe('speed', () => {
    it('stays from 50 % to 125 %, in steps of 5 %', () => {
        expect(MIN_SPEED).toBe(0.5)
        expect(MAX_SPEED).toBe(1.25)
        expect(clampSpeed(0.2)).toBe(0.5)
        expect(clampSpeed(2)).toBe(1.25)
        expect(clampSpeed(0.73)).toBe(0.75)
        expect(clampSpeed(Number.NaN)).toBe(1)
        expect(stepSpeed(1, -1)).toBe(0.95)
        expect(stepSpeed(0.5, -1)).toBe(0.5)
        expect(stepSpeed(1.25, 1)).toBe(1.25)
        expect(stepSpeed(0.7, 1)).toBe(0.75)
        // No floating drift after many steps.
        let s = 1
        for (let i = 0; i < 7; i++) s = stepSpeed(s, -1)
        expect(s).toBe(0.65)
    })
})

describe('tempoOf', () => {
    it("takes the block's tempo line, else a tapped tempo, else the note's target BPM", () => {
        expect(tempoOf(120, 80, 96)).toEqual({ bpm: 120, source: 'block' })
        expect(tempoOf(null, 80, 96)).toEqual({ bpm: 80, source: 'tapped' })
        expect(tempoOf(null, null, 96)).toEqual({ bpm: 96, source: 'target' })
        expect(tempoOf(null, null, null)).toBeNull()
    })
    it('ignores values that are not positive numbers', () => {
        expect(tempoOf(null, 0, -3)).toBeNull()
        expect(tempoOf(Number.NaN, null, 60)).toEqual({ bpm: 60, source: 'target' })
    })
})

describe('the tempo line', () => {
    it('reads tempo: <BPM> as the recording tempo, from 20 to 300', () => {
        expect(parsePlayAlong('file: a.mp3\ntempo: 120').tempo).toBe(120)
        expect(parsePlayAlong('Tempo:  92.5 ').tempo).toBe(92.5)
        expect(parsePlayAlong('tempo: 96 BPM').tempo).toBe(96)
        expect(parsePlayAlong('file: a.mp3').tempo).toBeNull()
    })
    it('names a tempo it cannot use, and a second tempo line', () => {
        expect(parsePlayAlong('file: a.mp3\ntempo: fast').problems).toEqual([
            'Line 2: the tempo must be a number of BPM from 20 to 300 (tempo: 120)'
        ])
        expect(parsePlayAlong('tempo: 400').tempo).toBeNull()
        const two = parsePlayAlong('tempo: 90\ntempo: 100')
        expect(two.tempo).toBe(90)
        expect(two.problems).toEqual(['Line 2: the block already has a tempo (line 1)'])
    })
    it('withTempo changes the tempo line in place, else adds it after the file line', () => {
        expect(withTempo('file: a.mp3\ntempo: 90\n0:12 Verse', 101)).toBe(
            'file: a.mp3\ntempo: 101\n0:12 Verse'
        )
        expect(withTempo('file: a.mp3\n0:12 Verse\n', 101)).toBe(
            'file: a.mp3\ntempo: 101\n0:12 Verse\n'
        )
        expect(withTempo('0:12 Verse', 101)).toBe('tempo: 101\n0:12 Verse')
        expect(withTempo('', 101)).toBe('tempo: 101')
    })
    it('insertSection still puts a first section after the file line, before the tempo line', () => {
        expect(insertSection('file: a.mp3\ntempo: 90', '0:12 Verse')).toBe(
            'file: a.mp3\n0:12 Verse\ntempo: 90'
        )
    })
})

describe('tappedTempo', () => {
    it('is the tempo heard divided by the speed: the recording at 100 %', () => {
        expect(tappedTempo([0, 1000, 2000], 1)).toBe(60)
        expect(tappedTempo([0, 1000, 2000], 0.5)).toBe(120)
        expect(tappedTempo([0], 1)).toBeNull()
    })
})

describe('playedTempo', () => {
    it('is the tempo times the speed, rounded', () => {
        expect(playedTempo(96, 0.75)).toBe(72)
        expect(playedTempo(97, 0.85)).toBe(82)
    })
})

describe('countInPlan', () => {
    it('counts the bars of beats at tempo times speed', () => {
        const plan = countInPlan({ bpm: 120, speed: 0.5, beatsPerBar: 4, bars: 1 })
        expect(plan).toEqual({ beats: 4, beatsPerBar: 4, bpm: 60, seconds: 4 })
    })
    it('counts at least one bar, at most four', () => {
        expect(countInPlan({ bpm: 60, speed: 1, beatsPerBar: 3, bars: 0 }).beats).toBe(3)
        expect(countInPlan({ bpm: 60, speed: 1, beatsPerBar: 3, bars: 9 }).beats).toBe(12)
    })
    it('keeps the click tempo within the metronome range', () => {
        expect(countInPlan({ bpm: 30, speed: 0.5, beatsPerBar: 4, bars: 1 }).bpm).toBe(20)
    })
})

describe('playAlongKey', () => {
    it('maps the keys of a focused player to its actions', () => {
        expect(playAlongKey(' ', false)).toBe('toggle')
        expect(playAlongKey('k', false)).toBe('toggle')
        expect(playAlongKey('[', false)).toBe('set-a')
        expect(playAlongKey(']', false)).toBe('set-b')
        expect(playAlongKey('l', false)).toBe('loop')
        expect(playAlongKey('L', true)).toBe('loop')
        expect(playAlongKey('ArrowLeft', false)).toBe('back')
        expect(playAlongKey('ArrowLeft', true)).toBe('back-little')
        expect(playAlongKey('ArrowRight', false)).toBe('forward')
        expect(playAlongKey('ArrowRight', true)).toBe('forward-little')
        expect(playAlongKey('-', false)).toBe('slower')
        expect(playAlongKey('+', true)).toBe('faster')
        expect(playAlongKey('=', false)).toBe('faster')
        expect(playAlongKey('c', false)).toBe('count-in')
        expect(playAlongKey('t', false)).toBe('tap')
        expect(playAlongKey('m', false)).toBe('add-section')
        expect(playAlongKey('x', false)).toBeNull()
        expect(playAlongKey('Enter', false)).toBeNull()
    })
})
