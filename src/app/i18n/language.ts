/**
 * The languages the plugin speaks. English is the source and the fallback; French is the first
 * translation. The language comes from Obsidian, there is no setting (#112).
 */
export const LANGUAGES = ['en', 'fr'] as const

export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

/**
 * Obsidian's language code (`getLanguage()`: `en`, `fr`, `fr-FR`, `fr-BE`, `zh-TW`...) to the
 * plugin's language. A language the plugin has no translation for gives English. Pure.
 */
export function resolveLanguage(code: string | null | undefined): Language {
    if (typeof code !== 'string') return DEFAULT_LANGUAGE
    const primary = code.trim().toLowerCase().split(/[-_]/)[0]
    return LANGUAGES.find((language) => language === primary) ?? DEFAULT_LANGUAGE
}

/**
 * Obsidian's language code, read through a function that may be missing (Obsidian before 1.8.7
 * has no `getLanguage`): the code, or undefined when it can't be read.
 */
export function readLanguageCode(getter: (() => string) | undefined): string | undefined {
    if (typeof getter !== 'function') return undefined
    try {
        return getter()
    } catch {
        return undefined
    }
}
