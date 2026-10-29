import { relative } from 'node:path';
import { NskError } from '../errors.js';
import type { Project } from './config.js';
import { execaRunner, execaSpawner, type LongRunning, notStarted, type Runner, type Spawner } from './exec.js';

/** Compiles the whole project with its tsconfig, using the project's own TypeScript install. */
export async function compileProject(project: Project, runner: Runner = execaRunner): Promise<void> {
  if (!project.typescript) {
    throw new NskError('This project has no tsconfig, so there is nothing to compile.');
  }

  const tsconfig = relative(project.root, project.typescript.tsconfig);
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
}

export type TscWatchEvent = { type: 'started' } | { type: 'finished'; errors: number };

/** Recognizes tsc --watch status lines ("Starting compilation…", "Found 2 errors. Watching for file changes."). */
export function parseWatchLine(line: string): TscWatchEvent | null {
  if (/Starting (incremental )?compilation/.test(line)) return { type: 'started' };
  const found = line.match(/Found (\d+) errors?\./);
  return found ? { type: 'finished', errors: Number(found[1]) } : null;
}

/** Runs `tsc --watch` for the project; every output line goes to `onOutput`, build status to `onEvent`. */
export function watchProject(
  project: Project,
  handlers: { onOutput: (line: string) => void; onEvent: (event: TscWatchEvent) => void },
  spawner: Spawner = execaSpawner,
): LongRunning {
  if (!project.typescript) {
    throw new NskError('This project has no tsconfig, so there is nothing to compile.');
  }

  const tsconfig = relative(project.root, project.typescript.tsconfig);
  return spawner('tsc', ['-p', tsconfig, '--watch', '--preserveWatchOutput'], {
    cwd: project.root,
    onLine(line) {
      handlers.onOutput(line);
      const event = parseWatchLine(line);
      if (event) handlers.onEvent(event);
    },
  });
}
