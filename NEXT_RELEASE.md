You can now set the tempo of tabs and scores in BPM, and renamed properties reach the empty blocks. From music-notation 0.22.0.

#### Tabs and scores

- **Tempo in BPM**: the speed slider of the bar under a tab or a score is now a tempo control, such as "− 60 BPM + · 71 %". It shows the tempo the music plays at (the score's tempo times the speed), with the speed in percent next to it, dim.
- − and + step by 1 BPM. Type a number and press Enter, or step with the Up and Down arrow keys; Escape gives the value back. A click on the percent goes back to 100 %.
- The unit button switches to percent, where − and + step by 5 %. The range is the same as before: 25 to 150 % of the written tempo.
- When the score changes tempo, the BPM follows the bar that plays. A score without a tempo shows percent only.
- New setting, **Settings → Playback → Tab tempo**: BPM (the default) or Percent, the unit the bar shows first. The unit button on a bar saves your choice there, so the scores drawn after that start with it.

#### Property names

- When you rename a chord's root or quality, or a strumming or picking pattern property (pattern, time signature, feel, current BPM, picking pattern) in **Settings → Property names**, the empty blocks now read the new names too. Before, those names didn't reach them.

#### Fixes

- The circle of fifths shows the whole outline of the chord that plays. Other cells covered part of it.
- A chord note without `chord_symbol` draws the chord its `chord_root` and `chord_quality` name: "A" and "Minor 7" give Am7 (music-notation #132). Notes made from the Obsidian Starter Kit's chord and arpeggio templates, which leave `chord_symbol` empty, now draw their chord.
