# Release Notes

## 0.22.0 (2026-11-10)

Save a diagram or a whole block as a PNG or SVG file: right-click it, and it goes into your attachments or a folder you choose, with an optional link after the block. Also a clearer ear training question.

#### Save diagrams as images

- Right-click a diagram (long-press on a phone): **Save diagram as PNG** or **Save diagram as SVG**, with its title and captions, in your theme's colors on its background. On a block with several diagrams, **Save block as PNG** and **Save block as SVG** save the whole block (#51).
- Chord diagrams, keyboards, fretboards, chord charts, strumming and picking patterns, progressions and the circle of fifths, with playback on or off. Not tabs and scores.
- The file is named after the note and the diagram (`Wonderwall - Em7.png`; sharps spelled out) and goes where Obsidian puts the note's attachments, or in **Settings → Notation blocks → Diagram images folder**.
- **Embed saved images** (off by default) puts a link to the file right after the block.

#### Ear training

- The question is easier to read: **Play again** (or R) is the main button, with **Key** for degrees and **Show me** set apart, and the answers are large buttons in a grid. All seven degrees fit on one row.

## 0.21.0 (2026-11-10)

Ear training: hear an interval, a chord, a scale or a scale degree and name it, with your weak spots asked most and a guided start. Also Copy as image on every block, root marks you can tell without colors, formulas under diagrams, and descriptions for screen readers. From music-notation 0.19.0.

#### Ear training

