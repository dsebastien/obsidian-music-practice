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
