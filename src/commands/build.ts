import type { Command } from 'commander';
import { loadProject } from '../core/config.js';
import { compileProject } from '../core/tsc.js';

export function registerBuild(program: Command): void {
  program
    .command('build')
    .description('Compile the project (tsc, then rollup when ns.config.json sets a bundler)')
    .action(async () => {
      await compileProject(loadProject(process.cwd()));
      console.log('✔ Build finished');
    });
}
