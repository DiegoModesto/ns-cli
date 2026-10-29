import { relative } from 'node:path';
import { type Command, Option } from 'commander';
import { loadProject } from '../core/config.js';
import { type GenerateOptions, planGenerate, writeGenerated } from '../core/generate.js';
import { NskError } from '../errors.js';
import { findTemplate } from '../templates.js';
import { formatExamples, type Messages } from '../i18n.js';

interface Options extends Partial<Pick<GenerateOptions, 'language' | 'dir' | 'scriptId' | 'recordType'>> {
  object: boolean;
  force: boolean;
}

export function registerGenerate(program: Command, t: Messages): void {
  program
    .command('generate')
    .alias('g')
    .description(t.generate.description)
    .argument('<template>', t.generate.template)
    .argument('<name>', t.generate.name)
    .addOption(new Option('-l, --language <language>', t.generate.language).choices(['typescript', 'javascript']))
    .option('-d, --dir <dir>', t.generate.dir)
    .option('--object', t.generate.object, false)
    .option('--script-id <id>', t.generate.scriptId)
    .option('--record-type <type>', t.generate.recordType)
    .option('--force', t.generate.force, false)
    .addHelpText('after', formatExamples(t.help.examples, t.generate.examples))
    .action((templateId: string, name: string, options: Options) => {
      const template = findTemplate(templateId);
      if (!template) {
        throw new NskError(`Unknown template "${templateId}".`, 'Run "nsk templates list" to see the available ones.');
      }
      const cwd = process.cwd();
      const project = loadProject(cwd);
      const files = planGenerate(
        template,
        name,
        { ...options, language: options.language ?? (project.typescript ? 'typescript' : 'javascript') },
        project,
      );
      writeGenerated(files, options.force);
      for (const file of files) console.log(`✔ Created ${relative(cwd, file.path)}`);
    });
}
