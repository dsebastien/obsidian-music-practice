Music Practice now follows Obsidian's language, and French is the first translation. The notation blocks speak French too, and tabs and scores can follow the music, fit on one line and show the names of their notes. These come from music-notation 0.23.0 and 0.23.1.

#### Languages

- **French**: when Obsidian is in French, the plugin is in French too, and so are the notation blocks. Every other language shows it in English. There is no setting for it: change the language in Obsidian's **Settings → General → Language**, then restart Obsidian (#112, #50).
- **What's in French**: the command names, the settings tab, the Log practice dialog, practice plans, the timer, the metronome, the ear-training and note drills, the practice panel and views, play-along, the backing loop, the import dialogs, the notices and error messages, the tooltips and the texts for screen readers.
- **The notation blocks in French**: the bars under the blocks (Play, Loop, Count-in, Metronome, the tempo, Copy as image, Full screen, Follow the music, Note names), the Tab / Score / Both and Guitar / Piano switches, the playback choices, the texts for screen readers and the messages a block shows when its text has a mistake.
- **What stays in English, on purpose**: the block syntax (`chord`, `chords`, `tab` and their keywords), the property names in your notes, and the values the plugin stores in your notes (chord roots and qualities, scale types, drill kinds, tags). Only what you see is translated, so a note written in a French vault works in any vault, in any language. In the blocks, note names in letters, chord symbols, scale names inside titles, and what a message quotes from your text or tells you to write stay in English too.
- **Your own words don't change**: your level names, your rubric lines and the activity name in the settings are your data, so they stay as you typed them. The headings the plugin writes into your notes don't change either.
- **French wording, checked against real players**: the French texts use the words French-speaking guitarists and teachers use. A strumming pattern is a "rythmique", a scale box is a "position", the speed trainer is "Montée en tempo", Practice next is "Que pratiquer ensuite" and the current focus is "Focus actuel" everywhere. Picking, fingerpicking, power chord, swing, feeling and tap tempo stay in English, as French players say them.
- **The user guide and the README** stay in English for now.
- **A French wording looks wrong or odd?** Report it in the [GitHub issues](https://github.com/dsebastien/obsidian-music-practice/issues).

#### Tabs and scores

- **Follow the music**: a new button on the bar under a tab or a score (a target icon). It's off by default. Turn it on, and the note scrolls by itself while the music plays, by the smallest step that keeps the line that plays, and the next one, in view. A scroll by hand pauses it: the button stays on, dim, until the next Play or a click on it. In full screen the score follows by default, and the same button turns that off and on there.
- **Tabs on one line**: `layout: line` at the top of a `tab` or `score` block draws the music on one line that scrolls sideways under the cursor, in its own area. It follows the music by default. Good for a riff or an exercise you loop.
- **Note names on tabs and scores**: `names: on` at the top of a `tab` or `score` block writes the name of every note above the tablature. A chord's names are stacked in the order of the strings. The new **Note names** button (a letter A) turns them on and off while you read. The names follow **Settings → Notation → Note names** (letters, solfège or German), as the diagrams do. Rests, tied notes, dead notes and drums have no name.

#### Fixes

- **The line with the mistake, in French too**: when a tab or a score has a mistake, the faulty line is still marked in the block text under the message, whatever the language. The plugin no longer reads the line number out of the English message.

#### Other changes

- **Lists in messages**: a list of three or more names in a message now reads "A, B, and C", in English too.
