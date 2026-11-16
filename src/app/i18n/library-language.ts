import { currentLanguage } from './i18n'
import type { Language } from './language'

/**
 * The language to give the music-notation library, for the buttons and labels of the blocks it
 * draws (#112). The library can't be translated yet (dsebastien/music-notation#136), so nothing
 * passes it today. Once it can, the change is one line, where the plugin builds the render
 * options: add `language: libraryLanguage()` in `layoutDefaults()`
 * (`src/app/domain/notation-layout.ts`, the options of every diagram block) and in the
 * `renderTab(...)` options of `TabChild.draw()` (`src/app/services/notation.service.ts`).
 */
export const libraryLanguage = (): Language => currentLanguage()
