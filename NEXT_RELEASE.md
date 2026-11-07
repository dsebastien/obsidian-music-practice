Play along with the recording of a song: a new ` ```playalong ` block plays an audio or a video file of your vault, loops a passage, slows it down without changing its pitch and counts you in before each pass.

- **The block**: a `file: [[Song.mp3]]` line, then the song's sections, one a line (`0:12 Verse`, `0:45.5 Chorus`). Audio (mp3, m4a, wav, flac, ogg, opus…) and video files (mp4, webm, mov…) work; a video shows its picture.
- **A-B loop**: set A and B at the playhead, and the passage plays again and again. Each pass starts a little before A, so the first note isn't cut (Settings → Play-along → Pre-roll).
- **Slow it down**: from 50 % to 125 %, in steps of 5 %, without a pitch change.
- **Sections**: select a section to jump there, or its loop button to loop it. **Add a section** writes a new one at the playhead into the block, while the music plays on.
- **Count-in before each pass**: the metronome clicks a bar at the recording's tempo times the speed, and the passage starts on the next beat. The tempo is the block's `tempo:` line, else the note's target BPM. Tap it on the player once: it is written as the `tempo:` line.
- **Practice**: Play puts a learning note in the practice panel's list, and **Save BPM** keeps the tempo you reached. One player plays at a time, and never together with the metronome or the backing loop.
- **Keyboard**: select the player, then Space plays and pauses, `[` and `]` set A and B, L loops, the arrows move 5 s, − and + change the speed, C, T and M turn the count-in on or off, tap the tempo and add a section.
