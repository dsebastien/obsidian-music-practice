# Domain Model

Code: `src/app/domain/`. Pure TypeScript, no Obsidian imports; rules in `Business Rules.md`.

- **Rules** (`rules.ts`): `PracticeRules`, every number the rules use (levels, review, score, plan); `createDefaultRules()`. Every domain function takes `rules` (default `DEFAULT_RULES`).
- **Fields** (`fields.ts`): `FieldNames`, the frontmatter property names (configurable).
- **Mastery** (`mastery.ts`): `levelOf(value)` reads the number of a status value, `labelFor(level, values)`, `isActiveLevel(level, rules)`.
- **Review** (`review.ts`): `reviewStatus`, `reviewOutcome`, `intervalOnLevelChange` (light SM-2).
- **Practice** (`practice.ts`): `LearningItemInput` (read from a note) and `LearningItem` (plus derived state: review, BPM progress, prerequisites, ready, unlocks, focus, score), `computeItems`, `practiceNext`, `readyToLearn`.
- **Plan** (`plan.ts`): `buildPlan(items, minutes, rules)` → warm-up / focus / review / fun blocks adding up to the session.
- **Log** (`log.ts`): `LogRequest` and `validateLogRequest`, `itemUpdate` / `levelChange` (what a practiced or re-levelled note gets), `freshItem` (the item as its frontmatter says at write time), `applyItemUpdate`, `addTimeEntry` (Kanban Action Planner format, deduplicated, lossless), `splitMinutes`, session naming.
- **Note model** (`note-model.ts`): `LearningType`, `SessionType`, `buildNoteModel` from type descriptors (OSK).
- **Standalone model** (`local-model.ts`): `LocalModelSettings`, `buildLocalModel` from observed notes, `expandTokens`.
- **Item reader** (`item-reader.ts`): `tagsOf`, `mergeTags`, `learningTypeOf` (most specific type wins), `toLearningItemInput`.
- **Rubric** (`rubric.ts`): rubric texts per kind group, by role; `rubricFor(kind, rubric, rules)`.
- **Chord** (`chord.ts`): `parseChord` (symbol → ASCII name, root, quality), `chordTitle`, `safeTitle`.
- **Template render** (`template-render.ts`): `renderTemplate` (a Templater template without its scripts), `fillSection`.
- **Timer** (`timer.ts`), **Dates** (`dates.ts`): formatting and date helpers.
