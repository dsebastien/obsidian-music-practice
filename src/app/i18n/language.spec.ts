import { describe, expect, it } from 'bun:test'
import { DEFAULT_LANGUAGE, readLanguageCode, resolveLanguage } from './language'

describe('resolveLanguage', () => {
    it('gives French for fr and its regional forms', () => {
        for (const code of ['fr', 'fr-FR', 'fr-BE', 'fr-CA', 'FR', 'fr_CH', ' fr ']) {
            expect(resolveLanguage(code)).toBe('fr')
        }
    })

    it('gives English for English', () => {
        expect(resolveLanguage('en')).toBe('en')
        expect(resolveLanguage('en-GB')).toBe('en')
    })

    it('gives English for any other language', () => {
        for (const code of ['de', 'es', 'zh-TW', 'pt-BR', 'ja', 'frx', 'f']) {
            expect(resolveLanguage(code)).toBe('en')
        }
    })

    it('gives English when there is no usable code', () => {
        expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE)
        expect(resolveLanguage(null)).toBe(DEFAULT_LANGUAGE)
        expect(resolveLanguage('')).toBe('en')
    })
})

describe('readLanguageCode', () => {
    it('returns what the getter returns', () => {
        expect(readLanguageCode(() => 'fr')).toBe('fr')
    })

    it('returns undefined when getLanguage is missing (older Obsidian)', () => {
        expect(readLanguageCode(undefined)).toBeUndefined()
        expect(resolveLanguage(readLanguageCode(undefined))).toBe('en')
    })

    it('returns undefined when the getter throws', () => {
        expect(
            readLanguageCode(() => {
                throw new Error('boom')
            })
        ).toBeUndefined()
    })
})
