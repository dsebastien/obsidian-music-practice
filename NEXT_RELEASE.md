New for the diagrams in your notes, from music-notation 0.6.0.

- **A root for note lists**: add `root: C` to a fretboard or keyboard block that lists notes (`notes: C Eb Gb A`). `labels: intervals` and `labels: degrees` then count from that root, and the root gets the root color when it is in the list. It doesn't have to be.
- **Positions in neck order**: `positions: all` draws a scale's positions up the neck, each one at or above the one before. A minor pentatonic's boxes 4 and 5 now sit at frets 12–15 and 14–17, not 0–3 and 2–5. A list of positions (`positions: 1 3`) keeps those frets.
- **Numbering from the relative minor**: `numbering: minor` counts a major pentatonic's positions from its relative minor, as many courses do. A major pentatonic's position 1 is then box 1 of F# minor pentatonic, and the titles add "(from F#m)".
- **One position where you want it**: a single `position:` with `frets:` is drawn inside those frets, so `position: 4` with `frets: 10-17` is box 4 at frets 12–15. When no octave of it fits, the block says so.
