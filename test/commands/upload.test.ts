import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runUpload, type UploadDeps, type UploadOptions } from '../../src/commands/upload.js';
import type { Project } from '../../src/core/config.js';

const root = resolve('/work/project');
const project = {
  root,
  fileCabinetDir: join(root, 'src/FileCabinet'),
  typescript: {
    tsconfig: join(root, 'tsconfig.json'),
    sourceDir: join(root, 'src/Source'),
    outDir: join(root, 'src/FileCabinet/SuiteScripts'),
  },
  authId: 'sandbox',
  config: { protectedAuthIds: ['production'] },
} as Project;

const defaults: UploadOptions = { dryRun: false, compile: true };

function fakeDeps(overrides: Partial<UploadDeps> = {}) {
  return {
    cwd: root,
    suitecloud: { upload: vi.fn(async () => {}) },
    compile: vi.fn(async () => {}),
    exists: vi.fn(() => true),
    confirm: vi.fn(async () => false),
    ...overrides,
  } satisfies UploadDeps;
}

describe('runUpload', () => {
  it('compiles once and uploads .ts and .js files in one call, resolving paths from cwd', async () => {
    const deps = fakeDeps({ cwd: join(root, 'src') });
    await runUpload(['Source/App/a.ts', 'Source/App/b.ts', 'FileCabinet/SuiteScripts/lib/c.js'], project, defaults, deps);

    expect(deps.compile).toHaveBeenCalledExactlyOnceWith(project);
    expect(deps.suitecloud.upload).toHaveBeenCalledExactlyOnceWith([
      '/SuiteScripts/App/a.js',
      '/SuiteScripts/App/b.js',
      '/SuiteScripts/lib/c.js',
    ]);
  });

  it('dedupes a .ts source and its compiled .js', async () => {
    const deps = fakeDeps();
    await runUpload(['src/Source/a.ts', 'src/FileCabinet/SuiteScripts/a.js', 'src/Source/a.ts'], project, defaults, deps);
    expect(deps.suitecloud.upload).toHaveBeenCalledWith(['/SuiteScripts/a.js']);
  });

  it('does not compile when only .js files are given', async () => {
    const deps = fakeDeps();
    await runUpload(['src/FileCabinet/SuiteScripts/a.js'], { ...project, typescript: null }, defaults, deps);
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.suitecloud.upload).toHaveBeenCalledWith(['/SuiteScripts/a.js']);
  });

  it('skips compiling with --no-compile', async () => {
    const deps = fakeDeps();
    await runUpload(['src/Source/a.ts'], project, { ...defaults, compile: false }, deps);
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.suitecloud.upload).toHaveBeenCalledOnce();
  });

  it('only resolves targets on --dry-run', async () => {
    const deps = fakeDeps();
    const targets = await runUpload(['src/Source/a.ts'], project, { ...defaults, dryRun: true }, deps);

    expect(targets).toMatchObject([{ source: join(root, 'src/Source/a.ts'), fileCabinetPath: '/SuiteScripts/a.js' }]);
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.suitecloud.upload).not.toHaveBeenCalled();
  });

  it('lists compiled files that do not exist', async () => {
    const deps = fakeDeps({ exists: vi.fn((file: string) => !file.endsWith('b.js')) });
    await expect(runUpload(['src/Source/a.ts', 'src/Source/b.ts'], project, defaults, deps)).rejects.toThrow(
      `Compiled file not found:\n  - ${join('src', 'FileCabinet', 'SuiteScripts', 'b.js')}`,
    );
    expect(deps.suitecloud.upload).not.toHaveBeenCalled();
  });

  it('asks before uploading to a protected account, unless --yes', async () => {
    const protectedProject = { ...project, authId: 'production' };
    const deps = fakeDeps();

    await expect(runUpload(['src/Source/a.ts'], protectedProject, defaults, deps)).rejects.toThrow(/protected account/);
    expect(deps.confirm).toHaveBeenCalledWith('"production" is a protected account. Upload 1 file to it? (y/N) ');
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.suitecloud.upload).not.toHaveBeenCalled();

    await runUpload(['src/Source/a.ts'], protectedProject, { ...defaults, yes: true }, deps);
    expect(deps.suitecloud.upload).toHaveBeenCalledOnce();
  });

  it('requires at least one file', async () => {
    await expect(runUpload([], project, defaults, fakeDeps())).rejects.toThrow('No files to upload.');
  });
});
