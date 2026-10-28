# Architecture

- `src/main.ts`: entry point, exports `MusicPracticePlugin`.
- `src/app/plugin.ts`: lifecycle, settings (Immer, single write path `updateSettings`, cross-checked on load, reloaded on external changes), commands, the practice timer (status bar), event wiring (metadata changes, renames and deletes invalidate the item index), and the public API (`plugin.api`). Services are private.
- `src/app/domain/`: the rules, pure and unit-tested (see `Domain Model.md`). Every other layer calls into it; nothing else computes scores, reviews, plans or log updates.
- `src/app/services/`:
    - `starter-kit.service.ts`: read-only adapter for the Obsidian Starter Kit (types, status, global properties, folder and affix resolution, `note-types-changed`), feature-detected.
    - `kanban-action-planner.service.ts`: the Kanban Action Planner's property names (time, review) and its running timer.
    - `note-model.service.ts`: learning and session types from OSK, or the standalone model inferred from the notes; keeps the same model object while nothing changes.
    - `item-repository.ts`: learning notes → `LearningItemInput`, from the metadata cache, cached until the vault or the model changes.
    - `practice-log.service.ts`: the log writer (checks everything first, then session note, practiced notes, activity), mastery and BPM writes, activity lookup, timer guard.
    - `note-creator.service.ts`: new learning notes from the type's template (rendered without its prompts), with a chord's voicing and diagram.
    - `notation.service.ts`: registers the notation code block processors (one per enabled language, skipping languages another plugin owns) and renders through `@dsebastien/music-notation` (voicings included); the library's CSS is imported into `styles.css` at build time.
- `src/app/ui/`: modals (practice next, plan, log, mastery, BPM, add) and the item card renderer.
- `src/app/settings/`: the declarative settings tab and `setting-paths.ts` (read, parse, validate settings by path).
- `src/app/api.ts`: the public API (plain JSON, version 1).

Principles: the Obsidian Starter Kit stays the owner of note types and date stamps (single writer); no instrument, type, folder or label is hardcoded; writes go through `processFrontMatter`, one per note.
