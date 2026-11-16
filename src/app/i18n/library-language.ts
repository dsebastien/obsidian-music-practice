import { currentLanguage } from './i18n'
import type { Language } from './language'

/**
 * The language given to the music-notation library, for the buttons, labels and messages of the
 * blocks it draws (#112, music-notation #136, from 0.23.0): the plugin's own, so Obsidian's.
 * Passed in `layoutDefaults()` (`src/app/domain/notation-layout.ts`, the options of every
 * diagram block) and in the `renderTab(...)` options of `TabChild.draw()`
 * (`src/app/services/notation.service.ts`).
 */
export const libraryLanguage = (): Language => currentLanguage()
