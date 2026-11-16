/**
 * Message catalog: `t('area.key', { name })` returns the text in the language Obsidian runs in.
 *
 * - One table per language, merged from one module per area (`messages/en/<area>.ts`,
 *   `messages/fr/<area>.ts`). English is the source: its keys are the `MessageKey` type, so a
 *   wrong key is a compile error, and so is a placeholder the English text names and the call
 *   leaves out. A key a language misses falls back to English.
 * - Placeholders are `{name}`. A literal brace is passed as a value (`{ subject: '{subject}' }`).
 * - Plurals: `tn('area.key', count)` picks `area.key.one` or `area.key.other` (the language's
 *   plural rule, `{count}` filled in).
 * - The language is set once, at plugin load (`setLanguage(resolveLanguage(getLanguage()))`).
 *   Until then, and in tests, it is English.
 */
import { DEFAULT_LANGUAGE, type Language } from './language'
import { en } from './messages/en'
import { fr } from './messages/fr'

type English = typeof en

export type MessageKey = keyof English

type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}`
    ? P | Placeholders<Rest>
    : never

export type MessageParams = Record<string, string | number>

type ParamsArgs<K extends MessageKey> = [Placeholders<English[K]>] extends [never]
    ? [params?: MessageParams]
    : [params: Record<Placeholders<English[K]>, string | number>]

/** Keys `x.one` that also have `x.other`: what `tn` takes. */
export type PluralKey = {
    [K in MessageKey]: K extends `${infer Base}.one`
        ? `${Base}.other` extends MessageKey
            ? Base
            : never
        : never
}[MessageKey]

const TABLES: Record<Language, Readonly<Record<string, string>>> = { en, fr }

let current: Language = DEFAULT_LANGUAGE

export function setLanguage(language: Language): void {
    current = language
}

export function currentLanguage(): Language {
    return current
}

/** Replaces each `{name}` of `text` by its value; an unknown name stays as written. */
export function interpolate(text: string, params?: MessageParams): string {
    if (!params) return text
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = params[name]
        return value === undefined ? whole : String(value)
    })
}

/** The text of a key in a language, English when that language misses it. */
export function messageIn(language: Language, key: string): string | undefined {
    return TABLES[language][key] ?? TABLES.en[key]
}

export function t<K extends MessageKey>(key: K, ...args: ParamsArgs<K>): string {
    return interpolate(messageIn(current, key) ?? key, args[0])
}

/** A text that depends on a count: `base.one` or `base.other`, `{count}` filled in. */
export function tn(base: PluralKey, count: number, params?: MessageParams): string {
    const category = new Intl.PluralRules(current).select(count) === 'one' ? 'one' : 'other'
    const key = `${base}.${category}`
    return interpolate(messageIn(current, key) ?? key, { ...params, count })
}
