/**
 * Render a Templater template headlessly: keep the frontmatter keys and their static values, drop
 * interactive Templater blocks (prompts, suggesters, file moves), and keep the body's headings.
 * Used for session notes, whose templates prompt for things a practice log already knows. Values
 * are written afterwards through `processFrontMatter`, so YAML quoting stays Obsidian's job.
 */

/** Drop `<%* … %>` blocks, single- or multi-line. */
export function stripTemplaterBlocks(lines: string[]): string[] {
    const out: string[] = []
    let inBlock = false
    for (const line of lines) {
        if (!inBlock && line.trimStart().startsWith('<%*')) {
            inBlock = !/%>\s*$/.test(line)
            continue
        }
        if (inBlock) {
            if (/%>\s*$/.test(line)) inBlock = false
            continue
        }
        out.push(line)
    }
    return out
}

const FENCE = /^\s*(?:<%\s*"---"\s*%>|---)\s*$/

/**
 * The note content for `template`: frontmatter keys with static values kept (a key whose value is
 * templated is left empty), body without Templater code, and `heading` as the H1 text when the
 * template computes it. Without frontmatter fences the result is an empty frontmatter and the body.
 */
export function renderTemplate(template: string, heading: string): string {
    const lines = template.split('\n')
    const fences = lines.flatMap((l, i) => (FENCE.test(l) ? [i] : []))
    if (fences.length < 2) return `---\n---\n# ${heading}\n`
    const fmLines = stripTemplaterBlocks(lines.slice(fences[0]! + 1, fences[1]))
    const fm: string[] = []
    for (let i = 0; i < fmLines.length; i++) {
        const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(fmLines[i]!)
        if (!m) continue
        const cont: string[] = []
        while (i + 1 < fmLines.length && /^\s+\S/.test(fmLines[i + 1]!)) cont.push(fmLines[++i]!)
        const templated = m[2]!.includes('<%') || cont.some((c) => c.includes('<%'))
        fm.push(...(templated ? [`${m[1]}:`] : [`${m[1]}:${m[2]}`, ...cont]))
    }
    const body = stripTemplaterBlocks(lines.slice(fences[1]! + 1))
        .join('\n')
        .replace(/^#\s+<%[\s\S]*?%>[ \t]*$/m, `# ${heading}`)
        .replace(/<%[\s\S]*?%>/g, '')
        .replace(/^\n+/, '\n')
    return `---\n${fm.join('\n')}\n---\n${body}`
}

/**
 * Put `text` under the level-2 heading named `name` (emoji or other prefix allowed: "## 📝 Notes"),
 * replacing the template's placeholder lines. Unchanged when the heading is absent.
 */
export function fillSection(content: string, name: string, text: string): string {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(
        `(^##\\s+(?:\\S+\\s+)?${esc}\\s*\\n)([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`,
        'm'
    )
    return re.test(content)
        ? content.replace(re, (_m, h: string) => `${h}${text.trimEnd()}\n\n`)
        : content
}
