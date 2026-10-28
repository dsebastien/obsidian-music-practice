# Release Notes

## 0.1.1 (2026-10-28)

Maintenance release: no change in behavior.

- Security updates of development dependencies flagged by the community directory review (`fast-uri`, `moment`). None of them ship in the plugin.
- A small code cleanup flagged by the same review.

## 0.1.0 (2026-10-28)

The first release of Music Practice: learn an instrument in your notes.

### What you can do

- **Practice next**: what's due for review, what to practice next (ranked by priority, staleness, BPM gap and what it unlocks) and what's ready to learn.
- **Plan a practice session**: the minutes you have, split into warm-up, focus, review and fun, with the items to work on.
- **Log practice** in under a minute: minutes, the items you practiced, their mastery, BPM and review results, the session quality and a note. Writes the session note, updates each item and adds the time to your practice activity, without ever counting time twice.
- **Practice timer** in the status bar; stopping it opens Log practice with the minutes.
- **Change mastery** with what each level means for that kind of item, and **set BPM** (reaching the target offers "Can play at tempo").
- **Add a learning note**: type a chord symbol (F#m7, C/G) and get its name, root, quality and alias.
- **Spaced review** that catches what's getting rusty.

### Works with your setup

- With the Obsidian Starter Kit, its note types define your learning notes and sessions. Without it, tag notes `type/music/guitar/chord` and give them a mastery level.
- With the Kanban Action Planner, both plugins write the same time and review properties, and Log practice takes over its running timer.
- Every rule (levels, review intervals, score weights, plan blocks, rubric, property names) is a setting with sensible defaults.
- A public API lets scripts and AI assistants log and plan practice with the same rules.

Notation (chord diagrams, tabs and scores with playback) comes in 0.2.
