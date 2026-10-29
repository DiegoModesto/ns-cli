import { createInterface } from 'node:readline/promises';
import { NskError } from '../errors.js';
import type { Project } from './config.js';

/** Asks a yes/no question; resolves false when nobody can answer (no TTY). */
export type Confirm = (question: string) => Promise<boolean>;

export const askInTerminal: Confirm = async (question) => {
  if (!process.stdin.isTTY) return false;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await terminal.question(question)).trim());
  } finally {
    terminal.close();
  }
};

/**
 * Stops actions that change the account when the project's auth ID is listed in protectedAuthIds, unless `yes` was
 * passed or the user confirms. Without a terminal there is nobody to confirm, so it fails.
 */
export async function guardProtectedAccount(
  project: Pick<Project, 'authId' | 'config'>,
  action: string,
  yes: boolean,
  confirm: Confirm = askInTerminal,
): Promise<void> {
  const { authId } = project;
  if (yes || !authId || !project.config.protectedAuthIds.includes(authId)) return;
  if (!(await confirm(`"${authId}" is a protected account. ${action}? (y/N) `))) {
    throw new NskError(`Cancelled: "${authId}" is a protected account.`, 'Confirm when asked, or pass --yes.');
  }
}
