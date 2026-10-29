import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/core/config.js';
import { guardProtectedAccount } from '../../src/core/guard.js';
import { NskError } from '../../src/errors.js';

const project = (authId: string | null) =>
  ({ authId, config: { protectedAuthIds: ['production'] } }) as Pick<Project, 'authId' | 'config'>;

describe('guardProtectedAccount', () => {
  it('does not ask for unprotected or missing auth IDs, nor with --yes', async () => {
    const confirm = vi.fn(async () => false);
    await guardProtectedAccount(project('sandbox'), 'Deploy', false, confirm);
    await guardProtectedAccount(project(null), 'Deploy', false, confirm);
    await guardProtectedAccount(project('production'), 'Deploy', true, confirm);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('continues when confirmed and throws when refused or nobody can answer', async () => {
    await guardProtectedAccount(project('production'), 'Deploy', false, async () => true);
    await expect(guardProtectedAccount(project('production'), 'Deploy', false, async () => false)).rejects.toThrow(NskError);
  });
});
