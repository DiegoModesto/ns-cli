import { createRequire } from 'node:module';
import * as clack from '@clack/prompts';
import { readSettings } from './core/settings.js';
import { NskError } from './errors.js';
import { messagesFor, parseLocale, resolveLocale, stripLangArg, systemLocale } from './i18n.js';
import { startInteractive, takeInteractiveFlag } from './interactive.js';
import { buildProgram } from './program.js';
import { PromptCancelled } from './prompter.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const settings = readSettings();
const { locale, source } = resolveLocale({ argv: process.argv, env: process.env, saved: settings.language, system: systemLocale });
const t = messagesFor(locale);
const program = buildProgram(locale, version, {
  locale,
  source,
  // What "auto" would pick: everything except the flag, NSK_LANG and the saved choice.
  computer: () => resolveLocale({ argv: [], env: { ...process.env, NSK_LANG: undefined }, system: systemLocale }).locale,
});
const isTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);

try {
  let { interactive, argv } = takeInteractiveFlag(stripLangArg(process.argv));
  // "nsk" alone in a terminal opens the menu; in scripts/CI it still prints the help.
  if (interactive || (argv.length === 2 && isTerminal)) {
    if (!isTerminal) throw new NskError(t.interactive.needsTerminal);
    const command = argv[2]?.startsWith('-') ? undefined : argv[2];
    const args = await startInteractive(command, t, parseLocale(settings.language));
    if (!args) process.exit(0);
    argv = [...argv.slice(0, 2), ...args];
  }
  await program.parseAsync(argv);
} catch (error) {
  if (error instanceof PromptCancelled) {
    clack.cancel(t.interactive.cancelled);
    process.exitCode = 130;
  } else {
    if (!(error instanceof NskError)) throw error;
    console.error(`✖ ${error.message}`);
    if (error.hint) console.error(`  ${error.hint}`);
    process.exitCode = 1;
  }
}
