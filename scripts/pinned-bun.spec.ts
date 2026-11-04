import { describe, expect, test } from 'bun:test'
import packageJson from '../package.json' with { type: 'json' }
import { pinnedBunVersion, rerunPlan } from './pinned-bun'

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

describe('rerunPlan', () => {
    const setup = {
        version: '1.4.0',
        pinned: '1.4.0',
        nodeEnv: 'production',
        prodBuild: true,
        rerun: false
    }

    test('builds in place on the pinned Bun with NODE_ENV=production', () => {
        expect(rerunPlan(setup)).toBeNull()
    })

    test('runs again on the pinned Bun when another Bun starts the build', () => {
        expect(rerunPlan({ ...setup, version: '1.3.14' })).toEqual({ bun: '1.4.0' })
        expect(rerunPlan({ ...setup, version: '1.4.2', nodeEnv: undefined })).toEqual({
            bun: '1.4.0'
        })
    })

    test('runs again on this Bun when NODE_ENV is not production (it changes the bundle)', () => {
        expect(rerunPlan({ ...setup, nodeEnv: undefined })).toEqual({ bun: null })
        expect(rerunPlan({ ...setup, nodeEnv: 'development' })).toEqual({ bun: null })
    })

    test('never runs again from the re-run, for dev builds, or without a pin for another env', () => {
        expect(rerunPlan({ ...setup, version: '1.3.14', rerun: true })).toBeNull()
        expect(rerunPlan({ ...setup, version: '1.3.14', prodBuild: false })).toBeNull()
        expect(rerunPlan({ ...setup, pinned: null, version: '1.3.14' })).toBeNull()
        expect(rerunPlan({ ...setup, pinned: null, nodeEnv: undefined })).toEqual({ bun: null })
    })
})
