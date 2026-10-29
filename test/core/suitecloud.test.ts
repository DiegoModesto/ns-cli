import { describe, expect, it, vi } from 'vitest';
import type { ExecResult, Runner } from '../../src/core/exec.js';
import { SuiteCloud } from '../../src/core/suitecloud.js';
import { NskError } from '../../src/errors.js';

function fakeRunner(result: Partial<ExecResult> = {}) {
  return vi.fn<Runner>(async () => ({ exitCode: 0, stdout: '', stderr: '', ...result }));
}

describe('SuiteCloud', () => {
  it('parses the version', async () => {
    const runner = fakeRunner({ stdout: '3.0.2\n' });
    expect(await new SuiteCloud('/p', runner).version()).toBe('3.0.2');
    expect(runner).toHaveBeenCalledWith('suitecloud', ['--version'], { cwd: '/p', stdio: 'pipe' });
  });

  it('returns null as version when the CLI is missing', async () => {
    expect(await new SuiteCloud('/p', fakeRunner({ exitCode: undefined })).version()).toBeNull();
  });

  it('uploads several File Cabinet paths in one call', async () => {
    const runner = fakeRunner();
    await new SuiteCloud('/p', runner).upload(['/SuiteScripts/a.js', '/SuiteScripts/b.js']);
    expect(runner).toHaveBeenCalledWith('suitecloud', ['file:upload', '--paths', '/SuiteScripts/a.js', '/SuiteScripts/b.js'], {
      cwd: '/p',
      stdio: 'inherit',
    });
  });

  it('refuses an empty upload', () => {
    expect(() => new SuiteCloud('/p', fakeRunner()).upload([])).toThrow(NskError);
  });

  it('builds validate and deploy arguments', async () => {
    const runner = fakeRunner();
    const suitecloud = new SuiteCloud('/p', runner);

    await suitecloud.validate({ server: true, accountSpecificValues: 'WARNING' });
    await suitecloud.deploy({ dryRun: true });
    await suitecloud.deploy();

    expect(runner.mock.calls.map(([, args]) => args)).toEqual([
      ['project:validate', '--server', '--accountspecificvalues', 'WARNING'],
      ['project:deploy', '--dryrun'],
      ['project:deploy'],
    ]);
  });

  it('captures the auth ID list', async () => {
    const runner = fakeRunner({ stdout: 'sandbox | 123_SB1 | Administrator' });
    expect(await new SuiteCloud('/p', runner).listAuthIds()).toContain('sandbox');
    expect(runner).toHaveBeenCalledWith('suitecloud', ['account:manageauth', '--list'], { cwd: '/p', stdio: 'pipe' });
  });

  it('explains a missing CLI', async () => {
    const promise = new SuiteCloud('/p', fakeRunner({ exitCode: undefined })).deploy();
    await expect(promise).rejects.toThrow('SuiteCloud CLI not found.');
    await expect(promise).rejects.toMatchObject({ hint: expect.stringContaining('@oracle/suitecloud-cli') });
  });

  it('reports an interrupted command instead of a missing CLI', async () => {
    const runner = fakeRunner({ exitCode: undefined, signal: 'SIGINT' });
    await expect(new SuiteCloud('/p', runner).deploy()).rejects.toThrow('suitecloud project:deploy was interrupted (SIGINT).');
  });

  it('reports failures with the exit code and captured output', async () => {
    const runner = fakeRunner({ exitCode: 2, stderr: 'Invalid auth ID' });
    await expect(new SuiteCloud('/p', runner).listAuthIds()).rejects.toThrow(/exit code 2\.\nInvalid auth ID/);
  });
});

describe('SuiteCloud.createProject', () => {
  it('builds account customization and SuiteApp arguments', async () => {
    const runner = fakeRunner();
    const suitecloud = new SuiteCloud('/work', runner);

    await suitecloud.createProject({ name: 'demo', suiteApp: null });
    await suitecloud.createProject({
      name: 'app',
      suiteApp: { publisherId: 'com.acme', projectId: 'myapp', projectVersion: '1.0.0' },
      overwrite: true,
    });

    expect(runner.mock.calls.map(([, args]) => args)).toEqual([
      ['project:create', '--type', 'ACCOUNTCUSTOMIZATION', '--projectname', 'demo'],
      [
        'project:create',
        '--type',
        'SUITEAPP',
        '--projectname',
        'app',
        '--publisherid',
        'com.acme',
        '--projectid',
        'myapp',
        '--projectversion',
        '1.0.0',
        '--overwrite',
      ],
    ]);
  });
});
