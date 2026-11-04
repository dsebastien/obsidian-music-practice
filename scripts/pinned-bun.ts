/**
 * Runs the production build in a fixed setup, so anyone who rebuilds a release tag gets the
 * released main.js byte for byte: the community directory does, and warns when the bytes differ.
 *
 * Two things change the bundle:
 * - The Bun version: the bundler's output changes between Bun releases (1.4.0 and 1.4.2 write a
 *   different CommonJS interop helper, for example). The build runs on the Bun that package.json
 *   pins (`packageManager`).
 * - `NODE_ENV`: Bun reads it when it starts, and with `production` it resolves packages through
 *   their `production` export conditions, so other files get bundled. Setting it inside the
 *   script is too late. The build always runs with `NODE_ENV=production`.
 *
 * When `scripts/build.ts --prod` starts in another setup, the same command runs again in the fixed
 * one (`bun x bun@<pin>` for another Bun, this Bun for another `NODE_ENV`) and its exit code is
 * passed on. When the pinned Bun can't be fetched (no network), the build goes on with this Bun
 * and says that its output may differ from the release. Dev builds and tests are not affected.
 *
 * Import this module first in scripts/build.ts: imports run in order, so the re-run happens before
 * the build does anything.
 */
import packageJson from '../package.json' with { type: 'json' }

const REEXEC_FLAG = 'PINNED_BUN_REEXEC'

/** The NODE_ENV every production build runs with. */
export const BUILD_NODE_ENV = 'production'

export const pinnedBunVersion = (packageManager: string | undefined): string | null =>
    /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager ?? '')?.[1] ?? null

export interface BuildSetup {
    /** The running Bun. */
    version: string
    /** The pinned Bun, or null when package.json pins none. */
    pinned: string | null
    nodeEnv: string | undefined
    /** A production build of scripts/build.ts. */
    prodBuild: boolean
    /** This process is already the re-run. */
    rerun: boolean
}

/**
 * How to run the build again, or null when this process can build: `bun` is the Bun version to
 * run (`null` for this one).
 */
export function rerunPlan(setup: BuildSetup): { bun: string | null } | null {
    if (!setup.prodBuild || setup.rerun) return null
    const otherBun = setup.pinned !== null && setup.version !== setup.pinned
    if (otherBun) return { bun: setup.pinned }
    if (setup.nodeEnv !== BUILD_NODE_ENV) return { bun: null }
    return null
}

const plan = rerunPlan({
    version: Bun.version,
    pinned: pinnedBunVersion((packageJson as { packageManager?: string }).packageManager),
    nodeEnv: process.env['NODE_ENV'],
    prodBuild: Bun.main.endsWith('build.ts') && process.argv.includes('--prod'),
    rerun: Boolean(process.env[REEXEC_FLAG])
})

if (plan) {
    const env = { ...process.env, [REEXEC_FLAG]: '1', NODE_ENV: BUILD_NODE_ENV }
    const script = process.argv.slice(1)
    let command = [process.execPath, ...script]
    if (plan.bun) {
        // A quick probe first: without network, `bun x` can't fetch the pinned Bun.
        const probe = Bun.spawnSync([process.execPath, 'x', `bun@${plan.bun}`, '--version'], {
            env,
            stdout: 'pipe',
            stderr: 'pipe'
        })
        if (probe.exitCode === 0 && probe.stdout.toString().trim() === plan.bun) {
            console.log(
                `Bun ${Bun.version} started the build: running it again on the pinned Bun ${plan.bun}.`
            )
            command = [process.execPath, 'x', `bun@${plan.bun}`, ...script]
        } else {
            console.warn(
                `The pinned Bun ${plan.bun} can't be fetched: building with Bun ${Bun.version}. main.js may differ from a release build.`
            )
        }
    } else {
        console.log(`Running the build again with NODE_ENV=${BUILD_NODE_ENV}.`)
    }
    const child = Bun.spawn(command, { stdio: ['inherit', 'inherit', 'inherit'], env })
    process.exit(await child.exited)
}
