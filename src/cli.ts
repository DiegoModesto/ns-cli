import { createRequire } from 'node:module';
import { Command, Option } from 'commander';
import { findTemplate, loadTemplates, readTemplate, type TemplateLanguage } from './templates.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const program = new Command()
  .name('nsk')
  .description('TypeScript-first CLI for NetSuite SuiteCloud projects')
  .version(version);

const templates = program.command('templates').description('Browse the built-in SuiteScript templates');

templates
  .command('list')
  .description('List available templates')
  .action(() => {
    for (const template of loadTemplates()) {
      const languages = Object.keys(template.files).join(', ');
      console.log(`${template.id.padEnd(28)} ${(template.scriptType ?? template.kind).padEnd(26)} ${languages}`);
    }
  });

templates
  .command('show')
  .description('Print a template')
  .argument('<id>', 'template id (see "nsk templates list")')
  .addOption(
    new Option('-l, --language <language>', 'template language')
      .choices(['typescript', 'javascript', 'xml'])
      .default('typescript'),
  )
  .action((id: string, options: { language: TemplateLanguage }) => {
    const template = findTemplate(id);
    if (!template) {
      return program.error(`Unknown template "${id}". Run "nsk templates list" to see the available ones.`);
    }
    const language = template.kind === 'sdf-object' ? 'xml' : options.language;
    process.stdout.write(readTemplate(template, language));
  });

await program.parseAsync();
