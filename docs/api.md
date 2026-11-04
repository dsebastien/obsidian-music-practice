---
title: API
nav_order: 6
---

# API

Scripts, other plugins and AI assistants can use Music Practice through its API, so the practice rules (mastery, review, score, plans) live in one place:

```js
const api = app.plugins.plugins['music-practice']?.api
```

Results are plain JSON. Writes resolve once the notes are written. `api.version` changes only on breaking changes (currently `1`).

## Reading

| Method                              | Returns                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `items(filter?)`                    | Every learning item with its state.                                                         |
| `practiceNext(filter?, limit = 20)` | Active and due items, highest score first.                                                  |
| `readyItems(filter?)`               | Items ready to learn.                                                                       |
| `practicePlan(minutes, filter?)`    | A session plan: blocks (`warm-up`, `focus`, `review`, `fun`) with their minutes and items.  |
| `timer()`                           | The running practice timer's start (epoch ms), or `null`.                                   |
| `timerMinutes()`                    | The minutes practiced on the running timer so far (pauses excluded), or `0` when none runs. |

`filter` is `{ subject?: string, kind?: string }`, for example `{ subject: 'guitar', kind: 'chord' }`.

An item looks like this:

```json
{
    "name": "E Major - Open (Guitar Chord)",
    "path": "…/E Major - Open (Guitar Chord).md",
    "typeId": "nt-1793124217367-axcwhqi",
    "type": "Guitar Chords",
    "kind": "chord",
    "subject": "guitar",
    "level": 20,
    "mastery": "20 - Learning",
    "priority": 10,
    "focus": true,
    "review": null,
    "reviewInterval": null,
    "daysSincePracticed": 2,
    "bpmCurrent": null,
    "bpmTarget": null,
    "bpmProgress": null,
    "ready": false,
    "unlocks": 0,
    "score": 62
}
```

## Writing

| Method                                  | Does                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logPractice(request, { adoptTimer? })` | Logs a session, exactly like the Log practice command.                                                                                                |
| `setMastery(path, level)`               | Changes an item's mastery: a number (`40`) or the type's value (`"40 - Can play at tempo"`).                                                          |
| `setBpm(path, { current?, target? })`   | Sets the current and/or target BPM.                                                                                                                   |
| `startTimer()`, `clearTimer()`          | Starts the practice timer (rejects when it is already running), or clears it without logging.                                                         |
| `undoLastLog()`                         | Undoes the last practice log, like the Undo last practice log command. Resolves `{ ok: true, sessionPath, keptKapEntry }` or `{ ok: false, reason }`. |

A log request:

```js
await api.logPractice({
    date: '2026-10-28', // YYYY-MM-DD
    minutes: 30,
    startTime: '18:00', // optional, HH:MM
    focus: 'Barre chords', // optional, part of the session note's name
    quality: '★★★★', // optional, a value of the session type's quality property
    note: 'Clean changes at 70 BPM', // optional
    activity: 'Learn Guitar', // optional: an activity note's name or path, null for none
    items: [
        { path: '…/F Major - Barre (Guitar Chord).md', bpm: 70, level: 30 },
        { path: '…/A Minor - Open (Guitar Chord).md', review: 'good' }
    ]
})
// → { sessionPath, reused, items, activity: { path, result, decision } | null, createdActivity, adoptedTimer, warnings, undo }
```

The request is checked before anything is written: a `YYYY-MM-DD` date, whole minutes from 1 to 1440, an `HH:MM` start time, each item once, whole BPMs, review results `good`, `shaky` or `failed`, levels the item's type has. Items of several instruments are refused (one log is one session); for instrument-less items, pass `sessionTypeId`. One log runs at a time.

`activity` in the request names the activity note (its name or path), or `null` for none; it must be an activity (with the Starter Kit, a note in its activities folder; without it, a note tagged `type/activity`), else nothing is written. Without it, the session counts for the activity whose `session_types` lists the session note type; when none does, it counts for none and `warnings` says so (only Log practice asks, and only it creates or maps an activity). `reused` is `true` when a session note already held this log (same session type, date, items and minutes, and the same `startTime` or timer start; without one, a note created in the last 15 minutes): nothing was created, a review already recorded that day wasn't counted again, and the first log stays the one `undoLastLog` undoes.

`activity.result` is `updated` or `unchanged` (the activity's minutes and last session date were recomputed from its time entries and the session notes linked to it), `missing` (recomputed, but the adopted timer's entry didn't appear in time, so it wasn't removed), `not-linked` (Obsidian hadn't indexed the session's link yet; nothing written) or `skipped` (the activity's time entries aren't a list; nothing written). When a Kanban Action Planner timer runs on the activity, pass `{ adoptTimer: true }`, or the log is refused so the time is never counted twice. `activity.decision` (`{ stored, computed, difference }`) means the activity stores more minutes than its time entries and sessions give: they were left as they are. `warnings` lists what was left alone on purpose (an item's minutes above what its sessions give, minutes that aren't a number…).
