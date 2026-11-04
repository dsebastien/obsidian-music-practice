# Changelog

All notable changes to this project will be documented in this file.

## [0.12.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.11.1...0.12.0) (2026-11-04)

Practice in time: a backing loop for a song's progression, tab exercises of your scales and arpeggios, and fingerpicking patterns as learning notes. From music-notation 0.11.0.

- **Practice this progression in time**: the note's chords play one a bar as a backing loop, to practice the changes or to solo over them. The loop reads each progression block, the note's chord charts (one bar per chord) and the chord notes it links in `chords`. Pick the strum: a strum on each beat, one strum a bar, an arpeggio, the block's own pattern, or a strumming pattern note it links. The tempo starts at the note's current BPM. The click, a count-in and the speed trainer (up to the target BPM) work as in the metronome. The chord that plays is lit, and **Save BPM** opens Set BPM with the loop's tempo. Starting the metronome stops the loop, and starting the loop stops the metronome. The loop's window closes when you turn the plugin off (#69).
- **Progressions and chord charts play in time**: progression blocks and ChordPro charts have a play bar, through your playback settings (soundfont or light synthesizer). It plays one chord a bar, with loop, a count-in, a click, tempo, volume and the strum, and lights the chord that plays. A chart plays at its `{tempo}` and `{time}`, and a progression block takes `time:`, `tempo:` and `strum:` (#69).
- **Insert a tab exercise of this scale or arpeggio**: on a guitar scale or arpeggio note, pick a position (the note's shape is selected first), the direction (up and down, up, down), the rhythm (8th notes, triplets, 16th notes) and the tempo (the note's current BPM). The preview draws the position and its tab. **Insert** puts the run at the cursor as a tab block that plays in time, with the count-in, the metronome and the speed control. The command needs tab blocks turned on (#70).
- **Tab exercises on fretboards**: `exercise: up-down` (or `up`, `down`) on a fretboard with one position draws the run as a tab under the diagram. `rhythm:` and `tempo:` set the rhythm and the tempo (#70).
- **Save BPM in tab player bars**: in a learning note, every tab and score bar has **Save BPM**. It opens Set BPM with the tempo the music plays at: the tab's tempo times the speed set on the bar, so a 72 BPM tab at 125% saves 90. It reads the speed from the bar, even before the first Play (#70).
- **Fingerpicking pattern notes**: in **Add a learning note**, type the pattern (Travis, Alternate bass, 1-2-3-4, or the fingers: `p i m a`), the time signature and the chord, with a preview. The note's empty picking block plays the pattern over its chord at your current BPM. You need a note type for it first: a learning type with `picking_pattern`, and `time_signature` and `chord_symbol` if you want them (#71).
- **Picking blocks**: a ` ```picking ` block draws a fingerpicking pattern as a small tab and plays it in time over a chord, or one chord a bar (`chords: C Am F G`). Write PIMA letters, string numbers, pinches (`p+a`) and rests, or name a pattern: `travis`, `alternate bass`, `1-2-3-4`. Its bar has loop, a count-in, a click (off by default), tempo and volume. The new **Picking patterns** switch in **Settings → Music Practice → Notation blocks** turns them on or off (on by default), and **Picking pattern** in the property names sets the property (#71).
- **A name for every voicing**: every diagram of a `voicings:` list now has a name, and so does every voicing in **Voicings of this chord**. Bb x1033x and A x0222x are "Open": an open chord no longer needs its top string. Other new names are "Drop 2", "Drop 3", "Hendrix chord", "Open bass", "Open strings" and the strings they sound ("Strings 3-6"). Before, 121 of 643 diagrams in `voicings: 6` lists (12 roots, 9 common chord kinds) had the chord's name alone. The order of the list doesn't change.
- **The Hendrix grip in 7#9 lists**: `voicings:` for C7#9 now shows the Hendrix grip x3234x. Before, the list drew x32340: the same grip with its top string sounding.
- **Publish**: add `'picking'` to the block languages in your `publish.js`, and pin the library at 0.11.0. A fingerpicking pattern note's empty picking block draws from its properties there too.

## [0.11.1](https://github.com/dsebastien/obsidian-music-practice/compare/0.11.0...0.11.1) (2026-11-03)

A practice timer you forgot can now be discarded and shows as forgotten, and long text tab lines are fast again. From music-notation 0.10.1.

- **Discard a forgotten timer**: throw away a timer you forgot, without logging it. Use **Discard practice timer**, the **Discard** button in the practice panel, **Discard timer** in Log practice when you stop the timer, or a right-click on the timer in the status bar. It always asks first and says how long the timer ran. Before, only logging it cleared it.
- **Forgotten timers stand out**: a timer that started more than 4 hours ago (pauses included) shows "forgotten?" in the status bar and the practice panel. If you try to start a new timer while it runs, the notice says how to discard the old one.
- **Shortcut**: `obsidian://music-practice?do=discard-timer` asks, then discards the timer.
- **Long text tab lines are fast again**: a text tab line with no bar lines is split into bars quickly again, in your notes, in **Import a text tab** and in **Edit as alphaTex**. In 0.11.0, a long palm mute (PM) or slide line got slower the longer it was: a palm mute line of 50,000 columns took 499 ms. It now takes 64 ms, and the output is the same. Real tabs (about 100 columns) were not slowed down in practice.

## [0.11.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.10.0...0.11.0) (2026-11-03)

Two new kinds of learning notes (arpeggios and strumming patterns), the key and the hardest chord changes of a piece, a metronome that counts in, and shortcuts that start practice from outside Obsidian. From music-notation 0.10.0.

- **Arpeggio notes**: learn a chord's arpeggio one CAGED shape at a time. In **Add a learning note**, type the chord and pick its shape. The note gets an empty fretboard block (a keyboard block on piano) that draws the arpeggio from its chord and shape. You need a note type for it first: a learning type tagged `type/music/<instrument>/arpeggio`, with `chord_symbol`, `chord_root`, `chord_quality` and, on guitar, `shape` (C, A, G, E or D). The Obsidian Starter Kit doesn't ship one yet. Arpeggio notes draw in Obsidian only, not yet on Obsidian Publish (#56).
- **Strumming pattern notes**: type the pattern (`D DU UDU`), the time signature and the feel. The note's empty strum block plays the pattern at your current BPM, with its time signature and feel ("straight", "swing" or "60%"). You need a note type for it first: a learning type with `strum_pattern`, `time_signature` and `strum_feel` (and `chord_symbol` if you want one). The Obsidian Starter Kit doesn't ship one yet. Strumming pattern notes draw in Obsidian only, not yet on Obsidian Publish (#58).
- **Chord notes draw their arpeggio**: a guitar chord note's empty fretboard block now draws the chord's arpeggio.
- **Find the key and scales of this piece**: the key or mode of a song, from its chord charts and the chord notes it links, the scales that fit, and the best one on a fretboard or keyboard. One click fills the piece's `key` (#67).
- **Suggest chord change drills from this piece**: the song's chord changes, hardest first (how much your hand moves), then the most played. Each one is a click from a chord change drill (#74).
- **Count-in and beat flash**: the metronome counts in a bar (or up to 4, or none) before the music starts, and the chord change drill counts 3, 2, 1. Turn on **Flash** to see each beat, beat one in another color (#77).
- **The piece's time signature**: a piece with `time_signature: 3/4` opens the metronome in 3/4, and 6/8 as 2 beats of triplets (#77).
- **Shortcuts from outside Obsidian**: `obsidian://music-practice?do=start-timer` (or `stop-timer`, `log`, `plan`, `practice-next`, with `minutes=` for log and plan) works from a phone shortcut, a Stream Deck or an NFC tag. Only starting the timer happens without a window; the other actions open the window you'd use anyway (#47).
- **One diagram per shape in voicing lists**: `voicings:` now draws one diagram per shape: the easiest ones, in a row up the neck. Before, it drew every voicing, easiest first. A shape with its highest strings muted is the same shape, so it's left out. A `voicings:` block you already wrote can draw other diagrams, in another order. A now gets its D shape `x-x-7-9-10-9` and its C shape.
- **First voicings you can strum**: the first voicing of a chord in the database is now one you can strum. A grip with a muted string inside the shape comes after the others: Bdim starts with x2343x, not x20x01. The exception is the jazz grips that mute the A string under a root on the low E. 37 chords changed their first voicing, so a `chord` block with only a symbol, or a ChordPro chart's `{diagrams}` row, can draw another shape than before. **Add a learning note** offers that first voicing too, for a new guitar chord note.
- **Jazz grips in voicing lists**: the Hendrix grip (C7#9 x3234x), m7b5 (F#m7b5 2x221x) and dim7 (Gdim7 3x232x) from the low E, and the 13 (G13 3x345x), now show up without `gaps: yes`. They mute strings inside the shape, and that's how players use them. C7#9, F#m7b5, Gdim7 and Bm7b5 start with them.
- **Shell means three notes**: a diagram is titled "Shell" only when it has three notes: the root lowest, then the third and the seventh or sixth (x3x45x). Cmaj7 x3250x is no longer called a shell, so a title in a note you already wrote can change.
- **Barres from frets alone**: frets written without fingers now show a full barre (F `133211`). Before, only `fingers` made a barre. A small barre (`xx3211`) still shows none. A chord diagram you already wrote without fingers can now draw a barre.
- **Single positions get a title**: one position on a fretboard gets the same kind of title as the diagrams of `positions: all`. `shape: E` on G major is "G major, E shape", and `position: 2` on A minor pentatonic is "A minor pentatonic, box 2". Before, it had no title.
- **More tunings**: `tuning:` takes `Drop C`, `Drop B`, `Drop A`, `Double Drop D`, `Open C`, `Open A`, `Whole step down` and `Modal C6` (also `C6`).
- **Text tabs land in the right bars**: in the text tabs drawn as tablature in your notes, and in **Edit as alphaTex**, a line with no bar lines is split into bars of the meter. A 3-bar line was one bar of 13 sixteenths; it is now `4 4 8 8 4 | 8 8 8 8 4 4 | 2 2` (alphaTex durations). In a Nothing Else Matters arrangement, a 21-column bar is now two full 6/8 bars. When a bar would overflow, a hammer-on, pull-off or slide pair shares one eighth: Nothing Else Matters `7-----7p0----` in 6/8 is now `8 8 8 16 16 8 8`. And bars of the same width put the same columns on the same beats: `-----0---3---6-5-` was `r8 4 4 8 4`, and it is now `r4 4 4 8 8`.

## [0.10.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.9.0...0.10.0) (2026-11-03)

Practice time lives in the session note, text tabs draw as tablature, and diagrams sound and look more like the real instrument. From music-notation 0.9.0.

- **The session note carries the practice time**: a practice log no longer writes a time entry on the activity (Learn Guitar, Learn Piano…), and it never adds minutes to it. The session note links to the activity and holds the minutes. The activity's minutes and last session date are worked out again from its time entries and the session notes linked to it, so the same practice never counts twice. When the log takes over a running Kanban Action Planner timer, it removes the timer's own entry from the activity, because the session holds that time. Undo puts it back. If Obsidian hasn't indexed the new session's link yet, the log says so and writes nothing on the activity.
- **Text tabs draw as tablature**: a plain-text tab the library can read now draws as tablature, with a player. This includes the text tabs already in your notes. It opens in the tab view, unless a `staves:` line says otherwise. Its bar has **Text** (the block as you wrote it), a note that the rhythm is guessed from the tab, and **Edit as alphaTex**. Edit as alphaTex is the former Convert to a playable tab, and its command is renamed too. Text tabs the library can't read, and blank staves, stay as text (#84).
- **More blocks that can change in your notes**: a strum pattern that doesn't fit its bars now shows a message instead of drawing. A keyboard `chord:` now lights and plays one voicing. With `functions: yes`, some labels change: Gm7 C7 F in C reads ii7/IV V7/IV IV, a diminished chord that goes down a half step reads "passing", and VII in a minor key is a dominant. A ChordPro `{transpose}` without `{key}` now moves every chord the same way.
- **Tabs that drew nothing now draw**: every part of a tab or score block now draws right away. Before, a block opened while the Obsidian window wasn't on screen stayed empty (#82).
- **Tab, Score or Both**: the tab player bar switches between tablature, notation and both without stopping playback. **Keep this view** writes the `staves:` line at the top of the block (#83).
- **Chords that sound like a guitar or a piano**: guitar chords strum at 12 ms a string, and piano chords sound together. A Strum setting left at the old default (40 ms) now reads as the new one. Notes fade out instead of stopping dead, and each note has its own loudness.
- **6/8, 9/8 and 12/8 count the beat you tap**: in these times, `tempo:` counts the dotted quarter you tap your foot to. Before, it counted 8ths, so a `tempo:` already in your notes now plays three times as fast. Music Practice's tempo keeps its speed in that beat.
- **Swing in strumming patterns**: `swing: yes` (or `swing: 60%`) plays a shuffle feel.
- **The play command runs a scale from its tonic**, as the diagram's own play bar does.
- **Piano**: `fingering: auto` fingers every major and minor scale, and seventh chords. Voice-led progressions work with both hands, and a bass line written with slash chords keeps its steps. Rootless voicings follow the key. Each hand gets one bracket (LH, RH), and inverted chords are titled with their slash name (C/E). Keyboard scales without a range now go from tonic to tonic, and `arpeggio:` works on keyboards.
- **Progressions and the circle of fifths**: `functions: yes` names neapolitan, passing and tonicizing chords, and the ii of a secondary dominant. Figured bass (`V65`) is read as an inversion. A minor key's circle now marks the harmonic V, and `dominant: minor` marks v instead.
- **Guitar diagrams**: voicings are checked, with the shapes teachers use first. Barres and muted strings are clearer, shapes are named "C shape" to "D shape", and every dot is easy to click. A chord note type made before this release keeps its shape values (E-shape barre, CAGED C…): the new names map to them.

## [0.9.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.8.2...0.9.0) (2026-11-03)

Strumming patterns, progressions and the circle of fifths, notes that light up as they play, and capo, arpeggios and piano voicings. From music-notation 0.8.0.

- **Three new blocks**: ` ```strum `, ` ```progression ` and ` ```circle `. Each has its own toggle in Settings → Notation blocks (Strumming patterns, Progressions, Circle of fifths), on by default. Turn one off and its blocks show as code.
- **Notes light up as they play**: while a chord, keyboard or fretboard plays, each note lights up on the drawing when you hear it: the dot, the key or the string's mark. A strummed chord lights its strings from the low one up, and a clicked note lights only what you clicked. On the first play, the lights wait for the soundfont to load, so they match the sound. In tabs and scores, a line now follows the beat and the notes that sound light up. Before, neither showed.
- **Strumming patterns**: a ` ```strum ` block draws a pattern on a beat grid, with the counts, an arrow for each strum, accents (`D>`), muted strums (`X`), ghost strums (`(U)`) and chord changes (`[G]`). Paste it the way you find it on the web: `D - D U - U D U`, `D DU UDU` and `DDUUDU` all work, in 4/4, 3/4, 6/8 or 12/8. The bar under it plays the pattern over its chords, with loop, a count-in, tempo and volume, and lights the slot that plays.
- **Progressions**: a ` ```progression ` block writes a progression once and shows its chords in any key, each with its numeral and a diagram. Roman numerals (`I V vi IV`), Nashville numbers (`1 5 6m 4`) or chord names; `key: G`, `transpose: -2`, `functions: yes`, and `---` for a key change. Guitar diagrams use the voicings that make the whole progression easiest.
- **Circle of fifths**: a ` ```circle ` block draws the keys, their relative minors and the diminished chords, with the chosen key's chords tinted and numbered, in any mode. A click plays a key or a chord, and the play button plays the key's scale.
- **Which scale fits**: `scales-for: G D Em C` on a fretboard or keyboard draws the scale that fits a song's chords. `scale:` with `chord:` keeps the scale drawn and marks the chord's notes: the notes to aim for when you solo over that chord.
- **Capo**: `capo: 2` on a chord or fretboard block draws a capo bar and a "Capo 2" caption. Frets count from the capo, so an A shape is still `x02220`, and playback plays the notes that sound. `sounds: yes` adds the chord you hear ("Capo 2, sounds B").
- **Arpeggios**: `arpeggio: Am7` on a fretboard draws a chord's notes with their intervals; add `positions: all` for its CAGED shapes up the neck.
- **Piano voicings**: piano chords take `inversion: first`, `voicing: shell` (or `open`, `rootless A`, `rootless B`), `hands: left+right` and `fingering: auto`.
- **Chord diagrams in chord charts**: `{diagrams}` in a ` ```chords ` block draws every chord the song uses as a row above it. `{define}` gives a chord your own shape, and `{chord: Am}` draws one chord where you write it. `{instrument: piano}` draws piano chords instead.
- **More text tabs convert**: drum tabs, tabs with numbered strings (`1|` to `6|`) and a single named line now get the **Convert to a playable tab** button. Blank staves stay text: they are templates to fill in.
- **Transposed chords spelled right**: a chart with `{key: G}` and `{transpose: -1}` now shows F# B C#. Before, it showed Gb B Db.
- **Drums in tabs**: tab blocks and Guitar Pro files with drums show tablature for the guitar and notation for the drums, staff by staff, with the percussion clef. Before, the drums drew nothing in a tab block.

## [0.8.2](https://github.com/dsebastien/obsidian-music-practice/compare/0.8.1...0.8.2) (2026-11-03)

The piano plays, and a diagram's sound menu redraws it for the other instrument. From music-notation 0.7.0.

- **Piano sound**: with recorded instruments (the default sound, Settings → Playback), keyboards and piano chords now play their notes. Before, they played nothing, and Piano in a fretboard's sound menu changed nothing.
- **Scales play every note**: a scale on a fretboard or a keyboard now plays every note drawn, from the lowest to the highest and back down, with the top note once. Before, it played only from its lowest root to its highest one, so A minor pentatonic box 1 dropped its top C5, and boxes 2 to 4 played 6 of their 12 dots.
- **The other instrument, drawn**: choosing Piano in a guitar chord's or a fretboard's sound menu redraws it as a keyboard with the same notes, and choosing Guitar on a keyboard redraws it as a fretboard. If something is playing, it stops first. The title, the root and the note, degree or interval labels come along. Choose the diagram's own instrument to get its drawing back. A click on a note plays it on either drawing.
- **Fingering on note lists**: `fingering:` works on keyboard note lists, one finger per note in the order written, so you can draw five-finger and hand positions. `notes: C D E F G` with `fingering: 1 2 3 4 5` puts fingers 1 to 5 on C4 to G4, and `labels:` works as for scales.
- **`root:` in a chord block**: it now shows an error that says it only applies to note lists on fretboards and keyboards. Before, it did nothing.
- **Hand positions aren't chords**: five notes or more that only move by steps within an octave are no longer named as a chord. `C4 D4 E4 F4 G4` is a hand position, not Dm11/C, and gets no root marks. Chords with a step in them keep their names, from Cadd9 and Csus2 to four-note jazz clusters such as Cmaj9/B.

## [0.8.1](https://github.com/dsebastien/obsidian-music-practice/compare/0.8.0...0.8.1) (2026-11-03)

New for the diagrams in your notes, from music-notation 0.6.0.

- **A root for note lists**: add `root: C` to a fretboard or keyboard block that lists notes (`notes: C Eb Gb A`). `labels: intervals` and `labels: degrees` then count from that root, and the root gets the root color when it is in the list. It doesn't have to be.
- **Positions in neck order**: `positions: all` draws a scale's positions up the neck, each one at or above the one before. A minor pentatonic's boxes 4 and 5 now sit at frets 12–15 and 14–17, not 0–3 and 2–5. A list of positions (`positions: 1 3`) keeps those frets.
- **Numbering from the relative minor**: `numbering: minor` counts a major pentatonic's positions from its relative minor, as many courses do. A major pentatonic's position 1 is then box 1 of F# minor pentatonic, and the titles add "(from F#m)".
- **One position where you want it**: a single `position:` with `frets:` is drawn inside those frets, so `position: 4` with `frets: 10-17` is box 4 at frets 12–15. When no octave of it fits, the block says so.

## [0.8.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.7.1...0.8.0) (2026-11-03)

Turn a text tab into a tab you can play, plus fixes for imports and popout windows.

- **Convert a text tab**: a ` ```tab ` or ` ```score ` block that holds a plain-text tab (`e|---0---|` lines) now has a **Convert to a playable tab** button under it (not on canvas cards). The command **Convert this text tab into a playable tab** does the same with the cursor in the block. The block becomes alphaTex, and your original text tab is kept in a comment at its end. Settings lines at the top (`staves:`, `tracks:`, `file:`) stay as they are, and a block in a list or callout stays in it. To go back, select **Undo** in the notice, or press Ctrl+Z (Cmd+Z) in editing view.
- **Mistakes in tabs and scores**: a tab or score block with a mistake shows the error message and, folded under it, **Block text**: open it to see what you wrote, with the wrong line marked.
- **Where blocks go**: inserted and imported blocks never land inside the properties, or inside a code, math, HTML or comment block.
- **Imports into a new arrangement note**: the import fills the note's empty Tab or Chart block.
- **Chord files in UTF-16**: chord and ChordPro files saved in UTF-16 without a byte order mark now import, in any script (Cyrillic, Greek, Chinese, Japanese…). When a file can't be read, the import tells you.
- **Popout windows**: diagrams in a popout window play through that window, and are cleaned up when you close it.
- **Chord symbols from the web**: symbols written the way chord sheets on the web write them work (`C7(b9)`, `Cm(add9)`, `Cmaj7b5`, `C-5`). A chord the voicing database doesn't have gets its 4 easiest voicings instead of an error.

## [0.7.1](https://github.com/dsebastien/obsidian-music-practice/compare/0.7.0...0.7.1) (2026-11-02)

Fixes for the diagrams in your notes, from music-notation 0.5.2.

- **Scale fingering on keyboards**: a `fingering:` no longer disappears when the block also has `labels:`. The labels stay on the keys, and the finger numbers get their own row under them. With a `range:` that leaves out middle C's octave, the fingering now shows too: it starts on the first root inside the range, and every octave in the range stays lit.
- **Chords named from their frets**: a `chord` block with only `frets:` now names maj7 and m7 shell voicings without a fifth (`3x44xx` is Gmaj7, `x313xx` is Cm7). It also names 13th grips that leave out the 5th, 9th and 11th (`020120` is E13, `3x3455` is G13).
- **Slash chords**: the bass is spelled the way the chord spells it, so `x12010` is C7/Bb, not C7/A#.
- **Altered scale**: no more double sharps. G# altered is G# A B C D E F# (R b2 b3 b4 b5 b6 b7), not G# A A## B# C## E F#.
- **Play bar**: the sound dropdown is readable in dark themes, and the speed and volume knobs sit in the middle of their slider.

## [0.7.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.6.0...0.7.0) (2026-11-02)

Tabs, scores, triads and chord transitions, and every diagram plays.

- **Tabs and scores**: `tab` and `score` blocks in alphaTex, or a Guitar Pro / MusicXML file from your vault (`file: [[Song.gp]]`), drawn and played with alphaTab. Play, slow down and loop, with a metronome and a count-in. Export to Guitar Pro 7 or MIDI, or print. Everything is bundled with the plugin, so it works offline.
- **Hear the diagrams**: hover a chord, keyboard or fretboard diagram (tap it on a phone) and a play bar shows up. Chords strum, scales go up and down, and a click plays a note. Speed, loop, volume and sound are right there on the bar. The sound is recorded instruments by default (Settings → Playback). **Play this chord or scale** plays the current note.
- **Triads**: a chord's or a key's triads on a string set, with R, 3, 5 in the dots. Add them as notes ("G Major - Triad (strings 1-3, 1st inversion)"). An inversion comes after its root position.
- **Chord transitions**: **Easiest way between these chords** (on a chord pair note, or in a drill) shows the next chord's voicings that move your hand least. The fingers that stay or slide are marked, with tips in plain words. **Smooth this progression** does the same for a song's chord chart.
- **Imports**: Guitar Pro, MusicXML, Capella and ChordPro files (linked, or as editable text), and pasted text tabs and chord sheets.

Tabs, playback and exports work in popout windows. A `tab` block you wrote as plain text (`e|---0---|` lines) stays text.

The plugin is bigger (about 3 MB): alphaTab, its music font and a soundfont are inside, so nothing is ever downloaded. Their licenses (MPL-2.0, OFL, Apache-2.0) are at the end of main.js.

## [0.6.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.5.0...0.6.0) (2026-10-29)

Every way to play a chord.

- **Voicings of this chord**: on a guitar chord note, every playable voicing of the chord, the easiest first: the open chords you learn first, then E- and A-shape barres, the other CAGED shapes and the rest, each fingered and named. Narrow them down by neck area or by the string the root is on; add inversions or a stretch. The note's own voicing has a dashed border.
- **Add as note**: a new chord note for the voicing you pick ("A Major - E-shape barre"), with its frets, fingers and shape, and a diagram that draws them. Each shape gets its own note and its own mastery.
- **Use for this note**: another fingering or position of the note's own shape (or any voicing, when the note has no shape yet).
- **Voicings of a chord**: the same for any chord you type.
- **Add a learning note**: More voicings… picks one for the new note, and its shape comes along. Frets typed without fingers get their fingers worked out.
- Notation blocks: `voicings: all` in a `chord` block draws every voicing in a row (music-notation 0.4).

Tabs and scores with playback, and playing chords and scales, come in 0.7.

## [0.5.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.4.0...0.5.0) (2026-10-29)

Practice with the instrument in hand.

- **Practice panel**: open it from the ribbon's music icon or the Open practice panel command. The timer (now with pause), your session list (from a practice plan, or add items; tick them off, nudge the BPM you reached), the metronome, and Log this session with everything filled in.
- **Metronome and speed trainer**: accents, subdivisions, tap tempo. The speed trainer starts at a note's BPM and steps up to its target; Save BPM writes the tempo you reached.
- **Chord change drills**: switch between two chords for a minute and count the changes, both diagrams in view. Each pair gets its own exercise note with its best and last counts, so it shows up in practice next like any exercise.
- **Undo the last log**: an Undo button right after logging, and a command. Your notes go back to how they were; the session note goes to the trash.
- Commands for all of it: open the panel, pause the timer, start and stop the metronome, speed trainer, save BPM, drills, undo.

Tabs and scores with playback, and playing chords and scales, come in 0.6.

## [0.4.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.3.0...0.4.0) (2026-10-29)

Chords and scales, easier, and no more writing things twice.

- **Notes draw their own diagram**: in a chord or scale note, the empty diagram block draws what the note's properties say (chord, frets, fingers; scale root, type and shape). Change a property, the diagram follows. New notes keep the block empty, so nothing is written twice. On Obsidian Publish too, with one line in `publish.js` (see the Notation page).
- **Chords in words or frets**: type `A Major`, `F Sharp Minor 7`, or the frets `x02220` in Add a learning note, or in a ` ```chord ` block. **Identify this chord** names a chord note from its frets or pitches.
- **Scales and modes**: Add a learning note picks a scale's root, scale or mode, and shape, with a live preview. Fretboards draw boxes, CAGED shapes and three-notes-per-string positions; modes show their characteristic note; `compare: major` shows what changes; `modes: C major` draws every mode of a key.
- New property names in the settings: position, pitches, fingering, scale root, scale type, scale fingering.

Tabs and scores with playback, and playing chords and scales, come in 0.5.

## [0.3.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.2.0...0.3.0) (2026-10-28)

Diagrams side by side, sideways or mirrored.

- **Several diagrams in one block**: separate them with `---` to draw a song's chords or a scale's positions in a row; `columns: 3` makes a grid.
- **Orientation**: `orientation: horizontal` turns guitar chords sideways, `orientation: vertical` stands fretboards up and draws keyboards with their low notes at the bottom.
- **Left-handed**: `hand: left` mirrors guitar chords and fretboards. A setting makes it the default everywhere, next to a default orientation for chord diagrams, fretboards and keyboards.
- **Add a learning note** shows the four most common voicings of a guitar chord side by side: click one to pick it.

If you sync your vault across devices, update Music Practice on each of them: an older version drops the new settings when it saves its own.

Tabs and scores with playback, and playing chords and scales, come in 0.4.

## [0.2.0](https://github.com/dsebastien/obsidian-music-practice/compare/0.1.1...0.2.0) (2026-10-28)

Notation comes to Music Practice: chords, scales and songs drawn from plain text in your notes.

### Notation blocks

- **Chord diagrams**: write ` ```chord ` then `A x02220 x01230` (symbol, frets, fingers) and get a guitar diagram with barres, the position up the neck and the root notes marked. A symbol alone (`Am`) picks a common voicing. Piano chords too: `C/G` with `instrument: piano`.
- **Keyboards and fretboards**: the notes of a scale, a chord or a list, labeled as notes, degrees or intervals (`D dorian`, `scale: A minor pentatonic` on frets 5 to 8).
- **Chord charts**: songs in ChordPro (chords above the lyrics, verses and choruses), transposable with `{transpose: 2}`.
- A block with a mistake says what to write instead; your note is never changed.
- One switch per kind of block in the settings. If another plugin already draws one of them, Music Practice leaves it alone.

### New chord notes

- **Add a learning note** offers the voicings found for the chord you type, with a preview. The note gets its frets, fingers and a diagram, in the template's empty chord block when it has one.

### On Obsidian Publish

- The blocks are drawn by the open-source [Music Notation](https://github.com/dsebastien/music-notation) library, which also renders them on Publish sites with a small `publish.js` loader.

Tabs and scores with playback, and playing chords and scales, come in 0.3.

## [0.1.1](https://github.com/dsebastien/obsidian-music-practice/compare/0.1.0...0.1.1) (2026-10-28)

Maintenance release: no change in behavior.

- Security updates of development dependencies flagged by the community directory review (`fast-uri`, `moment`). None of them ship in the plugin.
- A small code cleanup flagged by the same review.

## 0.1.0 (2026-10-28)

The first release of Music Practice: learn an instrument in your notes.

### What you can do

- **Practice next**: what's due for review, what to practice next (ranked by priority, staleness, BPM gap and what it unlocks) and what's ready to learn.
- **Plan a practice session**: the minutes you have, split into warm-up, focus, review and fun, with the items to work on.
- **Log practice** in under a minute: minutes, the items you practiced, their mastery, BPM and review results, the session quality and a note. Writes the session note, updates each item and adds the time to your practice activity, without ever counting time twice.
- **Practice timer** in the status bar; stopping it opens Log practice with the minutes.
- **Change mastery** with what each level means for that kind of item, and **set BPM** (reaching the target offers "Can play at tempo").
- **Add a learning note**: type a chord symbol (F#m7, C/G) and get its name, root, quality and alias.
- **Spaced review** that catches what's getting rusty.

### Works with your setup

- With the Obsidian Starter Kit, its note types define your learning notes and sessions. Without it, tag notes `type/music/guitar/chord` and give them a mastery level.
- With the Kanban Action Planner, both plugins write the same time and review properties, and Log practice takes over its running timer.
- Every rule (levels, review intervals, score weights, plan blocks, rubric, property names) is a setting with sensible defaults.
- A public API lets scripts and AI assistants log and plan practice with the same rules.

Notation (chord diagrams, tabs and scores with playback) comes in 0.2.
















