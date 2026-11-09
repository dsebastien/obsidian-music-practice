/** A block read as the library reads it: its own note names into letters (music-notation #12). */
import { lettersInBlock } from '@dsebastien/music-notation'

/**
 * A block's body in letters, its own `naming:` line (charts: `{naming: …}`) taken out, so the
 * plugin reads a solfège or German block as the library draws it. A block with a wrong naming line
 * stays as written (the library shows the mistake).
 */
export function inLetters(language: string, body: string): string {
    try {
        return lettersInBlock(language, body).text
    } catch {
        return body
    }
}
