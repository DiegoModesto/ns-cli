import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type InitDeps, type InitOptions, runInit } from '../../src/commands/init.js';
import { loadProject } from '../../src/core/config.js';
import type { CreateProjectOptions } from '../../src/core/suitecloud.js';

let cwd: string;

const defaults: InitOptions = { suiteapp: false, projectVersion: '1.0.0', install: true, force: false };

/** Fake suitecloud: creates the folder and files `project:create` would. */
function fakeDeps() {
  return {
    cwd,
    suitecloud: {
      createProject: vi.fn(async ({ name, suiteApp }: CreateProjectOptions) => {
        const dir = join(cwd, suiteApp ? `${suiteApp.publisherId}.${suiteApp.projectId}` : name);
        mkdirSync(join(dir, 'src'), { recursive: true });
        writeFileSync(join(dir, 'suitecloud.config.js'), 'module.exports = { defaultProjectFolder: "src" };');
        writeFileSync(join(dir, '.gitignore'), 'node_modules\nproject.json');
        const type = suiteApp ? 'SUITEAPP' : 'ACCOUNTCUSTOMIZATION';
        const ids = suiteApp ? `<publisherid>${suiteApp.publisherId}</publisherid><projectid>${suiteApp.projectId}</projectid>` : '';
        writeFileSync(join(dir, 'src', 'manifest.xml'), `<manifest projecttype="${type}">${ids}</manifest>`);
      }),
    },
    install: vi.fn(async () => {}),
  } satisfies InitDeps;
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'nsk-init-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('runInit', () => {
  it('creates an account customization project that nsk can load', async () => {
    const deps = fakeDeps();
    const dir = await runInit('demo', defaults, deps);

    expect(dir).toBe(join(cwd, 'demo'));
    expect(deps.suitecloud.createProject).toHaveBeenCalledWith({ name: 'demo', suiteApp: null, overwrite: false });
    expect(deps.install).toHaveBeenCalledWith(dir);

    const project = loadProject(dir);
    expect(project.config.bundler).toBe('rollup');
    expect(project.typescript).toEqual({
      tsconfig: join(dir, 'tsconfig.json'),
      sourceDir: join(dir, 'src/Source'),
      outDir: join(dir, 'src/FileCabinet/SuiteScripts'),
    });

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).toBe('nsk build');
    expect(pkg.devDependencies).toHaveProperty('typescript');
    expect(pkg.devDependencies).not.toHaveProperty('@diegomodesto/ns');
    expect(readFileSync(join(dir, 'rollup.config.mjs'), 'utf8')).toContain("const outDir = 'src/FileCabinet/SuiteScripts';");
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('node_modules\nproject.json\n\n# nsk\n.env\n');
  });

  it('creates a SuiteApp whose scripts go to its own SuiteApps folder', async () => {
    const deps = fakeDeps();
    const options = { ...defaults, suiteapp: true, publisherId: 'com.acme', projectId: 'myapp', install: false };
    const dir = await runInit('app', options, deps);

    expect(dir).toBe(join(cwd, 'com.acme.myapp'));
    expect(deps.suitecloud.createProject).toHaveBeenCalledWith({
      name: 'app',
      suiteApp: { publisherId: 'com.acme', projectId: 'myapp', projectVersion: '1.0.0' },
      overwrite: false,
    });
    expect(deps.install).not.toHaveBeenCalled();

    const project = loadProject(dir);
    expect(project.suiteApp).toEqual({ publisherId: 'com.acme', projectId: 'myapp' });
    expect(project.typescript?.outDir).toBe(join(dir, 'src/FileCabinet/SuiteApps/com.acme.myapp'));
  });

  it('adds the running nsk version to devDependencies', async () => {
    const dir = await runInit('demo', defaults, { ...fakeDeps(), nskVersion: '0.1.0' });
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.devDependencies['@diegomodesto/ns']).toBe('^0.1.0');
  });

  it('requires the SuiteApp ids', async () => {
    await expect(runInit('app', { ...defaults, suiteapp: true }, fakeDeps())).rejects.toThrow(/publisher id and a project id/);
  });

  it('refuses a folder that is not empty unless forced', async () => {
    mkdirSync(join(cwd, 'demo'));
    writeFileSync(join(cwd, 'demo', 'notes.txt'), 'keep');
    const deps = fakeDeps();

    await expect(runInit('demo', defaults, deps)).rejects.toThrow(/not empty/);
    expect(deps.suitecloud.createProject).not.toHaveBeenCalled();

    await runInit('demo', { ...defaults, force: true }, deps);
    expect(deps.suitecloud.createProject).toHaveBeenCalledWith(expect.objectContaining({ overwrite: true }));
  });

  it('rejects invalid project names', async () => {
    await expect(runInit('../x', defaults, fakeDeps())).rejects.toThrow(/Invalid project name/);
  });
});
