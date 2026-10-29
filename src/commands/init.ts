import { join, relative } from 'node:path';
import type { Command } from 'commander';
import { writeGenerated } from '../core/generate.js';
import {
  assertEmptyFolder,
  ensureGitignore,
  installDependencies,
  projectFolderName,
  scaffoldFiles,
  type ScaffoldOptions,
} from '../core/scaffold.js';
import { SuiteCloud } from '../core/suitecloud.js';
import { NskError } from '../errors.js';
import { formatExamples, type Messages } from '../i18n.js';

export interface InitOptions {
  suiteapp: boolean;
  publisherId?: string;
  projectId?: string;
  projectVersion: string;
  install: boolean;
  force: boolean;
}

export interface InitDeps {
  cwd: string;
  suitecloud: Pick<SuiteCloud, 'createProject'>;
  install: (dir: string) => Promise<void>;
}

export function registerInit(program: Command, t: Messages): void {
  program
    .command('init')
    .description(t.init.description)
    .argument('<name>', t.init.name)
    .option('--suiteapp', t.init.suiteapp, false)
    .option('--publisher-id <id>', t.init.publisherId)
    .option('--project-id <id>', t.init.projectId)
    .option('--project-version <version>', t.init.projectVersion, '1.0.0')
    .option('--no-install', t.init.noInstall)
    .option('--force', t.init.force, false)
    .addHelpText('after', formatExamples(t.help.examples, t.init.examples))
    .action(async (name: string, options: InitOptions) => {
      const cwd = process.cwd();
      const dir = await runInit(name, options, {
        cwd,
        suitecloud: new SuiteCloud(cwd),
        install: (folder) => installDependencies(folder),
      });
      console.log(`\n✔ Created ${relative(cwd, dir) || '.'}\n\nNext steps:`);
      console.log(`  cd ${relative(cwd, dir)}`);
      if (!options.install) console.log('  npm install');
      console.log('  suitecloud account:setup');
      console.log('  nsk generate user-event-script ue_example');
      console.log('  nsk doctor');
    });
}

/** Creates the SuiteCloud project, adds the TypeScript setup and installs dependencies; returns its folder. */
export async function runInit(name: string, options: InitOptions, deps: InitDeps): Promise<string> {
  if (!/^[\w.-]+$/.test(name)) {
    throw new NskError(`Invalid project name "${name}".`, 'Use letters, digits, "_", "-" or ".".');
  }
  let suiteApp: ScaffoldOptions['suiteApp'] = null;
  if (options.suiteapp) {
    if (!options.publisherId || !options.projectId) {
      throw new NskError('A SuiteApp needs a publisher id and a project id.', 'Pass --publisher-id com.acme --project-id myapp.');
    }
    suiteApp = { publisherId: options.publisherId, projectId: options.projectId };
  }

  const scaffold: ScaffoldOptions = { name, suiteApp };
  const dir = join(deps.cwd, projectFolderName(scaffold));
  assertEmptyFolder(dir, options.force);

  await deps.suitecloud.createProject({
    name,
    suiteApp: suiteApp && { ...suiteApp, projectVersion: options.projectVersion },
    overwrite: options.force,
  });
  writeGenerated(scaffoldFiles(dir, scaffold), options.force);
  ensureGitignore(join(dir, '.gitignore'), ['node_modules', '.env']);
  if (options.install) await deps.install(dir);
  return dir;
}
