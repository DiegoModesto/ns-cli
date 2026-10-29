import { type Command, Option } from 'commander';
import { loadProject, type Project } from '../core/config.js';
import { askInTerminal, type Confirm, guardProtectedAccount } from '../core/guard.js';
import { type AccountSpecificValues, SuiteCloud } from '../core/suitecloud.js';
import { compileProject } from '../core/tsc.js';
import { NskError } from '../errors.js';
import { formatExamples, type Messages } from '../i18n.js';

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

const asvOption = (description: string) => new Option('--asv <mode>', description).choices(['ERROR', 'WARNING']);

export function registerValidate(program: Command, t: Messages): void {
  program
    .command('validate')
    .description(t.validate.description)
    .option('--server', t.validate.server, false)
    .addOption(asvOption(t.validate.asv))
    .option('--no-compile', t.validate.noCompile)
    .addHelpText('after', formatExamples(t.help.examples, t.validate.examples))
    .action(async (options: ProjectCommandOptions) => {
      const project = loadProject(process.cwd());
      await runValidate(project, options, defaultDeps(project));
    });
}

export function registerDeploy(program: Command, t: Messages): void {
  program
    .command('deploy')
    .description(t.deploy.description)
    .option('--dry-run', t.deploy.dryRun, false)
    .addOption(asvOption(t.deploy.asv))
    .option('--no-compile', t.deploy.noCompile)
    .option('-y, --yes', t.deploy.yes, false)
    .addHelpText('after', formatExamples(t.help.examples, t.deploy.examples))
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
