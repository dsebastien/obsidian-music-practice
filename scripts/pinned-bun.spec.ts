import { describe, expect, test } from 'bun:test'
import packageJson from '../package.json' with { type: 'json' }
import { pinnedBunVersion } from './pinned-bun'

describe('pinnedBunVersion', () => {
    test('reads an exact Bun version', () => {
        expect(pinnedBunVersion('bun@1.4.0')).toBe('1.4.0')
    })

    test('ignores other package managers, ranges and a missing field', () => {
        expect(pinnedBunVersion('npm@10.9.0')).toBeNull()
        expect(pinnedBunVersion('bun@^1.4.0')).toBeNull()
        expect(pinnedBunVersion('bun@1.4')).toBeNull()
        expect(pinnedBunVersion(undefined)).toBeNull()
    })

    test('package.json pins an exact Bun version (the release build depends on it)', () => {
        expect(pinnedBunVersion(packageJson.packageManager)).not.toBeNull()
    })
})
