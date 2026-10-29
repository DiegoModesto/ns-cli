import { relative } from 'node:path';
import { NskError } from '../errors.js';
import type { Project } from './config.js';
import { execaRunner, notStarted, type Runner } from './exec.js';

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
