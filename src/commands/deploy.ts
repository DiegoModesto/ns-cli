import { type Command, Option } from 'commander';
import { loadProject, type Project } from '../core/config.js';
import { askInTerminal, type Confirm, guardProtectedAccount } from '../core/guard.js';
import { type AccountSpecificValues, SuiteCloud } from '../core/suitecloud.js';
import { compileProject } from '../core/tsc.js';
import { NskError } from '../errors.js';

export interface ProjectCommandOptions {
  compile: boolean;
  asv?: AccountSpecificValues;
  server?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

export interface ProjectCommandDeps {
  suitecloud: Pick<SuiteCloud, 'validate' | 'deploy'>;
  compile: (project: Project) => Promise<void>;
  confirm: Confirm;
}

const asvOption = () =>
  new Option('--asv <mode>', 'account-specific values: ERROR stops, WARNING continues (account customization only)').choices(
    ['ERROR', 'WARNING'],
  );

export function registerValidate(program: Command): void {
  program
    .command('validate')
    .description('Compile and validate the project (suitecloud project:validate)')
    .option('--server', 'validate on the server instead of locally', false)
    .addOption(asvOption())
    .option('--no-compile', 'skip compiling first')
    .action(async (options: ProjectCommandOptions) => {
      const project = loadProject(process.cwd());
      await runValidate(project, options, defaultDeps(project));
    });
}

export function registerDeploy(program: Command): void {
  program
    .command('deploy')
    .description('Compile and deploy the project (suitecloud project:deploy)')
    .option('--dry-run', 'preview the deployment without changing the account', false)
    .addOption(asvOption())
    .option('--no-compile', 'skip compiling first')
    .option('-y, --yes', 'skip the confirmation for protected accounts', false)
    .action(async (options: ProjectCommandOptions) => {
      const project = loadProject(process.cwd());
      await runDeploy(project, options, defaultDeps(project));
    });
}

function defaultDeps(project: Project): ProjectCommandDeps {
  return { suitecloud: new SuiteCloud(project.root), compile: compileProject, confirm: askInTerminal };
}

export async function runValidate(project: Project, options: ProjectCommandOptions, deps: ProjectCommandDeps): Promise<void> {
  checkAccountSpecificValues(project, options.asv);
  if (options.compile && project.typescript) await deps.compile(project);
  await deps.suitecloud.validate({ server: options.server, accountSpecificValues: options.asv });
}

export async function runDeploy(project: Project, options: ProjectCommandOptions, deps: ProjectCommandDeps): Promise<void> {
  checkAccountSpecificValues(project, options.asv);
  if (!options.dryRun) {
    await guardProtectedAccount(project, 'Deploy the project to it', options.yes ?? false, deps.confirm);
  }
  if (options.compile && project.typescript) await deps.compile(project);
  await deps.suitecloud.deploy({ dryRun: options.dryRun, accountSpecificValues: options.asv });
}

function checkAccountSpecificValues(project: Project, asv: AccountSpecificValues | undefined): void {
  if (asv && project.suiteApp) {
    throw new NskError('--asv only applies to account customization projects, and this one is a SuiteApp.');
  }
}
