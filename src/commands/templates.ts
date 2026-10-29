import { type Command, Option } from 'commander';
import { NskError } from '../errors.js';
import { findTemplate, loadTemplates, readTemplate, type TemplateLanguage } from '../templates.js';
import { formatExamples, type Messages } from '../i18n.js';

export function registerTemplates(program: Command, t: Messages): void {
  const templates = program
    .command('templates')
    .description(t.templates.description)
    .addHelpText('after', formatExamples(t.help.examples, t.templates.examples));

  templates
    .command('list')
    .description(t.templates.list)
    .action(() => {
      for (const template of loadTemplates()) {
        const languages = Object.keys(template.files).join(', ');
        console.log(`${template.id.padEnd(28)} ${(template.scriptType ?? template.kind).padEnd(26)} ${languages}`);
      }
    });

  templates
    .command('show')
    .description(t.templates.show)
    .argument('<id>', t.templates.id)
    .addOption(
      new Option('-l, --language <language>', t.templates.language)
        .choices(['typescript', 'javascript', 'xml'])
        .default('typescript'),
    )
    .action((id: string, options: { language: TemplateLanguage }) => {
      const template = findTemplate(id);
      if (!template) {
        throw new NskError(`Unknown template "${id}".`, 'Run "nsk templates list" to see the available ones.');
      }
      const language = template.kind === 'sdf-object' ? 'xml' : options.language;
      process.stdout.write(readTemplate(template, language));
    });
}
