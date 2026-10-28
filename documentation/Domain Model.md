# Domain Model

Code: `src/app/domain/`. Pure TypeScript, no Obsidian imports; rules in `Business Rules.md`.

- **Mastery** (`mastery.ts`): `LEVEL` (10 Want to learn … 60 Mastered), `levelOf(value)` reads the number of a status value, `labelFor(level, values)` finds a type's label for a number, `isActiveLevel` (20–50).
- **Review** (`review.ts`): `reviewStatus(level, interval, daysSinceReview)` → overdue / due-soon / current / never / null; `reviewOutcome(result, current, date)` → new last-reviewed, count, interval (and level 50 when a mastered item fails); `intervalOnLevelChange`.
- **LearningItemInput** (`practice.ts`): what is read from a learning note: path, name, kind, type id, level, priority, the type's top priority, last practiced / reviewed, interval, count, BPMs, prerequisites, links.
- **LearningItem**: the input plus derived state: days since practiced / review, review status, BPM progress, open and missing prerequisites, ready, unlocks, focus, score. Built by `computeItems(inputs, today)`.
- **Selections** (`practice.ts`): `practiceNext` (active or due, by score), `readyToLearn`.
- **PracticePlan** (`plan.ts`): `buildPlan(items, minutes, split)` → blocks warm-up / focus / review / fun with planned items and minutes.
- **Dates** (`dates.ts`): `isoDate`, `daysBetween`.
