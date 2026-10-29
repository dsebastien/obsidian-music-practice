---
title: Configuration
nav_order: 4
---

# Configuration

Every rule the plugin applies is a setting, with defaults that work on install. Open **Settings → Music Practice**.

## Main settings

| Setting                      | Default         | What it does                                                                            |
| ---------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| Note types                   | (information)   | Where the note types come from: the Obsidian Starter Kit, or the standalone note model. |
| Default practice plan length | 30              | Minutes offered when you plan a session.                                                |
| Session notes heading        | Notes           | Section of the session note that receives a log's note.                                 |
| Activity name                | Learn {subject} | Activity your sessions count towards when no earlier session links one.                 |

## Notation blocks

One switch per kind of [notation block](notation.md), all on by default: chord diagrams (` ```chord `), chord charts (` ```chords `), keyboards and fretboards. A block turned off shows as code; reload the plugin to let another plugin draw it. The status line says when another plugin already draws one of them.

| Setting                   | Default    | What it does                                                                                        |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Left-handed               | Off        | Mirrors guitar chord diagrams and fretboards (the low string on the right). Keyboards don't change. |
| Chord diagram orientation | Vertical   | Vertical: the nut on top. Horizontal: the strings across, the high string on top, as in tabs.       |
| Fretboard orientation     | Horizontal | Horizontal: the high string on top. Vertical: the nut on top, as a chord diagram.                   |
| Keyboard orientation      | Horizontal | Horizontal: low notes on the left. Vertical: low notes at the bottom. Piano chords follow it.       |

A block's own `orientation:` or `hand:` wins over these. Diagrams on screen redraw when you change them (reading view, live preview, embeds). On Obsidian Publish, see [Notation](notation.md#obsidian-publish).

## Rules

| Group          | Settings (defaults)                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mastery levels | Want to learn 10, Learning 20, Can play slowly 30, Can play at tempo 40, Rusty 50, Mastered 60. Must increase.                                                  |
| Spaced review  | First interval 3 days, maximum 90 days, good review × 2, due-soon window min(3 days, interval / 3).                                                             |
| Practice score | Priority base 70 (TBD: 25), staleness (never practiced 30; capped at 30 days, or 3 × 10 with an interval), BPM gap / 5, 3 points per unlock (max 5), Rusty +10. |
| Practice plan  | Blocks 15, 50, 20, 15 % (must add up to 100), at least 5 minutes per item, at most 3 items per block, warm-up kinds: technique, exercise.                       |

## Rubric

What each level means, for chords, for arrangements and pieces, and for scales, techniques, exercises and other kinds. Shown when you change an item's mastery.

## Property names

The frontmatter properties the plugin reads and writes (last practiced, BPMs, priority, prerequisites, review fields, a guitar chord's frets, fingers and position, a piano chord's pitches and fingering, a scale's root, type and fingering, minutes, session fields, time entries…). When the Kanban Action Planner is installed, its time-tracking and review property names are used, so both plugins write the same properties. Empty notation blocks in chord and scale notes draw from these names ([Notation](notation.md#notes-draw-their-own-diagram)).

## With or without the Obsidian Starter Kit

- **With the Obsidian Starter Kit**, its note types are the source of truth: a learning type is a type whose status uses the mastery scale and that has a "last practiced" property; session types are tagged `type/session/<domain>/<subject>`. The Starter Kit owns the statuses, folders, templates and the dates stamped on mastery changes.
- **Without it**, the **standalone note model** applies. Learning notes are notes tagged `type/<domain>/<subject>/<kind>` (for example `type/music/guitar/chord`) whose mastery property holds a level. You set:
    - the mastery property (`mastery`) and the level names;
    - the priority number of the current focus;
    - the dates stamped on reaching Learning and Mastered;
    - the session folder (`Practice sessions/{Subject}/{year}`), the session name suffix and an optional session template.

Switching between the two loses nothing: your notes stay as they are. **Note types in use** lists what the plugin found.

## Reset

**Reset to defaults** restores the rules, rubric, property names and standalone note model (after a confirmation). Your notes are not touched.
