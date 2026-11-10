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
