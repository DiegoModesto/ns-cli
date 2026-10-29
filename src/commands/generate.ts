import { relative } from 'node:path';
import { type Command, Option } from 'commander';
import { loadProject } from '../core/config.js';
import { type GenerateOptions, planGenerate, writeGenerated } from '../core/generate.js';
import { NskError } from '../errors.js';
import { findTemplate } from '../templates.js';

interface Options extends Partial<Pick<GenerateOptions, 'language' | 'dir' | 'scriptId' | 'recordType'>> {
  object: boolean;
  force: boolean;
}

export function registerGenerate(program: Command): void {
  program
    .command('generate')
    .alias('g')
    .description('Generate a script from a template, optionally with its SDF object')
    .argument('<template>', 'template id (see "nsk templates list")')
    .argument('<name>', 'file name without extension, e.g. ue_sales_order')
    .addOption(
      new Option('-l, --language <language>', 'default: typescript when the project has a tsconfig').choices([
        'typescript',
        'javascript',
      ]),
    )
    .option('-d, --dir <dir>', 'subfolder below the scripts folder, e.g. App/_EntryPoints')
    .option('--object', 'also generate the SDF script object (XML) with a deployment', false)
    .option('--script-id <id>', 'id after customscript_ (default: the name in snake_case)')
    .option('--record-type <type>', 'record the deployment applies to, e.g. SALESORDER (with --object)')
    .option('--force', 'overwrite existing files', false)
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
