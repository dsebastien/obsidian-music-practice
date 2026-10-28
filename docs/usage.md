---
title: Usage
nav_order: 2
---

# Usage

> Version 0.1 is in development. This page describes what works in the development build.

## Requirements

- The [Obsidian Starter Kit](https://store.dsebastien.net/) plugin, whose note types define your learning notes and practice sessions. A standalone mode (the plugin's own note model) is planned.
- Optional: the Kanban Action Planner. When it's installed, Music Practice writes time entries and review fields with the same property names, and can take over its running timer.

## Learning notes

A learning note is a note of a type whose status uses the mastery scale (Want to learn, Learning, Can play slowly, Can play at tempo, Rusty, Mastered: only the numbers 10 to 60 matter) and that has a "last practiced" property. With the Obsidian Starter Kit's music types, every guitar or piano chord, scale, technique, exercise and arrangement is one.

Each learning type pairs with a practice session type of the same instrument (`type/music/guitar/chord` pairs with `type/session/music/guitar`).

## Commands

| Command                     | What it does                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Practice next**           | Lists what's due for review, what to practice next (ranked by priority, staleness, BPM gap and what it unlocks) and what's ready to learn.            |
| **Plan a practice session** | Splits the minutes you have into warm-up, focus, review and fun, with the items to work on. "Log this session" opens Log practice with them.          |
| **Log practice**            | Records a session: minutes, date, an optional focus, the items you practiced, their new mastery, BPM, review results, the session quality and a note. |

## Log practice

1. Enter the minutes (or use the running Kanban Action Planner timer, when there is one), the date and an optional focus ("Barre chords").
2. Tick what you practiced. Items you planned or that are due come first; type to filter. Items of another instrument are dimmed: log them in their own session.
3. For each item, if it applies:
    - change its mastery (the rubric for its kind shows what the level means);
    - enter the BPM you reached (only when the item has a target BPM; reaching it offers "Can play at tempo");
    - rate the review: **Good**, **Shaky** or **Failed**.
4. Pick the session quality and add a note if you want, then **Log practice**.

What gets written:

- **Each item**: last practiced date, minutes (the session split evenly), BPM, review date, count and interval, new mastery. The first review interval starts when an item reaches "Can play slowly".
- **A session note** in the session type's folder, named `<date> <focus>` (or `<date>`, then `<date> 2`… for more sessions that day), with the date, start time, minutes, quality, the practiced items and the activity.
- **The activity** the session counts towards (the one your previous session of that instrument linked to, or a note named "Learn Guitar"): one time entry per session, its minutes and its last session date. Logging never adds the same session twice.

Dates the Obsidian Starter Kit stamps on mastery changes (started, mastered) are left to it.
