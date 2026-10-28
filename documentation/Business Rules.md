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
