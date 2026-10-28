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
