import { describe, expect, it } from 'bun:test'
import { fillSection, renderTemplate } from './template-render'

const TEMPLATE = `<%"---"%>
<%* const osk = app.plugins.plugins['obsidian-starter-kit']?.api?.templater; -%>
<%*
const TYPE = 'guitar-practice-sessions';
const day = await tp.system.prompt('Date');
-%>
review_count: 0
date: <% day %>
time_spent: <% minutes ?? '' %>
related_activities: []
practiced: []
tags:
  - zone/journal
  - type/session/music/guitar
<%"---"%>
<%*
await osk.fileInto(tp, osk.requireFolder(TYPE, day), name);
%>
# <% osk.stripAffixes(TYPE, name) %>

## Notes
-

## Wins and TILs
-
`

describe('renderTemplate', () => {
    const out = renderTemplate(TEMPLATE, '2026-10-28 Barre chords')

    it('keeps static frontmatter and empties templated values', () => {
        expect(out).toContain('review_count: 0\n')
        expect(out).toContain('date:\n')
        expect(out).toContain('time_spent:\n')
        expect(out).toContain('tags:\n  - zone/journal\n  - type/session/music/guitar\n')
    })

    it('drops Templater code and writes the heading', () => {
        expect(out).not.toContain('<%')
        expect(out).toContain('# 2026-10-28 Barre chords\n\n## Notes')
        expect(out.startsWith('---\n')).toBe(true)
    })

    it('handles a template without frontmatter fences', () => {
        expect(renderTemplate('Just text', 'T')).toBe('---\n---\n# T\n')
    })
})

describe('fillSection', () => {
    it('replaces the placeholder under the heading, emoji allowed', () => {
        const content = '# T\n\n## 📝 Notes\n- \n\n## Related\n- \n'
        expect(fillSection(content, 'Notes', '- Clean changes at 70 BPM')).toBe(
            '# T\n\n## 📝 Notes\n- Clean changes at 70 BPM\n\n## Related\n- \n'
        )
        expect(fillSection('# T\n', 'Notes', 'x')).toBe('# T\n')
    })
})

describe('number-like text', () => {
    it('keeps quoted number-like values from the template as written', () => {
        const out = renderTemplate(
            '<%"---"%>\nfrets: "022100"\nfingers: \'x01230\'\n<%"---"%>\n# T\n',
            'T'
        )
        expect(out).toContain('frets: "022100"\n')
        expect(out).toContain("fingers: 'x01230'\n")
    })
})
