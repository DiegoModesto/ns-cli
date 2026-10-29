import type { Command } from 'commander';
import { loadProject } from '../core/config.js';
import { compileProject } from '../core/tsc.js';
import { formatExamples, type Messages } from '../i18n.js';

export function registerBuild(program: Command, t: Messages): void {
  program
    .command('build')
    .description(t.build.description)
    .addHelpText('after', formatExamples(t.help.examples, t.build.examples))
    .action(async () => {
      await compileProject(loadProject(process.cwd()));
      console.log('✔ Build finished');
    });
}
