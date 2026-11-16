import { currentLanguage } from '../i18n/i18n'

/** Names in a sentence ("A and B", "A, B and C"), in the plugin's language. */
export const joinNames = (names: readonly string[]): string =>
    new Intl.ListFormat(currentLanguage(), { style: 'long', type: 'conjunction' }).format(names)
