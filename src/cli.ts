import { createRequire } from 'node:module';
import { NskError } from './errors.js';
import { detectLocale, stripLangArg } from './i18n.js';
import { buildProgram } from './program.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const program = buildProgram(detectLocale(process.argv, process.env), version);

try {
  await program.parseAsync(stripLangArg(process.argv));
} catch (error) {
  if (!(error instanceof NskError)) throw error;
  console.error(`✖ ${error.message}`);
  if (error.hint) console.error(`  ${error.hint}`);
  process.exitCode = 1;
}
