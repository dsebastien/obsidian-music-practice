import { describe, expect, it } from 'bun:test'
import { parseUriRequest, uriFor, URI_ACTIONS, URI_HANDLER } from './uri'

const parse = (query: Record<string, string>) => parseUriRequest({ action: URI_HANDLER, ...query })

describe('URI actions (#47)', () => {
    it('reads each action from do=', () => {
        for (const action of URI_ACTIONS)
            expect(parse({ do: action })).toEqual({ ok: true, action, minutes: null })
    })

    it('has an action to discard the timer, which never takes minutes', () => {
        expect(URI_ACTIONS).toContain('discard-timer')
        expect(parse({ do: 'discard-timer' })).toEqual({
            ok: true,
            action: 'discard-timer',
            minutes: null
        })
        expect(parse({ do: 'discard-timer', minutes: '5' })).toMatchObject({ ok: false })
    })

    it('reads an action Obsidian left in action= too', () => {
        expect(parseUriRequest({ action: 'log' })).toEqual({
            ok: true,
            action: 'log',
            minutes: null
        })
    })

    it('takes minutes for log and plan, from 1 to 1440', () => {
        expect(parse({ do: 'log', minutes: '30' })).toEqual({
            ok: true,
            action: 'log',
            minutes: 30
        })
        expect(parse({ do: 'plan', minutes: ' 45 ' })).toEqual({
            ok: true,
            action: 'plan',
            minutes: 45
        })
        for (const minutes of ['0', '1441', '2.5', '-3', 'thirty', '', '1e2'])
            expect(parse({ do: 'log', minutes })).toMatchObject({ ok: false })
    })

    it('refuses minutes on the other actions, unknown actions and unknown parameters', () => {
        const error = (query: Record<string, string>) => {
            const request = parse(query)
            return request.ok ? '' : request.error
        }
        expect(error({ do: 'start-timer', minutes: '30' })).toContain('only work with log and plan')
        expect(error({ do: 'delete-everything' })).toContain('unknown action')
        expect(error({ do: 'log', path: 'Secret.md' })).toContain('"path"')
        expect(error({})).toContain('do=')
    })

    it('keeps the vault parameter Obsidian adds', () => {
        expect(parse({ vault: 'notes', do: 'practice-next' })).toEqual({
            ok: true,
            action: 'practice-next',
            minutes: null
        })
    })

    it('writes URIs for the guide', () => {
        expect(uriFor('log', 30)).toBe('obsidian://music-practice?do=log&minutes=30')
        expect(uriFor('start-timer', undefined, 'My notes')).toBe(
            'obsidian://music-practice?vault=My%20notes&do=start-timer'
        )
    })
})
