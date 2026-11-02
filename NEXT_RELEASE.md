Fixes for the diagrams in your notes, from music-notation 0.5.2.

- **Scale fingering on keyboards**: a `fingering:` no longer disappears when the block also has `labels:`. The labels stay on the keys, and the finger numbers get their own row under them. With a `range:` that leaves out middle C's octave, the fingering now shows too: it starts on the first root inside the range, and every octave in the range stays lit.
- **Chords named from their frets**: a `chord` block with only `frets:` now names maj7 and m7 shell voicings without a fifth (`3x44xx` is Gmaj7, `x313xx` is Cm7). It also names 13th grips that leave out the 5th, 9th and 11th (`020120` is E13, `3x3455` is G13).
- **Slash chords**: the bass is spelled the way the chord spells it, so `x12010` is C7/Bb, not C7/A#.
- **Altered scale**: no more double sharps. G# altered is G# A B C D E F# (R b2 b3 b4 b5 b6 b7), not G# A A## B# C## E F#.
- **Play bar**: the sound dropdown is readable in dark themes, and the speed and volume knobs sit in the middle of their slider.
