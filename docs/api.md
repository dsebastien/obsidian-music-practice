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

| Method                              | Returns                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `items(filter?)`                    | Every learning item with its state.                                                        |
| `practiceNext(filter?, limit = 20)` | Active and due items, highest score first.                                                 |
| `readyItems(filter?)`               | Items ready to learn.                                                                      |
| `practicePlan(minutes, filter?)`    | A session plan: blocks (`warm-up`, `focus`, `review`, `fun`) with their minutes and items. |
| `timer()`                           | The running practice timer's start (epoch ms), or `null`.                                  |

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

| Method                                  | Does                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `logPractice(request, { adoptTimer? })` | Logs a session, exactly like the Log practice command.                                        |
| `setMastery(path, level)`               | Changes an item's mastery: a number (`40`) or the type's value (`"40 - Can play at tempo"`).  |
| `setBpm(path, { current?, target? })`   | Sets the current and/or target BPM.                                                           |
| `startTimer()`, `clearTimer()`          | Starts the practice timer (rejects when it is already running), or clears it without logging. |

A log request:

```js
await api.logPractice({
    date: '2026-10-28', // YYYY-MM-DD
    minutes: 30,
    startTime: '18:00', // optional, HH:MM
    focus: 'Barre chords', // optional, part of the session note's name
    quality: '★★★★', // optional, a value of the session type's quality property
    note: 'Clean changes at 70 BPM', // optional
    items: [
        { path: '…/F Major - Barre (Guitar Chord).md', bpm: 70, level: 30 },
        { path: '…/A Minor - Open (Guitar Chord).md', review: 'good' }
    ]
})
// → { sessionPath, items, activity: { path, result } | null, adoptedTimer, warnings }
```

The request is checked before anything is written: a `YYYY-MM-DD` date, whole minutes from 1 to 1440, an `HH:MM` start time, each item once, whole BPMs, review results `good`, `shaky` or `failed`, levels the item's type has. Items of several instruments are refused (one log is one session); for instrument-less items, pass `sessionTypeId`. One log runs at a time.

`activity.result` is `added` (a new time entry), `adopted` (the Kanban Action Planner timer's entry now points to the session), `exists`, `skipped` (the activity's time entries or minutes have a shape that can't be extended safely; nothing written) or `missing` (the adopted timer's entry didn't appear; nothing added). When a Kanban Action Planner timer runs on the activity, pass `{ adoptTimer: true }`, or the log is refused so the time is never counted twice. `warnings` lists what was left alone on purpose (minutes on a note that aren't a number…).
