import type { Command } from 'commander';
import { loadProject, type Project, writeAuthId } from '../core/config.js';
import { SuiteCloud } from '../core/suitecloud.js';
import { NskError } from '../errors.js';

export function registerAccount(program: Command): void {
  const account = program.command('account').description('List, switch and set up NetSuite accounts (auth IDs)');

  account
    .command('list')
    .description('List the auth IDs configured on this machine')
    .action(async () => {
      const project = tryLoadProject();
      for (const line of await runAccountList(project, new SuiteCloud(process.cwd()))) console.log(line);
    });

  account
    .command('use')
    .description("Set the project's default auth ID (project.json)")
    .argument('<authId>', 'auth ID (see "nsk account list")')
    .action(async (authId: string) => {
      const project = loadProject(process.cwd());
      await runAccountUse(authId, project, new SuiteCloud(project.root));
      console.log(`✔ ${project.root} now uses "${authId}"`);
    });

  account
    .command('setup')
    .description('Log in to an account and set it as the project default (suitecloud account:setup)')
    .action(async () => {
      const project = loadProject(process.cwd());
      await new SuiteCloud(project.root).setupAccount();
    });
}

/** Formats the auth ID list, marking the project's current one and the protected ones. */
export async function runAccountList(project: Project | null, suitecloud: Pick<SuiteCloud, 'listAuthIds'>): Promise<string[]> {
  const entries = await suitecloud.listAuthIds();
  if (entries.length === 0) return ['No auth IDs configured. Run "nsk account setup" in a project.'];

  const width = Math.max(...entries.map((entry) => entry.id.length));
  return entries.map((entry) => {
    const current = entry.id === project?.authId ? '→' : ' ';
    const isProtected = project?.config.protectedAuthIds.includes(entry.id) ? '  (protected)' : '';
    return `${current} ${entry.id.padEnd(width)}  ${entry.description}${isProtected}`;
  });
}

export async function runAccountUse(authId: string, project: Project, suitecloud: Pick<SuiteCloud, 'listAuthIds'>): Promise<void> {
  const entries = await suitecloud.listAuthIds();
  if (!entries.some((entry) => entry.id === authId)) {
    throw new NskError(`Unknown auth ID "${authId}".`, 'Run "nsk account list" to see them, or "nsk account setup" to add one.');
  }
  writeAuthId(project.root, authId);
}

/** `account list` also works outside a project; it just cannot mark the current auth ID. */
function tryLoadProject(): Project | null {
  try {
    return loadProject(process.cwd());
  } catch (error) {
    if (error instanceof NskError) return null;
    throw error;
  }
}
