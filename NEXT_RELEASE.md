**Simplify this chart** is a new command: on a note with a chord chart, it says which chords have an easier one and which capo gives the most open shapes, then switches them on in the chart or writes a simpler copy below it. The play bars get two things from music-notation 0.25.0, the library the plugin bundles: a **Simplify** switch on guitar charts, and the four guitars in the **Sound** menu.

#### Simplify this chart

- **What the window says**: on a note with a chord chart (a `chords` block), the command lists the chords that have an easier one ("Easier chords: Cmaj9 → Cmaj7, G5 → G, E9 → E7") and the best capo, with the shapes to play. For Bb, Eb, F and Gm: "Best capo: fret 3. Play G, C, D, Em (4 of 4 open shapes)." Under it, a preview of the chart with both on (#68).
- **Switch on in the chart**: writes `{simplify}` and `{capo: auto}` at the top of the block, each one only when it helps. The chart then draws and plays its easier version, and the chords you wrote stay in the block.
- **Insert a simpler copy**: adds a new chart below the first one, written out: the easier chords in the lyrics, or the capo's shapes with a `{capo: 3}` line. The original chart doesn't change.
- **Only when it's easier**: a chord changes only when a plainer chord of its family is easier to play. Am7 stays, because its open shape is easier than Am.
- **In the chart's own naming**: the window names the chords as the chart draws them, in its `{naming: …}` line, else in **Settings → Notation blocks → Note names**. The copy keeps the chart's naming, so a chord that changes is written in it.
- **Several charts, piano charts, a capo already there**: a note with several charts gets a list to pick one. A piano chart has nothing to offer: "Easier chords and the best capo are for guitar charts." A chart with its own capo (`{capo: 2}`) already holds the shapes you play, so the window looks for no other capo.

#### Play bars

- **The Simplify switch**: the bar of a guitar chart gets a **Simplify** switch when one of its chords has an easier one. One click shows the easier chords in the lyrics and in the chords used row, and the switch reads **Simplified**. A second click brings back the chords as written. Nothing is written in the note.
- **Easier charts by hand**: you can write `{simplify}` and `{capo: auto}` in a chart yourself, without the command. With both, `[Bbmaj9]One [Eb]two [F]three [Gm]four` draws Gmaj7, C, D and Em, with a capo on fret 3.
- **Four guitars in the Sound menu**: the **Sound** menu on the bars of diagrams, strumming and picking patterns, progressions and charts lists "Guitar (steel)", "Guitar (nylon)", "Guitar (clean)", "Guitar (overdrive)" and "Piano". In 0.27.0, it still offered only guitar and piano.
- **It shows what plays**: the menu shows the guitar in effect, from the block's `guitar:` line, else the note's `guitar_sound` property, else **Settings → Playback → Guitar sound**. A guitar you pick there plays for that block until the note is drawn again, and it changes neither the setting nor the note.

#### Other changes

- **In French too**: the new texts are translated. The command reads "Simplifier cette grille", the switch "Simplifier" and "Simplifié", and the Sound menu "Guitare (folk)", "Guitare (classique)", "Guitare (son clair)" and "Guitare (son saturé)".
