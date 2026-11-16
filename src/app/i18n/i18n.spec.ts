import { afterEach, describe, expect, it } from 'bun:test'
import { currentLanguage, interpolate, messageIn, setLanguage, t, tn } from './i18n'

afterEach(() => setLanguage('en'))

describe('t', () => {
    it('is English until a language is set', () => {
        expect(currentLanguage()).toBe('en')
        expect(t('common.cancel')).toBe('Cancel')
    })

    it('speaks French once set', () => {
        setLanguage('fr')
        expect(t('common.cancel')).toBe('Annuler')
    })

    it('falls back to English for a key the language misses', () => {
        expect(messageIn('fr', 'common.cancel')).toBe('Annuler')
        expect(messageIn('fr', 'no.such.key')).toBeUndefined()
        // A key only English has: look it up without the French table.
        setLanguage('fr')
        expect(messageIn('fr', 'common.cancel')).not.toBe(messageIn('en', 'common.cancel'))
    })

    it('returns the key itself for an unknown key', () => {
        // @ts-expect-error not a catalog key
        expect(t('no.such.key')).toBe('no.such.key')
    })
})

describe('interpolate', () => {
    it('fills named placeholders, each as many times as it appears', () => {
        expect(interpolate('{a} and {b} and {a}', { a: 'x', b: 2 })).toBe('x and 2 and x')
    })

    it('leaves an unknown placeholder as written', () => {
        expect(interpolate('Hello {name}', { other: 'x' })).toBe('Hello {name}')
        expect(interpolate('Hello {name}')).toBe('Hello {name}')
    })

    it('passes a literal brace through a value', () => {
        expect(interpolate('Use {token}', { token: '{subject}' })).toBe('Use {subject}')
    })

    it('does not re-read a value that looks like a placeholder', () => {
        expect(interpolate('{a} {b}', { a: '{b}', b: 'x' })).toBe('{b} x')
    })
})

describe('tn', () => {
    it('picks one or other by the language plural rule', () => {
        expect(tn('common.minutes', 1)).toBe('1 minute')
        expect(tn('common.minutes', 2)).toBe('2 minutes')
        expect(tn('common.minutes', 0)).toBe('0 minutes')
        setLanguage('fr')
        expect(tn('common.minutes', 0)).toBe('0 minute')
        expect(tn('common.minutes', 1)).toBe('1 minute')
        expect(tn('common.minutes', 2)).toBe('2 minutes')
    })
})
