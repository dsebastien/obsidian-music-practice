Turn a text tab into a tab you can play, plus fixes for imports and popout windows.

- **Convert a text tab**: a ` ```tab ` or ` ```score ` block that holds a plain-text tab (`e|---0---|` lines) now has a **Convert to a playable tab** button under it (not on canvas cards). The command **Convert this text tab into a playable tab** does the same with the cursor in the block. The block becomes alphaTex, and your original text tab is kept in a comment at its end. Settings lines at the top (`staves:`, `tracks:`, `file:`) stay as they are, and a block in a list or callout stays in it. To go back, select **Undo** in the notice, or press Ctrl+Z (Cmd+Z) in editing view.
- **Mistakes in tabs and scores**: a tab or score block with a mistake shows the error message and, folded under it, **Block text**: open it to see what you wrote, with the wrong line marked.
- **Where blocks go**: inserted and imported blocks never land inside the properties, or inside a code, math, HTML or comment block.
- **Imports into a new arrangement note**: the import fills the note's empty Tab or Chart block.
- **Chord files in UTF-16**: chord and ChordPro files saved in UTF-16 without a byte order mark now import, in any script (Cyrillic, Greek, Chinese, Japanese…). When a file can't be read, the import tells you.
- **Popout windows**: diagrams in a popout window play through that window, and are cleaned up when you close it.
- **Chord symbols from the web**: symbols written the way chord sheets on the web write them work (`C7(b9)`, `Cm(add9)`, `Cmaj7b5`, `C-5`). A chord the voicing database doesn't have gets its 4 easiest voicings instead of an error.
