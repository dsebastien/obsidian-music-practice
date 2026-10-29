# Business Rules

This document defines the core business rules. These rules MUST be respected in all implementations unless explicitly approved otherwise.

---

## Configurable rules

- Every number in these rules (mastery levels, review intervals and multipliers, due-soon window, score weights, plan split, minutes and items per block, warm-up kinds) is a setting (`PracticeRules`, #27). The values written below are the defaults applied on install. Domain code never hardcodes them; it takes the rules as a parameter.
- With the Obsidian Starter Kit, its note types (status values, roles, stamped dates) stay the source of truth for what they define; plugin settings fill the rest (#27, to review).

## Note model source

- With the Obsidian Starter Kit (OSK) available, its note types are the only source: status values and roles, folders, affixes, templates and date stamps come from OSK; plugin settings cover review, score, plan, rubric and property names (#27).
- Without OSK, the standalone model applies (#4): learning types are inferred from notes tagged `type/<domain>/<subject>/<kind>` (only the configured domains, `music` by default) (or `type/<domain>/<kind>`) whose mastery property holds a level; status values are `<level number> - <level name>` from the settings; one session type per subject, with the folder pattern and name suffix from the settings; the plugin stamps the started and mastered dates itself.
- Detection runs on load, on OSK note type changes and before each command; switching between the two never changes notes.

## Learning notes

- Tags are matched without `#` and regardless of case, whether `tags` is a list or text. When several learning types match a note, the most specific one (most tags, then longest type tag) wins.

- A learning note type is a type whose status uses the numbered mastery scale (10 … 60) and that defines the practice field `date_last_practiced`. With the Obsidian Starter Kit (OSK), types are read from OSK (explicit status); without it, from the plugin's own note model settings.
- Its notes carry the type's mandatory tags. The kind (chord, scale, technique, exercise, arrangement…) is the last segment of the type tag `type/<domain>/<subject>/<kind>`.
- Module fields are optional per type and used only when the type defines them: `date_last_practiced`, `bpm_current`, `bpm_target`, `priority`, `prerequisites` (links to learning notes), `theory`, the review fields (`last_reviewed`, `review_interval`, `review_count`, names configurable to match the Kanban Action Planner) and the duration field (`time_spent`).
- Nothing is hardcoded about instruments, types, folders or labels: a new instrument is new note types, never a code change.

## Mastery scale

- Numbers and roles are shared by every domain; each type names its own levels. 10 backlog (Want to learn), 20 active (Learning), 30 active (Can play slowly), 40 active (Can play at tempo), 50 active, on the way back (Rusty), 60 done (Mastered).
- The engine reads only the number in front of a status value, never the label. When it must write a level (a failed review drops 60 to 50), it writes the type's own label for that number.
- Entering 20 and 60 stamps dates (`date_started`, `date_mastered`, `dates_mastered`). **Single writer**: when OSK runs automations, the plugin never stamps these dates.

## Rubric (shown when changing mastery, per kind)

- Chord: 20 shape known; 30 every string rings; 40 switches in time at the target BPM; 60 from memory with any transition.
- Arrangement or piece: 20 sections practiced separately; 30 full run-through slowly; 40 full song at tempo with small mistakes; 60 from memory, at tempo, in context.
- Scale, technique, exercise: 20 pattern known; 30 clean at a slow BPM; 40 clean at the target BPM; 60 from memory in any position.
- Reaching the target BPM offers level 40.

## Spaced review (light SM-2)

- Reaching 30 sets the interval to 3 days when it is empty.
- A review sets the last reviewed date, increments the count and updates the interval: good doubles it (cap 90), shaky keeps it, failed resets it to 3 and drops a mastered item to Rusty.
- Status, for items at 30+ with an interval: days since the last review (or the last practice when never reviewed) ≥ interval is overdue; ≥ interval − min(3, ⌊interval / 3⌋) is due soon; otherwise current. Mastered items stay in review.

## Practice score (higher = practice sooner)

- Priority: 70 − priority number (10 Top → 60 … 60 Very low → 10); 25 when TBD or missing.
- Staleness: with an interval, min(days since practiced / interval, 3) × 10; without, min(days since practiced, 30); 30 when never practiced.
- BPM gap: (100 − min(BPM progress %, 100)) / 5 when both BPMs are set.
- Unlocks: 3 per learning note still at 10 linking to the item (max 5 counted).
- Rusty: +10 at level 50.

## Ready to learn, focus, unlocks

- Ready to learn: level 10 and every prerequisite at 30+; a prerequisite that doesn't resolve to a learning note counts as open.
- Current focus: items at the type's top priority value, not mastered (1–3 at a time).

## Practice plan

- A session for N minutes split warm-up / focus / review / fun (15/50/20/15 by default, configurable). Focus takes the rounding remainder: the blocks always add up to N.
- Warm-up: active techniques and exercises, lowest level first. Focus: active items, current focus first, then by score. Review: due items, most overdue first. Fun: items at 40+, least recently played first.
- Up to three items per block, five minutes each at least. Minutes per item are whole minutes adding up to the block (the first items take the remainder: 20 over 3 → 7, 7, 6); a log splits its minutes between items the same way.
- Review, warm-up and fun pick first; an item is planned once; focus takes the rest. A block shorter than the minimum per item, or with nothing to offer, hands its minutes to focus. Focus always gets an item when there is one, so a very short session still has something to do.

## Sessions and time

- A practice session note belongs to the session type tagged `type/session/<domain>/<subject>` matching the learning note's `type/<domain>/<subject>/<kind>`.
- Naming: `<date> <focus> (<Session suffix>)`, `<date> (<Session suffix>)` without focus, then ` 2`, ` 3` for further sessions that day.
- It records date, minutes, start time, quality, the practiced notes and the activity link, as far as the session type defines those fields.
- One log is one session of one instrument: items of several instruments are refused. Instrument-less items (`type/music/exercise`) go to the session type the user picks among their domain's.
- A log is checked in full before its first write (request values, items, session type, levels, session name, activity, timer), then writes the session note, the practiced notes (each computed from its own current frontmatter, not from the cache), then the activity. One log runs at a time.
- The activity: the one the latest session of that type (by its date) linked to; else the note named after the activity setting ("Learn Guitar"); else "Learn Guitar (…)" when that note carries an activity tag.
- The linked activity gets one time entry per session in the Kanban Action Planner format (`{startTime, endTime, description}`, description = the session link), its duration field increases by the minutes and its last-session date moves forward. An activity never gets two entries for the same session note.
- Timer guard: when a Kanban Action Planner timer runs on the log's activity, the log must take it over: the timer is stopped and its own entry is relabeled to the session (if that entry doesn't appear within 10 s, nothing is added, so the time is never counted twice). A log that doesn't take it over is refused.
- The practice timer's log uses the timer's start day and time.

## Writing notes

- Frontmatter changes go through `processFrontMatter`, one transaction per note; number-like text (frets `022100`, codes) stays text.
- Never lose information: existing values are only replaced by the fields the action is about. Minutes are never added to a value that isn't a number; existing time entries are kept as they are; the last-practiced and last-reviewed dates never move back (an older review leaves the review counters alone).
- Creating a learning note applies its level like a change: the first review interval from "slow" up, and date stamps when the Obsidian Starter Kit doesn't stamp them.

## Notation (v0.2)

- Notation blocks (`chord`, `chords`, `keyboard`, `fretboard`) are drawn by `@dsebastien/music-notation`; the plugin adds no syntax of its own, so a vault renders the same in Obsidian and on Publish (library loader), apart from the layout settings (see Layout).
- One switch per language, on by default. Registered once the layout is ready, so plugins enabled at startup register theirs first. A language another plugin registered first stays theirs: checked in Obsidian's registry before registering (a refused registration leaks a post-processor), and never retried. A language turned off renders as code until the plugin reloads, which frees it.
- A rendering is destroyed with its section (`MarkdownRenderChild`). Mistakes render inline; the note is never changed.
- New chord notes get a `chord block only when Music Practice draws `chord blocks and the block draws without an error.
- A property name added in a newer version that an older data.json already uses for another property gets an `mp_` prefix.
- New guitar chord notes: the chosen voicing goes to the frets and fingers properties (text; dashes when a fret has two digits) and a ``chord block with `symbol`, `frets`, `fingers` (and `position` only when it differs from the computed one). The block fills the template's empty ``chord block when there is one, else goes under the title. Piano chords get `symbol` + `instrument: piano`. "No diagram" adds neither.
- Chord symbols are parsed by the library (one parser for notes and diagrams).

## Layout (v0.3)

- Layout settings (`notationLayout`): left-handed (off), chord diagrams vertical, fretboards and keyboards horizontal. They reach the library as render defaults (`orientation` per language, `hand: left` only when left-handed); a block's own `orientation` / `hand` wins. Piano chords follow the keyboard orientation (the library's rule).
- An orientation in data.json that isn't `vertical` or `horizontal` falls back to the default; the settings dropdowns refuse anything else.
- Changing a layout setting redraws every block on screen in place (each rendered block is tracked while loaded: reading view, live preview, embeds, canvas); it never re-registers processors. The block switches still re-render reading view.
- Layout settings apply in Obsidian only; a Publish site gets the same with `window.musicNotationOptions` in its `publish.js` (documented). Blocks that say `orientation:` / `hand:` render the same everywhere.
- Add a learning note, guitar chords: the first 4 voicings are drawn side by side (titled 1 to 4), plus the selected one when it's further down the list (5 columns then); clicking one selects it in place (focus kept) and updates the dropdown; "No diagram" shows no row. Previews use the layout settings. The note still gets one diagram (the selected voicing).

## Chords and scales (v0.4)

- An empty `chord block in a chord note and an empty `fretboard / ```keyboard block in a scale note draw from the note's frontmatter through the library's `blockFromProperties`, with the configured property names and the instrument of the note type (guitar or piano subject; otherwise the library reads the tags). Other notes and blocks with content are unaffected. The note is matched to its learning type the same way as everywhere (`learningTypeOf`).
- Those blocks redraw when the note's metadata changes (`metadataCache` "changed"), only when the properties make a different block; they follow renames (`vault` "rename"); blocks no longer in the page are forgotten; a change of property names redraws them all.
- Add a learning note writes properties only: chord symbol, root, quality, alias, frets and fingers (guitar), scale root and type, shape; the note gets an empty block of its language (`ensureBlock`: the template's, else one under the title), only when Music Practice draws that language and, for chords, when the block would draw.
- Chords are typed as a symbol, words, or six guitar frets (recognized; stored compact, without fingers). Frets the library can't name give no note.
- Scales (types that define the scale root and type properties): root and scale/mode from the type's allowed values (else the common roots and scales), shape from the type's shape values; title `<spelled root> <type>[ - <shape>]` (`C# Major` → "C Sharp Major", so sharps survive file names).
- Identify this chord: only on a chord-kind note without a chord symbol whose type defines the chord symbol property; six frets (guitar; numbers padded back to 6 digits) or pitches (piano; lists joined; pitch classes stacked from middle C); one reading applies directly, several open a picker; writes symbol, root, quality (fields the type defines) and adds the alias to the aliases list (a single alias string kept); reports failures.

## Triads, transitions, tabs and scores (v0.7)

- Triads come from the library (`triadVoicings`, `keyTriads`); a triad note is a chord note of the first guitar chord type (the one the command runs from for "this chord"), titled `<chord name> - <shape> (strings 1-3, root position|1st inversion|2nd inversion)` with the type's value for "Triad" (else "Triad" in the title and no shape); an inversion lists its root-position note (same chord, string set, root position), when it exists, in `prerequisites` as a wikilink. Add a learning note's Triads… puts the triad, its shape and that title in the form.
- Transitions come from the library (`transition`, `smoothProgression`): from a chord note's frets (else its chord's easiest voicing) to the other note's chord; the next note's own voicing is marked and shown even when it's not among the 4 easiest (when among the 30 considered); Add as note uses the type of the note the chord comes from. Smooth this progression reads ```chords (and ~~~chords) blocks of the note, in order, consecutive repeats once, at most 16 chords; a step is "in your notes" when a note of the guitar chord type has the same chord symbol and frets.
- Tab and score blocks: alphaTab's UMD script, the Bravura font and the sonivox soundfont are embedded in main.js (virtual modules at build time) and loaded into a window on its first tab block or soundfont play, from a blob URL (workers too); nothing is downloaded. `file:` links resolve from the block's note (`getFirstLinkpathDest`) and read the vault's bytes. Exports save next to the note through the attachments setting (`getAvailablePathForAttachment`), named after the score's title or the note.
- Playback: the diagrams get the library's `play` option when Settings → Playback is on; the soundfont engine plays through a hidden alphaTab instance per window (made on the first play), the light engine through the library's synthesizer; volume 0–100, scale tempo 20–400, strum 0–500 ms; diagrams redraw when these change. Play this chord or scale renders the note's own block offscreen and plays its notes.
- Imports: score files (gp, gp3–gp7, gpx, musicxml, xml, mxl, cap, capx) become a ``tab block with `staves: both` when a track has a tuning, else ``score; inline (alphaTex) or a link (the file copied through the attachments setting and appended to the note's `sources`, configurable, only when the note has that property). ChordPro files (cho, chopro, chordpro, crd, pro) become ```chords. Pasted text tabs and chord sheets are converted by the library; nothing is inserted when nothing converts. Blocks go at the cursor of the note in editing view, else into a new note of the first arrangement type (guitar first), titled after the file, numbered when taken.

## Voicings (v0.6)

- Every way to play a guitar chord comes from the notation library's generator (`generateVoicings`), easiest first; the modal draws at most 24. Filters: neck area (whole neck, first position, 1–5, 5–9, 9–12, 12–15), root string (6, 5, 4), inversions, stretch.
- A generated shape becomes the note type's shape value when the type lists one matching it without regard to case, the library's name when the type takes any text, else nothing.
- Use for this note only takes a voicing of the note's own shape, as the library names shapes: with frets, `voicingShape(frets)` against the voicing's shape (the note type's values may be coarser); without frets, the shape property (text, or a list's first value) against the voicing's mapped value; any voicing when the note has neither. Another shape is another learning item (Add as note), so mastery and the title stay true. It writes frets, fingers, the shape only when the note had none, and the position only when the note already has that property. The note's own voicing can't be used or added again.
- Add as note: when a note of the type already plays that voicing of the chord (same frets, same chord symbol, from the item index), it opens instead; else a chord note of the same type (the first guitar chord type for a typed chord) titled `<name> - <shape>`, or `<name>` without a usual shape, else `… at fret N` when that title is taken (at its path or as a note name anywhere), else refused; the empty diagram block only when Music Practice draws chord blocks. Use and Add as note are only offered for types with a frets property; one action runs at a time.
- Add a learning note: More voicings… puts the picked voicing in the form with its shape (replacing a shape chosen before, which described another voicing); the shape goes again when another voicing or another chord is chosen (a space or another spelling of the same chord keeps both); typed frets get fingers from `fingerVoicing` when a hand can play them.

## Practice (v0.5)

- Undo: a log records, per practiced note and the activity, the frontmatter keys it changed (before and after, existed or not) and its session note's body. Only the last log, in plugin data. Undo refuses (naming the notes) when any recorded key's value differs from what the log wrote, a note moved or was deleted, or the session note's body changed; else it restores the keys (removing added ones) and trashes the session note. A Kanban Action Planner timer's own entry stays; dates the Obsidian Starter Kit stamps after the log aren't recorded, so they stay. A list the log only appended to (time entries) keeps just the appended item; undo is idempotent (keys already back count as undone), refuses when the session note is gone or was replaced (creation time), and checks the notes as read from disk.
- Timer pause: `timerPausedAt` / `timerPausedMs`; minutes practiced exclude pauses; start and clear reset them.
- Panel list (`panelItems`): paths, done flags, BPMs reached; read on its own from data.json (malformed entries dropped, each path once). Log this session logs the ticked items (all when none), with the timer's minutes when it runs; logged items leave the list.
- Metronome: 20–300 BPM; Web Audio, scheduled 120 ms ahead every 25 ms; accent on the first click of a bar; speed trainer start + floor(bars / everyBars) × step (+ manual steps), capped at the target; Save BPM goes through Set BPM. One instance; it keeps playing when its modal closes (status bar).
- Chord change drills: pairs of guitar chord notes; the pair's note is a guitar exercise note whose `trains` link exactly those two chords (created on first save, titled `<chord> ↔ <chord>`); `changes_best` = max, `changes_last` = the count; suggestions among current-focus chords (else chords being learned, else all), never-drilled first, then lowest best. Needs the exercise type to define both count properties.
