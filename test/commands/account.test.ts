import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAccountList, runAccountUse } from '../../src/commands/account.js';
import type { Project } from '../../src/core/config.js';

const entries = [
  { id: 'acme_prd', description: 'Administrator @ Acme Inc' },
  { id: 'acme_sb1', description: 'Developer @ Acme Inc' },
];
const suitecloud = { listAuthIds: vi.fn(async () => entries) };

describe('runAccountList', () => {
  it('marks the current and the protected auth IDs', async () => {
    const project = { authId: 'acme_sb1', config: { protectedAuthIds: ['acme_prd'] } } as Project;
    expect(await runAccountList(project, suitecloud)).toEqual([
      '  acme_prd  Administrator @ Acme Inc  (protected)',
      '→ acme_sb1  Developer @ Acme Inc',
    ]);
  });

  it('works outside a project and when nothing is configured', async () => {
    expect(await runAccountList(null, suitecloud)).toHaveLength(2);
    expect(await runAccountList(null, { listAuthIds: async () => [] })).toEqual([
      'No auth IDs configured. Run "nsk account setup" in a project.',
    ]);
  });
});

describe('runAccountUse', () => {
  let root: string;

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes a known auth ID to project.json and rejects unknown ones', async () => {
    root = mkdtempSync(join(tmpdir(), 'nsk-account-'));
    writeFileSync(join(root, 'project.json'), '{ "defaultAuthId": "acme_sb1" }');
    const project = { root } as Project;

    await runAccountUse('acme_prd', project, suitecloud);
    expect(JSON.parse(readFileSync(join(root, 'project.json'), 'utf8'))).toEqual({ defaultAuthId: 'acme_prd' });

    await expect(runAccountUse('typo', project, suitecloud)).rejects.toThrow('Unknown auth ID "typo".');
  });
});
