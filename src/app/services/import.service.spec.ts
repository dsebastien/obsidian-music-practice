import { describe, expect, it } from 'bun:test'
import { fenced } from './import.service'

describe('fenced', () => {
    it('wraps a block in a fence', () => {
        expect(fenced('tab', ':8 3.3\n')).toBe('```tab\n:8 3.3\n```')
    })

    it('uses a longer fence when the content holds one', () => {
        expect(fenced('chords', '{title: x}\n```\nnot a fence\n```')).toBe(
            '````chords\n{title: x}\n```\nnot a fence\n```\n````'
        )
    })
})
