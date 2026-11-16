import * as obsidian from 'obsidian'
import { readLanguageCode, resolveLanguage, type Language } from './language'
import { setLanguage } from './i18n'

/**
 * Reads Obsidian's language (`getLanguage()`, Obsidian 1.8.7+; English where it is missing) and
 * makes it the plugin's language. Called once, at the start of the plugin's load.
 */
export function initLanguage(): Language {
    const getter = (obsidian as Partial<typeof obsidian>).getLanguage
    const language = resolveLanguage(readLanguageCode(getter))
    setLanguage(language)
    return language
}
