Ear training: hear an interval, a chord, a scale or a scale degree and name it, with your weak spots asked most and a guided start. Also root marks you can tell without colors, formulas under diagrams, and descriptions for screen readers. From music-notation 0.19.0.

#### Ear training

Run **Ear training: intervals, chords, scales and degrees**, or **Drill** then **Ear training** in the practice panel (#72).

- **Intervals by ear** (up, down or together, up to two octaves), **Chords by ear** (block or arpeggio), **Scales by ear** (scales and modes) and **Degrees by ear** (a cadence sets the key, then name the degree of one note).
- Piano or guitar sound. **Play again** (or R), **Key** for degrees, and **Show me**, which counts as a miss.
- **Guided** (on by default): start with two items and get the next one once you know them all. Ear training has its own **Fast answer** time, 4 seconds by default, as naming what you hear takes longer.
- As in the other drills: 20 questions, your weak spots asked most, and the map of your weak spots when you save. The drill notes are music exercise notes (`type/music/exercise`) with `exercise_kind: Ear training`; they use four new `drill_kind` values, `Intervals by ear`, `Chords by ear`, `Scales by ear` and `Degrees by ear`: add them, and `drill_kind`, `drill_setting` and `drill_stats`, to your music exercise type.
- With playback off (**Settings → Playback**), ear training can't start.

#### Diagrams

- **Settings → Notation blocks → Root marks**: **Color and shape** draws the root as a square dot, a square ring on an open string and a small square on its key, so you can tell it without seeing colors. Drills follow it. A block can say `root-mark: shape` (#14 in music-notation).
- `caption: formula` under a chord or scale: its notes, its formula (1 b3 5 b7), the other ways to write it, and a scale's steps. `caption: fingering, formula` gives both (#52 in music-notation).
- Screen readers read a description of each diagram: the fingering, the keys and the root, or the notes string by string.
- On a phone, the drill setup shows one field per line.
