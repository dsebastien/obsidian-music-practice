---
title: Tips & troubleshooting
nav_order: 90
---

# Tips and troubleshooting

## Tips

- **Pick a current focus.** Give one to three items the top priority: they lead the plan's focus block and show "Current focus".
- **Set a target BPM** on chords, scales, exercises and pieces you want at tempo: practice next weighs the gap, and reaching the target offers "Can play at tempo".
- **Link prerequisites** (a song to the chords it uses): what's "ready to learn" and what an item unlocks follow from them.
- **Short sessions count.** A 10-minute plan is still a plan; the practice timer and Log practice take seconds.
- **Use the Kanban Action Planner's timer if you prefer it**: when it runs on your practice activity, Log practice takes it over, so the time is counted once.

## Troubleshooting

| Problem                                         | What to check                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "No learning notes yet"                         | With the Obsidian Starter Kit: the type needs a status on the mastery scale (10 to 60) and a "last practiced" property. Without it: tag notes `type/music/<instrument>/<kind>` and give them a mastery level (see [Configuration](configuration.md)). **Settings → Note types in use** lists what was found. |
| An item is missing                              | It needs every tag of its type and its mastery property. Tags are read as a list or as text, any case.                                                                                                                                                                                                       |
| "Choose which instrument this session is for"   | The items have no instrument (ear training…): pick the session in Log practice, or pass `sessionTypeId` through the API.                                                                                                                                                                                     |
| "A Kanban Action Planner timer is running on …" | That timer times the same activity: tick "Use the … timer" in Log practice, or stop it first.                                                                                                                                                                                                                |
| No time on the activity                         | The activity is the one your last session of that instrument linked to, or the note named by the **Activity name** setting ("Learn Guitar").                                                                                                                                                                 |
| Minutes not added on a note                     | The note's minutes property holds something that isn't a number (`"1h"`); fix it by hand, the plugin never overwrites it.                                                                                                                                                                                    |
