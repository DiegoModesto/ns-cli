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

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create a SuiteCloud project set up for TypeScript')
    .argument('<name>', 'project name')
    .option('--suiteapp', 'create a SuiteApp instead of an account customization project', false)
    .option('--publisher-id <id>', 'SuiteApp publisher id, e.g. com.acme')
    .option('--project-id <id>', 'SuiteApp project id, e.g. myapp')
    .option('--project-version <version>', 'SuiteApp version', '1.0.0')
    .option('--no-install', 'skip "npm install"')
    .option('--force', 'create the project even if the folder is not empty (suitecloud --overwrite)', false)
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
