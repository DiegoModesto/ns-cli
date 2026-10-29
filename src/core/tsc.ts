import { relative } from 'node:path';
import { NskError } from '../errors.js';
import type { Project } from './config.js';
import {
  type ExecResult,
  execaRunner,
  execaSpawner,
  type LongRunning,
  notStarted,
  type Runner,
  type Spawner,
} from './exec.js';

/**
 * Compiles the whole project with its tsconfig, using the project's own TypeScript install. With a bundler, tsc only
 * type-checks (noEmit) and `rollup -c` emits the AMD files.
 */
export async function compileProject(project: Project, runner: Runner = execaRunner): Promise<void> {
  const tsconfig = tsconfigArg(project);
  const result = await runner('tsc', ['-p', tsconfig], { cwd: project.root, stdio: 'inherit' });

  if (notStarted(result)) {
    throw new NskError('TypeScript compiler (tsc) not found.', 'Install it in the project with "npm install -D typescript".');
  }
  if (result.signal) {
    throw new NskError(`TypeScript compilation was interrupted (${result.signal}).`);
  }
  if (result.exitCode !== 0) {
    throw new NskError('TypeScript compilation failed.', 'Fix the errors above and try again.');
  }
  if (project.config.bundler) {
    checkBundle(await runner('rollup', ['-c'], { cwd: project.root, stdio: 'inherit' }));
  }
}

export type TscWatchEvent = { type: 'started' } | { type: 'finished'; errors: number };

/** Recognizes tsc --watch status lines ("Starting compilation…", "Found 2 errors. Watching for file changes."). */
export function parseWatchLine(line: string): TscWatchEvent | null {
  if (/Starting (incremental )?compilation/.test(line)) return { type: 'started' };
  const found = line.match(/Found (\d+) errors?\./);
  return found ? { type: 'finished', errors: Number(found[1]) } : null;
}

/**
 * Runs `tsc --watch` for the project; every output line goes to `onOutput`, build status to `onEvent`. With a
 * bundler, a clean check runs `rollup -c` and `finished` is reported only after it (errors: 1 when it fails), so
 * output emitted from code with errors is never reported as a clean build.
 */
export function watchProject(
  project: Project,
  handlers: { onOutput: (line: string) => void; onEvent: (event: TscWatchEvent) => void },
  spawner: Spawner = execaSpawner,
  runner: Runner = execaRunner,
): LongRunning {
  const tsconfig = tsconfigArg(project);
  let bundling = false;
  let bundleAgain = false;

  const bundle = async () => {
    if (bundling) {
      bundleAgain = true;
      return;
    }
    bundling = true;
    do {
      bundleAgain = false;
      const result = await runner('rollup', ['-c'], { cwd: project.root, stdio: 'pipe' });
      for (const line of `${result.stdout}\n${result.stderr}`.split('\n')) {
        if (line.trim()) handlers.onOutput(line);
      }
      let errors = 0;
      try {
        checkBundle(result);
      } catch (error) {
        handlers.onOutput(`✖ ${(error as Error).message}`);
        errors = 1;
      }
      if (!bundleAgain) handlers.onEvent({ type: 'finished', errors });
    } while (bundleAgain);
    bundling = false;
  };

  return spawner('tsc', ['-p', tsconfig, '--watch', '--preserveWatchOutput'], {
    cwd: project.root,
    onLine(line) {
      handlers.onOutput(line);
      const event = parseWatchLine(line);
      if (!event) return;
      if (event.type === 'finished' && event.errors === 0 && project.config.bundler) {
        void bundle();
      } else {
        handlers.onEvent(event);
      }
    },
  });
}

function tsconfigArg(project: Project): string {
  if (!project.typescript) {
    throw new NskError('This project has no tsconfig, so there is nothing to compile.');
  }
  return relative(project.root, project.typescript.tsconfig);
}

function checkBundle(result: ExecResult): void {
  if (notStarted(result)) {
    throw new NskError('rollup not found.', 'Install the project dependencies with "npm install".');
  }
  if (result.signal) {
    throw new NskError(`rollup was interrupted (${result.signal}).`);
  }
  if (result.exitCode !== 0) {
    throw new NskError('rollup failed to bundle the project.', 'Fix the errors above and try again.');
  }
}
