import { Command, Help, type Option } from 'commander';
import { registerAccount } from './commands/account.js';
import { registerBuild } from './commands/build.js';
import { registerDeploy, registerValidate } from './commands/deploy.js';
import { registerDoctor } from './commands/doctor.js';
import { registerGenerate } from './commands/generate.js';
import { registerInit } from './commands/init.js';
import { registerTemplates } from './commands/templates.js';
import { registerUpload } from './commands/upload.js';
import { registerWatch } from './commands/watch.js';
import { type Locale, type Messages, messagesFor } from './i18n.js';

/** Builds the nsk program with every description, help title and example in `locale`. */
export function buildProgram(locale: Locale, version: string): Command {
  const t = messagesFor(locale);
  const titles: Record<string, string> = {
    'Usage:': t.help.usage,
    'Arguments:': t.help.arguments,
    'Options:': t.help.options,
    'Global Options:': t.help.globalOptions,
    'Commands:': t.help.commands,
  };

  const base = new Help();
  const placeholders = (text: string) =>
    text.replace('[options]', t.help.optionsPlaceholder).replace('[command]', t.help.commandPlaceholder);

  // Help settings are inherited by the commands created afterwards, so configure them first.
  const program = new Command()
    .name('nsk')
    .description(t.help.description)
    .version(version, '-V, --version', t.help.version)
    .helpOption('-h, --help', t.help.helpOption)
    .helpCommand(`help ${t.help.commandPlaceholder}`, t.help.helpCommand)
    .configureHelp({
      styleTitle: (title) => titles[title] ?? title,
      commandUsage: (command) => placeholders(base.commandUsage(command)),
      subcommandTerm: (command) => placeholders(base.subcommandTerm(command)),
      optionDescription: (option) => describeOption(option, t),
    })
    // Read and removed from argv by cli.ts before parsing; declared only so the help lists it.
    .option('--lang <lang>', t.help.lang)
    .addHelpText('after', `\n${t.help.footer}`);

  program.commandsGroup(t.help.groups.project);
  registerInit(program, t, version);
  registerDoctor(program, t);
  registerGenerate(program, t);
  registerBuild(program, t);
  registerTemplates(program, t);

  program.commandsGroup(t.help.groups.sync);
  registerUpload(program, t);
  registerWatch(program, t);
  registerValidate(program, t);
  registerDeploy(program, t);

  program.commandsGroup(t.help.groups.accounts);
  registerAccount(program, t);

  return program;
}

/** Like commander's, but translated and without the true/false defaults of flags (noise for users). */
function describeOption(option: Option, t: Messages): string {
  const extra: string[] = [];
  if (option.argChoices) extra.push(`${t.help.choices}: ${option.argChoices.join(', ')}`);
  if (option.defaultValue !== undefined && (option.required || option.optional)) {
    extra.push(`${t.help.default}: ${option.defaultValueDescription ?? String(option.defaultValue)}`);
  }
  return extra.length > 0 ? `${option.description} (${extra.join(', ')})` : option.description;
}
