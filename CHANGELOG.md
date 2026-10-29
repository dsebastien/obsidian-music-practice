# Changelog

All notable changes to this project will be documented in this file.

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






