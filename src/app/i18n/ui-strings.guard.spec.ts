import { describe, expect, it } from 'bun:test'

/**
 * A text the plugin shows goes through the catalog (`t('area.key')`), never a string literal in
 * the source. This scan fails on a UI call or option given a literal with words in it.
 *
 * ALLOWED holds the literals that stay: each is `file` -> the exact literal, with the reason
 * next to it. Add one only when the text is not shown to a reader as a message: a stored value,
 * a block keyword, a property name, a symbol, a CSS-only text.
 */
const ALLOWED: Record<string, string[]> = {
    // An example of a stored shape value (a block value, never translated).
    'app/ui/add-note-modal.ts': ['Open']
}

/** The calls and options that take a text a reader sees or hears. */
const PATTERNS: RegExp[] = [
    /new Notice\(\s*/g,
    /\.setName\(\s*/g,
    /\.setDesc\(\s*/g,
    /\.setButtonText\(\s*/g,
    /\.setPlaceholder\(\s*/g,
    /\.setTooltip\(\s*/g,
    /\.setTitle\(\s*/g,
    /\.setText\(\s*/g,
    /\.setHeading\(\s*/g,
    /\bsetAttribute\(\s*['"](?:aria-label|title|placeholder)['"],\s*/g,
    /\baria-label['"]?\s*:\s*/g,
    /\b(?:text|title|placeholder|tooltip|desc|heading)\s*:\s*/g,
    /\.(?:textContent|innerText|title|placeholder|ariaLabel)\s*=\s*/g
]

const SRC = `${import.meta.dir}/../..`

/** Source files relative to `src/`, specs, declarations, the catalog and test setup left out. */
function sources(): string[] {
    return [...new Bun.Glob('**/*.ts').scanSync({ cwd: SRC })]
        .map((path) => path.replaceAll('\\', '/'))
        .filter(
            (path) =>
                !path.endsWith('.spec.ts') &&
                !path.endsWith('.d.ts') &&
                !path.startsWith('app/i18n/messages/') &&
                path !== 'test-setup.ts'
        )
        .sort()
}

/** The string literal starting at `index`, or null when what is there is not a literal. */
function literalAt(source: string, index: number): string | null {
    const quote = source[index]
    if (quote !== "'" && quote !== '"' && quote !== '`') return null
    let i = index + 1
    let body = ''
    while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
            body += source.slice(i, i + 2)
            i += 2
            continue
        }
        body += source[i]
        i++
    }
    return body
}

/** Whether a literal holds words (two letters in a row) once its `${}` parts are removed. */
const hasWords = (literal: string): boolean =>
    /[A-Za-zÀ-ɏ]{2,}/.test(literal.replace(/\$\{[^}]*\}/g, ''))

describe('UI texts', () => {
    it('are keys of the catalog, not string literals in the source', async () => {
        const found: string[] = []
        for (const name of sources()) {
            const source = await Bun.file(`${SRC}/${name}`).text()
            const allowed = ALLOWED[name] ?? []
            for (const pattern of PATTERNS) {
                for (const match of source.matchAll(pattern)) {
                    const literal = literalAt(source, match.index + match[0].length)
                    if (literal === null || !hasWords(literal)) continue
                    if (allowed.includes(literal)) continue
                    const line = source.slice(0, match.index).split('\n').length
                    found.push(`${name}:${line} ${literal.slice(0, 60)}`)
                }
            }
        }
        expect(found).toEqual([])
    })
})
