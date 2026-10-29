import { describe, expect, it, vi } from 'vitest';
import { type ProjectCommandDeps, runDeploy, runValidate } from '../../src/commands/deploy.js';
import type { Project } from '../../src/core/config.js';

const project = {
  root: '/work/project',
  typescript: { tsconfig: '/work/project/tsconfig.json', sourceDir: '/s', outDir: '/o' },
  suiteApp: null,
  authId: 'sandbox',
  config: { protectedAuthIds: ['production'] },
} as unknown as Project;

function fakeDeps(confirmed = false) {
  return {
    suitecloud: { validate: vi.fn(async () => {}), deploy: vi.fn(async () => {}) },
    compile: vi.fn(async () => {}),
    confirm: vi.fn(async () => confirmed),
  } satisfies ProjectCommandDeps;
}

describe('runValidate', () => {
  it('compiles, then validates with the given options', async () => {
    const deps = fakeDeps();
    await runValidate(project, { compile: true, server: true, asv: 'WARNING' }, deps);

    expect(deps.compile).toHaveBeenCalledWith(project);
    expect(deps.suitecloud.validate).toHaveBeenCalledWith({ server: true, accountSpecificValues: 'WARNING' });
    expect(deps.compile.mock.invocationCallOrder[0]).toBeLessThan(deps.suitecloud.validate.mock.invocationCallOrder[0]!);
  });

  it('skips compiling with --no-compile or without a tsconfig', async () => {
    const deps = fakeDeps();
    await runValidate(project, { compile: false }, deps);
    await runValidate({ ...project, typescript: null }, { compile: true }, deps);
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.suitecloud.validate).toHaveBeenCalledTimes(2);
  });

  it('rejects --asv on a SuiteApp', async () => {
    const suiteApp = { ...project, suiteApp: { publisherId: 'com.acme', projectId: 'app' } };
    await expect(runValidate(suiteApp, { compile: true, asv: 'ERROR' }, fakeDeps())).rejects.toThrow(/SuiteApp/);
  });
});

describe('runDeploy', () => {
  it('compiles and deploys to an unprotected account without asking', async () => {
    const deps = fakeDeps();
    await runDeploy(project, { compile: true, dryRun: false }, deps);

    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.suitecloud.deploy).toHaveBeenCalledWith({ dryRun: false, accountSpecificValues: undefined });
  });

  it('asks before deploying to a protected account and stops when refused', async () => {
    const deps = fakeDeps(false);
    const production = { ...project, authId: 'production' };

    await expect(runDeploy(production, { compile: true }, deps)).rejects.toThrow('Cancelled: "production" is a protected account.');
    expect(deps.confirm).toHaveBeenCalledWith('"production" is a protected account. Deploy the project to it? (y/N) ');
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.suitecloud.deploy).not.toHaveBeenCalled();
  });

  it('deploys to a protected account when confirmed, with --yes or on a dry run', async () => {
    const production = { ...project, authId: 'production' };

    const confirmed = fakeDeps(true);
    await runDeploy(production, { compile: true }, confirmed);
    expect(confirmed.suitecloud.deploy).toHaveBeenCalledOnce();

    const yes = fakeDeps(false);
    await runDeploy(production, { compile: true, yes: true }, yes);
    await runDeploy(production, { compile: true, dryRun: true }, yes);
    expect(yes.confirm).not.toHaveBeenCalled();
    expect(yes.suitecloud.deploy).toHaveBeenCalledTimes(2);
  });
});
