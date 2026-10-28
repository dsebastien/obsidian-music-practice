# Business Rules

This document defines the core business rules. These rules MUST be respected in all implementations unless explicitly approved otherwise.

---

## Configurable rules

- Every number in these rules (mastery levels, review intervals and multipliers, due-soon window, score weights, plan split, minutes and items per block, warm-up kinds) is a setting (`PracticeRules`, #27). The values written below are the defaults applied on install. Domain code never hardcodes them; it takes the rules as a parameter.
- With the Obsidian Starter Kit, its note types (status values, roles, stamped dates) stay the source of truth for what they define; plugin settings fill the rest (#27, to review).

## Learning notes

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
- Up to three items per block, five minutes each at least. Review and warm-up pick first; an item is planned once. A block with nothing to offer hands its minutes to focus.

## Sessions and time

- A practice session note belongs to the session type tagged `type/session/<domain>/<subject>` matching the learning note's `type/<domain>/<subject>/<kind>`.
- Naming: `<date> <focus> (<Session suffix>)`, `<date> (<Session suffix>)` without focus, then ` 2`, ` 3` for further sessions that day.
- It records date, minutes, start time, quality, the practiced notes and the activity link, as far as the session type defines those fields.
- The linked activity gets one time entry per session in the Kanban Action Planner format (`{startTime, endTime, description}`, description = the session link), its duration field increases by the minutes and its last-session date moves forward. Logging the same session again finds the entry and adds nothing (no duplicates).
- Timer guard: when the Kanban Action Planner timer runs on the same activity, adopt its start time and stop it, or cancel.

## Writing notes

- Frontmatter changes go through `processFrontMatter`, one transaction per note; number-like text (frets `022100`, codes) stays text.
- Never lose information: existing values are only replaced by the fields the action is about.
