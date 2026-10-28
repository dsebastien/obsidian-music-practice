import { describe, expect, it } from 'bun:test'
import { summarize } from './api'
import type { NoteModel } from './domain/note-model'
import { computeItems } from './domain/practice'
import { input } from './domain/practice.spec'

describe('summarize', () => {
    const model: NoteModel = {
        learningTypes: [
            {
                id: 'guitar-chords',
                name: 'Guitar Chords',
                typeTag: 'type/music/guitar/chord',
                domain: 'music',
                subject: 'guitar',
                kind: 'chord',
                tags: [],
                statusProperty: 'mastery',
                statusValues: ['10 - Want to learn', '20 - Learning'],
                stamps: {},
                fields: new Set(),
                topPriority: 10,
                templatePath: null,
                allowedValues: {}
            }
        ],
        sessionTypes: []
    }

    it('gives plain JSON with the type, subject and mastery label', () => {
        const [item] = computeItems([input('E Major')], '2026-10-28')
        const summary = summarize(model, item!)
        expect(summary).toMatchObject({
            name: 'E Major',
            type: 'Guitar Chords',
            subject: 'guitar',
            kind: 'chord',
            level: 20,
            mastery: '20 - Learning',
            score: 55
        })
        expect(JSON.parse(JSON.stringify(summary))).toEqual(summary)
    })
})
