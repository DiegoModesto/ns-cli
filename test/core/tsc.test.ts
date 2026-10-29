import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/core/config.js';
import type { ExecResult, Runner, Spawner } from '../../src/core/exec.js';
import { compileProject, parseWatchLine, watchProject } from '../../src/core/tsc.js';

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

describe('parseWatchLine', () => {
  it('recognizes the tsc --watch status lines', () => {
    expect(parseWatchLine('05:25:59 PM - Starting compilation in watch mode...')).toEqual({ type: 'started' });
    expect(parseWatchLine('05:26:02 PM - File change detected. Starting incremental compilation...')).toEqual({
      type: 'started',
    });
    expect(parseWatchLine('05:26:02 PM - Found 1 error. Watching for file changes.')).toEqual({ type: 'finished', errors: 1 });
    expect(parseWatchLine('05:26:05 PM - Found 0 errors. Watching for file changes.')).toEqual({ type: 'finished', errors: 0 });
    expect(parseWatchLine("src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.")).toBeNull();
  });
});

describe('watchProject', () => {
  it('runs tsc --watch and reports output lines and build events', () => {
    const spawner = vi.fn<Spawner>(() => ({ exited: new Promise(() => {}), stop: async () => {} }));
    const onOutput = vi.fn();
    const onEvent = vi.fn();

    watchProject(project, { onOutput, onEvent }, spawner);
    const [command, args, options] = spawner.mock.calls[0]!;
    options.onLine('src/a.ts(1,1): error TS1005');
    options.onLine('Found 1 error. Watching for file changes.');

    expect([command, args, options.cwd]).toEqual([
      'tsc',
      ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
      '/work/project',
    ]);
    expect(onOutput).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: 'finished', errors: 1 });
  });

  it('refuses JavaScript-only projects', () => {
    expect(() => watchProject({ ...project, typescript: null }, { onOutput() {}, onEvent() {} })).toThrow(/no tsconfig/);
  });
});
