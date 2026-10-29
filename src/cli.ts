import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerDoctor } from './commands/doctor.js';
import { registerTemplates } from './commands/templates.js';
import { NskError } from './errors.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const program = new Command()
  .name('nsk')
  .description('TypeScript-first CLI for NetSuite SuiteCloud projects')
  .version(version);

registerDoctor(program);
registerTemplates(program);

try {
  await program.parseAsync();
} catch (error) {
  if (!(error instanceof NskError)) throw error;
  console.error(`✖ ${error.message}`);
  if (error.hint) console.error(`  ${error.hint}`);
  process.exitCode = 1;
}
