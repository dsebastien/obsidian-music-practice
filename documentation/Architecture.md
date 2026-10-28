# Architecture

- `src/main.ts`: entry point, exports `MusicPracticePlugin`.
- `src/app/plugin.ts`: lifecycle, settings (Immer, single write path `updateSettings`), registration of commands, views and the public API.
- `src/app/domain/`: the rules, pure and unit-tested (see `Domain Model.md`). Every other layer calls into it; nothing else computes scores, reviews or plans.
- `src/app/services/` (v0.1, planned):
    - `starter-kit.service.ts`: read-only mirror of OSK note types (port of the Kanban Action Planner's adapter).
    - `note-model.service.ts`: learning and session types from OSK or from local settings (`source: starter-kit | local`).
    - `item-repository.ts`: learning notes → `LearningItemInput`, from the metadata cache.
    - `practice-log.service.ts`, `timer.service.ts`: the writers, through `processFrontMatter`.
- `src/app/commands/`, `src/app/ui/`: commands, modals and views.
- `src/app/api.ts` (planned): the public API exposed as `plugin.api` for scripts and AI skills.

Principles: the Obsidian Starter Kit stays the owner of note types and date stamps (single writer); no instrument, type, folder or label is hardcoded.