Run **Ear training: intervals, chords, scales and degrees**, or **Drill** then **Ear training** in the practice panel (#72).

- **Intervals by ear** (up, down or together, up to two octaves), **Chords by ear** (block or arpeggio), **Scales by ear** (scales and modes) and **Degrees by ear** (a cadence sets the key, then name the degree of one note).
- Piano or guitar sound. **Play again** (or R), **Key** for degrees, and **Show me**, which counts as a miss.
- **Guided** (on by default): start with two items and get the next one once you know them all. Ear training has its own **Fast answer** time, 4 seconds by default, as naming what you hear takes longer.
- As in the other drills: 20 questions, your weak spots asked most, and the map of your weak spots when you save. The drill notes are music exercise notes (`type/music/exercise`) with `exercise_kind: Ear training`; they use four new `drill_kind` values, `Intervals by ear`, `Chords by ear`, `Scales by ear` and `Degrees by ear`: add them, and `drill_kind`, `drill_setting` and `drill_stats`, to your music exercise type.
- With playback off (**Settings → Playback**), ear training can't start.

#### Diagrams

- **Copy as image**: a button on the bar under each block copies the selected diagram (Shift+click: the whole block) as a picture, with its title and captions, to paste in a chat or a document. With playback off, each block gets a small bar with only this button (#11 in music-notation).
- **Settings → Notation blocks → Root marks**: **Color and shape** draws the root as a square dot, a square ring on an open string and a small square on its key, so you can tell it without seeing colors. Drills follow it. A block can say `root-mark: shape` (#14 in music-notation).
- `caption: formula` under a chord or scale: its notes, its formula (1 b3 5 b7), the other ways to write it, and a scale's steps. `caption: fingering, formula` gives both (#52 in music-notation).
- Screen readers read a description of each diagram: the fingering, the keys and the root, or the notes string by string.
- On a phone, the drill setup shows one field per line.

## 0.20.0 (2026-11-10)

Drills by ear: hear a note, then find it on the fretboard or the keyboard. Also tabs and scores with the same play bar as every other block, fingering in words under the chords of a progression, and the usual names for two seventh chords. From music-notation 0.18.1.

#### Drills by ear

Run **Drill notes, chords or scales** and pick **Fretboard by ear** or **Keyboard by ear** (#91).

- A note sounds; click where it is on the neck or the keys. **Play again** (or R) plays it again, and **Reference** plays a reference note.
- By default any octave of the note is right. Turn on **Exact octave** to ask for the very note you heard, and **Reference note first** to hear C4 (or the lowest note of your strings and frets) before each question.
- As in the other drills: 20 questions, your weak spots asked most, and the map of your weak spots on the drill's note when you save. The drill notes use two new `drill_kind` values, `Fretboard by ear` and `Keyboard by ear`: add them to your guitar and piano exercise types.
- With playback off (**Settings → Playback**), drills by ear can't start.

#### Also new

- **Tabs and scores**: their play bar now looks and works like the other bars: the same buttons, the speed with its value ("100 %"), always shown below the score. It has no volume slider anymore: tabs and scores play at **Settings → Playback → Volume**, and a change is heard at once.
- **Fingering in words under a progression**: `caption: fingering` in a `progression` block writes how to play each chord, in the voicing the progression picked.
- **Usual chord names**: harmonize and numerals write Am(maj7) and `i(maj7)`, C+maj7 and `bIII+maj7`, as method books do. Your progressions still read the old spellings.
- **Chord change tips** in drop D and other tunings with two strings of one name say "the 4th string (D)".

#### Fixed

- The options of the new drills showed as empty boxes; they are checkboxes now.

## 0.19.0 (2026-11-09)

Note names in solfège or German for every diagram and drill, a capo chord named by its sound, and a volume you can change while the music plays. From music-notation 0.17.0.

#### Note names: letters, solfège or German

**Settings → Notation → Note names**: Letters (C D E), Solfège (Do Ré Mi) or German (H for B, B for B flat).

- Every diagram follows it: titles, dots, keys, string names, chord charts, progressions and the circle of fifths. A block with its own `naming:` line keeps it.
- The drills too: the questions ("Find Do on string 5"), the note buttons, the chord and scale choices, the answer ("It was La♯.") and the map of your weak spots. So do the fretboard and keyboard you click in Add a learning note, and the titles in Easiest way and Triads.
- Only the display changes. Your blocks are read as you wrote them, and note titles, properties and drill notes stay in letters, so nothing in your vault changes (#92).

#### Also new

- **A capo chord named by its sound**: `sounds: title` in a chord block titles an Em shape with `capo: 3` "Gm (Em shape)".
- **Volume, at once**: a change of **Settings → Playback → Volume** is heard right away, in what plays too: diagrams, patterns, progressions, charts and the backing loop. Before, it was heard from the next play or loop pass, and a change stopped what played (#95).
- **Phones**: keyboard drills start on one octave (C4-B4) on a phone, so the keys are large enough to tap; the clickable fretboards and keyboards are larger on touch screens, and a tap on them no longer moves the note's cursor (#94).

#### Fixed

- Blocks with their own `naming: solfege` or `naming: german` line are read right for your drills, the key of a piece and the backing loop. Before, "Do Fa Sol7" gave only "Do", read as D diminished (#93).
- With `naming: solfege`, "Do major" draws the C major scale, not an arpeggio, and `scale: Ré minor` works.
- Tabs and scores no longer scroll the page when you press Play.

## 0.18.0 (2026-11-09)

Drill the notes on the neck and on the keys, name chords and scales at a glance, and enter chords by clicking a fretboard or a keyboard.

#### Note, chord and scale drills

Run **Drill notes, chords or scales**, or **Drill** then **Notes, chords and scales** in the practice panel.

- **Fretboard notes**: pick the strings and the frets. "Find C on string 5": click it on the neck. "Name the marked note": click its name.
- **Keyboard notes**: pick the lowest and highest key. Find a key, or name the marked one.
- **Chord names**: name a chord from its diagram, among 4. The chords come from your chord notes (your current focus first), from your pieces (chords they play that have no note yet), from what your focus needs, or from the library, in one chord family if you want.
- **Scale shapes**: name a scale from its shape, or find its notes on the drawing.
- **Your weak spots come back most**: 6 questions in 10 are about the places you miss or answer slowly. A spot stops being weak after 3 right answers in a row, each under 2 seconds. These numbers, and the 20 questions of a drill, are settings.
- **Hear what you click**: each click plays its note when playback is on.
- **The score**: your right answers, your time, and a map of your weak spots with the right answers in each spot.
- **Save** keeps the drill in its own exercise note ("Fretboard notes, string 5, frets 0-5"): its kind and setting, the map of weak spots, and a review. A new drill note is private (`public_note: false`). **Log this drill** logs it with your practice timer.
- **Create note**: a chord or a scale that has no note yet gets one from the drill, made from its note type's template.

The drill notes use three properties: `drill_kind`, `drill_setting` and `drill_stats`. Add them to your guitar and piano exercise note types, or rename them in Settings → Property names.

#### Click to enter a chord

- **Add a learning note**: click the frets of a guitar chord on a fretboard, or the keys of a piano chord on a keyboard. The field and the drawing follow each other, and the chord is named for you.
- **Near matches**: when your notes make no chord, the chords that hold them are listed, with the missing notes named and marked. In Add a learning note and Voicings of a chord, click one to use it.
- **Identify this chord** opens a fretboard or a keyboard when the note has no frets or keys yet, and **Voicings of a chord** takes clicked frets.
- Piano chords take typed keys too (`C4 E4 G4`), and keep your spelling.

#### Also

- The music notation library is now 0.16.0. Blocks can show note names in solfège (Do Ré Mi) or German (H): write `naming: solfege` or `naming: german` in a block.

## 0.17.0 (2026-11-07)

Play along with the recording of a song: a new ` ```playalong ` block plays an audio or a video file of your vault, loops a passage, slows it down without changing its pitch and counts you in before each pass.

- **The block**: a `file: [[Song.mp3]]` line, then the song's sections, one a line (`0:12 Verse`, `0:45.5 Chorus`). Audio (mp3, m4a, wav, flac, ogg, opus…) and video files (mp4, webm, mov…) work; a video shows its picture.
- **A-B loop**: set A and B at the playhead, and the passage plays again and again. Each pass starts a little before A, so the first note isn't cut (Settings → Play-along → Pre-roll).
- **Slow it down**: from 50 % to 125 %, in steps of 5 %, without a pitch change.
- **Sections**: select a section to jump there, or its loop button to loop it. **Add a section** writes a new one at the playhead into the block, while the music plays on.
- **Count-in before each pass**: the metronome clicks a bar at the recording's tempo times the speed, and the passage starts on the next beat. The tempo is the block's `tempo:` line, else the note's target BPM. Tap it on the player once: it is written as the `tempo:` line.
- **Practice**: Play puts a learning note in the practice panel's list, and **Save BPM** keeps the tempo you reached. One player plays at a time, and never together with the metronome or the backing loop.
- **Keyboard**: select the player, then Space plays and pauses, `[` and `]` set A and B, L loops, the arrows move 5 s, − and + change the speed, C, T and M turn the count-in on or off, tap the tempo and add a section.

## 0.16.0 (2026-11-05)

A new way to play the diagrams, from music-notation 0.14.0: one play bar under each block, and a click on a diagram plays it.

- **Click a diagram to hear it**: a click on a chord, keyboard or fretboard diagram plays it, and a second click stops it. A click on a dot or a key still plays only that note. With the keyboard, Tab to a diagram and press Space or Enter; Escape stops it.
- **One play bar under each block**: the bar no longer covers the bottom of each diagram when the mouse is over it. Each block has one bar under it, a single diagram too. In a row of voicings or the positions of a scale, the bar plays the diagram you clicked last (it is outlined and named on the bar), and **Play all in turn** plays every diagram, with a beat of silence between two. With loop on, it starts again after the last one. Choosing piano or guitar on the bar redraws every diagram of the block for that instrument.
- **The volume is in Settings → Playback only**: no bar has a volume slider any more. A change in the settings applies at once, also to the bars already on the page.
- **Every bar under what it plays**: the bars of strumming and picking patterns, progressions and chord charts now sit under them, always shown. In a progression or a chart, a click on a chord diagram plays that chord.
- **Readable speeds**: the sliders show their value, such as "90 BPM" or "12 ms", instead of a small music sign.
- **The hand cursor on everything you can click**: diagrams, dots, keys, the bars' buttons and lists, and the cells of the voicing, triad and transition grids.

## 0.15.2 (2026-11-04)

### Bug Fixes

- **build:** build with NODE_ENV=production in every setup, keep building without network

## 0.15.1 (2026-11-04)

- **Reliable reload, for good**: when Obsidian reloaded the plugin twice in quick succession (an update and a restart of the plugin close together), it could run two copies at once and the newer one drew no music blocks until Obsidian restarted. The plugin now replaces an older copy that is still running before it starts (#90).

## 0.15.0 (2026-11-04)

Fingering in words, both hands' scale fingering and the chords of any scale, from music-notation 0.13.0. The plugin also loads reliably after a quick reload.

- **Fingering in words**: `caption: fingering` on a `chord` block writes how to play the chord under its diagram: "Strum from the 5th string (A). Index on the D string, 2nd fret. Middle on the G string, 2nd fret." It names barres, the thumb, muted and open strings and the capo. In drop D, DADGAD and open tunings, strings go by number and note ("the 4th string (D)"). Piano chords say each hand's fingers on their keys. Put it in a first part before `---` to caption a whole row.
- **Both hands' scale fingering**: `fingering: auto both` on a keyboard scale draws two keyboards, the right hand's standard fingering, then the left hand's an octave lower, each playable on its own.
- **The chords of any scale**: a `progression` block with `key:` and `harmonize: triads`, `sevenths`, `sus` or `power`, and no chords, draws the chord on each degree with its numeral, diagrams and the play bar. It works for any 7-note scale: major, minor, the modes, harmonic and melodic minor. Several scales go in one block, separated by `---`.
- **Reliable reload**: when Obsidian reloaded the plugin while it was still starting (a quick disable and enable, or an update while it loaded), the plugin could fail to load ("Failed to load plugin"), and an older copy kept drawing the music blocks until Obsidian restarted. It now stops the older copy's start-up, and a leftover `obsidian://music-practice` link handler no longer stops the plugin from loading (#90).

## 0.14.0 (2026-11-04)

Chord charts play bar by bar, the play bars of a learning note's patterns, progressions and charts get Save BPM, and voicing grids keep their necks in line. From music-notation 0.12.0.

- **Practice this progression in time follows a chart's bars**: a chart line with bar lines plays each chord for its beats (dots, slashes, `%` bars), and a bar of N.C. is a bar of silence. A line without bar lines still plays one chord a bar. A chart without `{time}` counts its beats in the note's time signature. Each chord is lit while it sounds, a silent bar shows as N.C., and the status counts the bars: "3 bars of 4/4, as the chart's bar lines say" (#89).
- **`{define}` shapes and the capo in the loop**: a chord with a `{define}` shape plays that shape, and under `{capo}` the chords sound where the capo puts them. Before, the loop played each chord from its name, as if there were no capo (#89).
- **Chord charts play bar by bar**: write bar lines `|` in a chart line to say how long its chords last in the chart's play bar. `| [G5]. . [D5]. [A5]. |` is two beats of G5, then one of D5 and one of A5. A bar with no chord (or only `%`) holds the chord before it, and a bar of N.C. is a bar of silence. The chart looks the same. A chart that already has bar lines, such as a 12-bar blues grid, now plays with those lengths. Before, each chord played for one bar.
- **Save BPM in strumming, picking, progression and chart bars**: in a learning note, these play bars end with **Save BPM** (the gauge icon). It opens Set BPM with the tempo set on the bar, rounded. In 6/8, 9/8 and 12/8, that tempo counts dotted beats, as the note's BPM does. Before, you typed the tempo in Set BPM (#88).
- **Voicing grids keep their necks in line**: in **Voicings of this chord**, **Triads of a chord or key**, the voicings of **Add a learning note** and its **More voicings…**, **Easiest way between these chords** and **Smooth this progression**, a long voicing name (such as "E shape (strings 1-4)") wraps onto two lines, and every diagram of the grid keeps its neck in line with the others. Before, that diagram was drawn smaller (#87).
- **Long titles wrap in blocks too**: a long title on a chord diagram or a fretboard, such as "F#m7b5, Drop 3 (strings 2-4, 6)", wraps onto two or three lines instead of making the diagram wider. The other diagrams of the block keep the same room above them, so their necks stay in line. A diagram you titled at length is now narrower and a little taller.
- **Tab exercises with a capo**: in a fretboard block, `exercise:` now works with `capo:`. The tab shows the frets the diagram shows, counted from the capo, and sounds where the capo puts it. `frets-from: nut` shows the real neck's frets. Before, the block said to leave the capo out.
- **Larger diagrams on touch screens**: on phones and tablets, chord diagrams and fretboards are a third larger, so each string is easier to tap. They still fit the page.
- **Import a text tab**: the dialog says the rhythm comes from the spacing, which is what the import does. Before, it said every note was an eighth. This shipped in 0.13.0, but its notes didn't say so.
- **Publish**: pin the library at 0.12.0 for bars in a chart, tab exercises with a capo and long titles that wrap.

## 0.13.0 (2026-11-04)

Log practice now follows the same session rules as the Obsidian Starter Kit: a session counts for the activity that lists its type, items get their minutes from their sessions, and logging the same session twice never counts it twice.

- **Sessions count for the activity that lists their type**: an activity's `session_types` lists the session note types that count for it (for example `guitar-practice-sessions`). One activity per type: a type listed by two activities counts for neither. Archived activities are ignored. Without the Obsidian Starter Kit, and as long as no note uses `session_types`, the activity is found as before.
- **Log practice asks when no activity counts the session**: pick an existing activity (closest names first), **New activity…** (the **Activity name** setting proposes the name, and you can change it), or **No activity**. An existing activity gets the session type in its `session_types`; other activities that list it lose it, and the dialog names them. A new activity is created only when you select **Log practice**, with a `created` date.
- **Minutes per item**: the session note lists the minutes each item got in `practiced_minutes` (`"13 [[A Minor]]"`), when its session type has that property.
- **Item minutes come from the sessions**: an item's `time_spent` is computed from its session notes (its `practiced_minutes` value, or an even share of the session for older sessions that only list it). Nothing is added to it anymore, and it's never lowered on its own: when an item stores more, it stays and a notice tells you.
- **Activity minutes are never lowered on their own**: when an activity stores more minutes than its time entries and sessions give, a notice asks you. **Keep** adds the difference as a "Manual adjustment" time entry starting at midnight on the day the activity was created (earlier if it would otherwise end in the future). **Drop** lowers the minutes.
- **Safe to log twice**: log the same session again (same items, date, minutes and start time) and its session note is reused; a review isn't counted twice. Without a start time from a timer, only a session note Music Practice created on this device in the last 15 minutes is reused, so two real sessions stay two notes. A rerun with other values (mastery, BPM, review) is refused.
- **Undo**: **Undo last practice log** also undoes a Keep or Drop, and after a rerun it still undoes the first log. Your activity choice stays: an activity it created, or a session type it added to `session_types`, isn't removed.
- **Settings**: **Minutes per item** (`practiced_minutes`) and **Session types** (`session_types`) in the property names.
- **API**: `logPractice` takes `activity` (an activity note's name or path, or `null` for none) and returns `reused`, `createdActivity` and `activity.decision`.

## 0.12.0 (2026-11-04)

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

## 0.11.1 (2026-11-03)

A practice timer you forgot can now be discarded and shows as forgotten, and long text tab lines are fast again. From music-notation 0.10.1.

- **Discard a forgotten timer**: throw away a timer you forgot, without logging it. Use **Discard practice timer**, the **Discard** button in the practice panel, **Discard timer** in Log practice when you stop the timer, or a right-click on the timer in the status bar. It always asks first and says how long the timer ran. Before, only logging it cleared it.
- **Forgotten timers stand out**: a timer that started more than 4 hours ago (pauses included) shows "forgotten?" in the status bar and the practice panel. If you try to start a new timer while it runs, the notice says how to discard the old one.
- **Shortcut**: `obsidian://music-practice?do=discard-timer` asks, then discards the timer.
- **Long text tab lines are fast again**: a text tab line with no bar lines is split into bars quickly again, in your notes, in **Import a text tab** and in **Edit as alphaTex**. In 0.11.0, a long palm mute (PM) or slide line got slower the longer it was: a palm mute line of 50,000 columns took 499 ms. It now takes 64 ms, and the output is the same. Real tabs (about 100 columns) were not slowed down in practice.

## 0.11.0 (2026-11-03)

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

## 0.10.0 (2026-11-03)

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

## 0.9.0 (2026-11-03)

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

## 0.8.2 (2026-11-03)

The piano plays, and a diagram's sound menu redraws it for the other instrument. From music-notation 0.7.0.

- **Piano sound**: with recorded instruments (the default sound, Settings → Playback), keyboards and piano chords now play their notes. Before, they played nothing, and Piano in a fretboard's sound menu changed nothing.
- **Scales play every note**: a scale on a fretboard or a keyboard now plays every note drawn, from the lowest to the highest and back down, with the top note once. Before, it played only from its lowest root to its highest one, so A minor pentatonic box 1 dropped its top C5, and boxes 2 to 4 played 6 of their 12 dots.
- **The other instrument, drawn**: choosing Piano in a guitar chord's or a fretboard's sound menu redraws it as a keyboard with the same notes, and choosing Guitar on a keyboard redraws it as a fretboard. If something is playing, it stops first. The title, the root and the note, degree or interval labels come along. Choose the diagram's own instrument to get its drawing back. A click on a note plays it on either drawing.
- **Fingering on note lists**: `fingering:` works on keyboard note lists, one finger per note in the order written, so you can draw five-finger and hand positions. `notes: C D E F G` with `fingering: 1 2 3 4 5` puts fingers 1 to 5 on C4 to G4, and `labels:` works as for scales.
- **`root:` in a chord block**: it now shows an error that says it only applies to note lists on fretboards and keyboards. Before, it did nothing.
- **Hand positions aren't chords**: five notes or more that only move by steps within an octave are no longer named as a chord. `C4 D4 E4 F4 G4` is a hand position, not Dm11/C, and gets no root marks. Chords with a step in them keep their names, from Cadd9 and Csus2 to four-note jazz clusters such as Cmaj9/B.

## 0.8.1 (2026-11-03)

New for the diagrams in your notes, from music-notation 0.6.0.

- **A root for note lists**: add `root: C` to a fretboard or keyboard block that lists notes (`notes: C Eb Gb A`). `labels: intervals` and `labels: degrees` then count from that root, and the root gets the root color when it is in the list. It doesn't have to be.
- **Positions in neck order**: `positions: all` draws a scale's positions up the neck, each one at or above the one before. A minor pentatonic's boxes 4 and 5 now sit at frets 12–15 and 14–17, not 0–3 and 2–5. A list of positions (`positions: 1 3`) keeps those frets.
- **Numbering from the relative minor**: `numbering: minor` counts a major pentatonic's positions from its relative minor, as many courses do. A major pentatonic's position 1 is then box 1 of F# minor pentatonic, and the titles add "(from F#m)".
- **One position where you want it**: a single `position:` with `frets:` is drawn inside those frets, so `position: 4` with `frets: 10-17` is box 4 at frets 12–15. When no octave of it fits, the block says so.

## 0.8.0 (2026-11-03)

Turn a text tab into a tab you can play, plus fixes for imports and popout windows.

- **Convert a text tab**: a ` ```tab ` or ` ```score ` block that holds a plain-text tab (`e|---0---|` lines) now has a **Convert to a playable tab** button under it (not on canvas cards). The command **Convert this text tab into a playable tab** does the same with the cursor in the block. The block becomes alphaTex, and your original text tab is kept in a comment at its end. Settings lines at the top (`staves:`, `tracks:`, `file:`) stay as they are, and a block in a list or callout stays in it. To go back, select **Undo** in the notice, or press Ctrl+Z (Cmd+Z) in editing view.
- **Mistakes in tabs and scores**: a tab or score block with a mistake shows the error message and, folded under it, **Block text**: open it to see what you wrote, with the wrong line marked.
- **Where blocks go**: inserted and imported blocks never land inside the properties, or inside a code, math, HTML or comment block.
- **Imports into a new arrangement note**: the import fills the note's empty Tab or Chart block.
- **Chord files in UTF-16**: chord and ChordPro files saved in UTF-16 without a byte order mark now import, in any script (Cyrillic, Greek, Chinese, Japanese…). When a file can't be read, the import tells you.
- **Popout windows**: diagrams in a popout window play through that window, and are cleaned up when you close it.
- **Chord symbols from the web**: symbols written the way chord sheets on the web write them work (`C7(b9)`, `Cm(add9)`, `Cmaj7b5`, `C-5`). A chord the voicing database doesn't have gets its 4 easiest voicings instead of an error.

## 0.7.1 (2026-11-02)

Fixes for the diagrams in your notes, from music-notation 0.5.2.

- **Scale fingering on keyboards**: a `fingering:` no longer disappears when the block also has `labels:`. The labels stay on the keys, and the finger numbers get their own row under them. With a `range:` that leaves out middle C's octave, the fingering now shows too: it starts on the first root inside the range, and every octave in the range stays lit.
- **Chords named from their frets**: a `chord` block with only `frets:` now names maj7 and m7 shell voicings without a fifth (`3x44xx` is Gmaj7, `x313xx` is Cm7). It also names 13th grips that leave out the 5th, 9th and 11th (`020120` is E13, `3x3455` is G13).
- **Slash chords**: the bass is spelled the way the chord spells it, so `x12010` is C7/Bb, not C7/A#.
- **Altered scale**: no more double sharps. G# altered is G# A B C D E F# (R b2 b3 b4 b5 b6 b7), not G# A A## B# C## E F#.
- **Play bar**: the sound dropdown is readable in dark themes, and the speed and volume knobs sit in the middle of their slider.

## 0.7.0 (2026-11-02)

Tabs, scores, triads and chord transitions, and every diagram plays.

- **Tabs and scores**: `tab` and `score` blocks in alphaTex, or a Guitar Pro / MusicXML file from your vault (`file: [[Song.gp]]`), drawn and played with alphaTab. Play, slow down and loop, with a metronome and a count-in. Export to Guitar Pro 7 or MIDI, or print. Everything is bundled with the plugin, so it works offline.
- **Hear the diagrams**: hover a chord, keyboard or fretboard diagram (tap it on a phone) and a play bar shows up. Chords strum, scales go up and down, and a click plays a note. Speed, loop, volume and sound are right there on the bar. The sound is recorded instruments by default (Settings → Playback). **Play this chord or scale** plays the current note.
- **Triads**: a chord's or a key's triads on a string set, with R, 3, 5 in the dots. Add them as notes ("G Major - Triad (strings 1-3, 1st inversion)"). An inversion comes after its root position.
- **Chord transitions**: **Easiest way between these chords** (on a chord pair note, or in a drill) shows the next chord's voicings that move your hand least. The fingers that stay or slide are marked, with tips in plain words. **Smooth this progression** does the same for a song's chord chart.
- **Imports**: Guitar Pro, MusicXML, Capella and ChordPro files (linked, or as editable text), and pasted text tabs and chord sheets.

Tabs, playback and exports work in popout windows. A `tab` block you wrote as plain text (`e|---0---|` lines) stays text.

The plugin is bigger (about 3 MB): alphaTab, its music font and a soundfont are inside, so nothing is ever downloaded. Their licenses (MPL-2.0, OFL, Apache-2.0) are at the end of main.js.

## 0.6.0 (2026-10-29)

Every way to play a chord.

- **Voicings of this chord**: on a guitar chord note, every playable voicing of the chord, the easiest first: the open chords you learn first, then E- and A-shape barres, the other CAGED shapes and the rest, each fingered and named. Narrow them down by neck area or by the string the root is on; add inversions or a stretch. The note's own voicing has a dashed border.
- **Add as note**: a new chord note for the voicing you pick ("A Major - E-shape barre"), with its frets, fingers and shape, and a diagram that draws them. Each shape gets its own note and its own mastery.
- **Use for this note**: another fingering or position of the note's own shape (or any voicing, when the note has no shape yet).
- **Voicings of a chord**: the same for any chord you type.
- **Add a learning note**: More voicings… picks one for the new note, and its shape comes along. Frets typed without fingers get their fingers worked out.
- Notation blocks: `voicings: all` in a `chord` block draws every voicing in a row (music-notation 0.4).

Tabs and scores with playback, and playing chords and scales, come in 0.7.

## 0.5.0 (2026-10-29)

Practice with the instrument in hand.

- **Practice panel**: open it from the ribbon's music icon or the Open practice panel command. The timer (now with pause), your session list (from a practice plan, or add items; tick them off, nudge the BPM you reached), the metronome, and Log this session with everything filled in.
- **Metronome and speed trainer**: accents, subdivisions, tap tempo. The speed trainer starts at a note's BPM and steps up to its target; Save BPM writes the tempo you reached.
- **Chord change drills**: switch between two chords for a minute and count the changes, both diagrams in view. Each pair gets its own exercise note with its best and last counts, so it shows up in practice next like any exercise.
- **Undo the last log**: an Undo button right after logging, and a command. Your notes go back to how they were; the session note goes to the trash.
- Commands for all of it: open the panel, pause the timer, start and stop the metronome, speed trainer, save BPM, drills, undo.

Tabs and scores with playback, and playing chords and scales, come in 0.6.

## 0.4.0 (2026-10-29)

Chords and scales, easier, and no more writing things twice.

- **Notes draw their own diagram**: in a chord or scale note, the empty diagram block draws what the note's properties say (chord, frets, fingers; scale root, type and shape). Change a property, the diagram follows. New notes keep the block empty, so nothing is written twice. On Obsidian Publish too, with one line in `publish.js` (see the Notation page).
- **Chords in words or frets**: type `A Major`, `F Sharp Minor 7`, or the frets `x02220` in Add a learning note, or in a ` ```chord ` block. **Identify this chord** names a chord note from its frets or pitches.
- **Scales and modes**: Add a learning note picks a scale's root, scale or mode, and shape, with a live preview. Fretboards draw boxes, CAGED shapes and three-notes-per-string positions; modes show their characteristic note; `compare: major` shows what changes; `modes: C major` draws every mode of a key.
- New property names in the settings: position, pitches, fingering, scale root, scale type, scale fingering.

Tabs and scores with playback, and playing chords and scales, come in 0.5.

## 0.3.0 (2026-10-28)

Diagrams side by side, sideways or mirrored.

- **Several diagrams in one block**: separate them with `---` to draw a song's chords or a scale's positions in a row; `columns: 3` makes a grid.
- **Orientation**: `orientation: horizontal` turns guitar chords sideways, `orientation: vertical` stands fretboards up and draws keyboards with their low notes at the bottom.
- **Left-handed**: `hand: left` mirrors guitar chords and fretboards. A setting makes it the default everywhere, next to a default orientation for chord diagrams, fretboards and keyboards.
- **Add a learning note** shows the four most common voicings of a guitar chord side by side: click one to pick it.

If you sync your vault across devices, update Music Practice on each of them: an older version drops the new settings when it saves its own.

Tabs and scores with playback, and playing chords and scales, come in 0.4.

## 0.2.0 (2026-10-28)

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

## 0.1.1 (2026-10-28)

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
