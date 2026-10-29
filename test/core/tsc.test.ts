import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/core/config.js';
import type { ExecResult, Runner } from '../../src/core/exec.js';
import { compileProject } from '../../src/core/tsc.js';

const project = {
  root: '/work/project',
  typescript: {
    tsconfig: '/work/project/tsconfig.build.json',
    sourceDir: '/work/project/src/Source',
    outDir: '/work/project/src/FileCabinet/SuiteScripts',
  },
} as Project;

function fakeRunner(exitCode: ExecResult['exitCode']) {
  return vi.fn<Runner>(async () => ({ exitCode, stdout: '', stderr: '' }));
}

describe('compileProject', () => {
  it('runs tsc with the project tsconfig from the project root', async () => {
    const runner = fakeRunner(0);
    await compileProject(project, runner);
    expect(runner).toHaveBeenCalledWith('tsc', ['-p', 'tsconfig.build.json'], { cwd: '/work/project', stdio: 'inherit' });
  });

  it('fails on compilation errors', async () => {
    await expect(compileProject(project, fakeRunner(2))).rejects.toThrow('TypeScript compilation failed.');
  });

  it('explains a missing compiler', async () => {
    await expect(compileProject(project, fakeRunner(undefined))).rejects.toThrow(/tsc\) not found/);
  });

  it('reports an interrupted compilation instead of a missing compiler', async () => {
    const runner = vi.fn<Runner>(async () => ({ exitCode: undefined, signal: 'SIGTERM', stdout: '', stderr: '' }));
    await expect(compileProject(project, runner)).rejects.toThrow('TypeScript compilation was interrupted (SIGTERM).');
  });

  it('refuses JavaScript-only projects', async () => {
    await expect(compileProject({ ...project, typescript: null }, fakeRunner(0))).rejects.toThrow(/no tsconfig/);
  });
});
