/**
 * Runs the production build on the Bun that package.json pins (`packageManager`).
 *
 * Bun's bundler output changes between Bun releases (1.4.0 and 1.4.2 write a different CommonJS
 * interop helper, for example). The community directory rebuilds the plugin with its own Bun and
 * compares main.js with the release asset byte for byte, so a build on another Bun fails that check.
 * When another Bun runs `scripts/build.ts --prod`, the same command runs again through
 * `bun x bun@<pin>` and its exit code is passed on. Dev builds and tests are not affected.
 *
 * Import this module first in scripts/build.ts: imports run in order, so the re-run happens before
 * the build does anything.
 */
import packageJson from '../package.json' with { type: 'json' }

const REEXEC_FLAG = 'PINNED_BUN_REEXEC'

export const pinnedBunVersion = (packageManager: string | undefined): string | null =>
    /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager ?? '')?.[1] ?? null

const pinned = pinnedBunVersion((packageJson as { packageManager?: string }).packageManager)
const isProdBuild = Bun.main.endsWith('build.ts') && process.argv.includes('--prod')

if (pinned && isProdBuild && Bun.version !== pinned && !process.env[REEXEC_FLAG]) {
    console.log(
        `Bun ${Bun.version} started the build: running it again on the pinned Bun ${pinned}.`
    )
    const child = Bun.spawn([process.execPath, 'x', `bun@${pinned}`, ...process.argv.slice(1)], {
        stdio: ['inherit', 'inherit', 'inherit'],
        env: { ...process.env, [REEXEC_FLAG]: '1' }
    })
    process.exit(await child.exited)
}
