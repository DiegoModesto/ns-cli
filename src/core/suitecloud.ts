import { NskError } from '../errors.js';
import { execaRunner, type ExecResult, notStarted, type Runner } from './exec.js';

const NOT_INSTALLED_HINT = 'Install it with "npm install -g @oracle/suitecloud-cli".';

export type AccountSpecificValues = 'ERROR' | 'WARNING';

export interface CreateProjectOptions {
  name: string;
  /** null for an account customization project. */
  suiteApp: { publisherId: string; projectId: string; projectVersion: string } | null;
  overwrite?: boolean;
}

/** Thin wrapper over the official `suitecloud` CLI; every call to it goes through here. */
export class SuiteCloud {
  constructor(
    private readonly cwd: string,
    private readonly runner: Runner = execaRunner,
  ) {}

  /** Installed version, or null when the CLI is not available. */
  async version(): Promise<string | null> {
    const result = await this.runner('suitecloud', ['--version'], { cwd: this.cwd, stdio: 'pipe' });
    if (result.exitCode !== 0) return null;
    return result.stdout.match(/\d+\.\d+\.\d+\S*/)?.[0] ?? (result.stdout.trim() || null);
  }

  /** Runs a suitecloud command, streaming its output; throws NskError when it fails. */
  async run(args: string[]): Promise<void> {
    await this.exec(args, 'inherit');
  }

  /** Runs a suitecloud command and returns its output. */
  async capture(args: string[]): Promise<string> {
    return (await this.exec(args, 'pipe')).stdout;
  }

  upload(fileCabinetPaths: string[]): Promise<void> {
    if (fileCabinetPaths.length === 0) {
      throw new NskError('No files to upload.');
    }
    return this.run(['file:upload', '--paths', ...fileCabinetPaths]);
  }

  validate(options: { server?: boolean; accountSpecificValues?: AccountSpecificValues } = {}): Promise<void> {
    return this.run([
      'project:validate',
      ...(options.server ? ['--server'] : []),
      ...accountSpecificValuesArgs(options.accountSpecificValues),
    ]);
  }

  deploy(options: { dryRun?: boolean; accountSpecificValues?: AccountSpecificValues } = {}): Promise<void> {
    return this.run([
      'project:deploy',
      ...(options.dryRun ? ['--dryrun'] : []),
      ...accountSpecificValuesArgs(options.accountSpecificValues),
    ]);
  }

  /** Creates the project in a new folder under cwd (named after the project, or <publisherid>.<projectid>). */
  createProject(options: CreateProjectOptions): Promise<void> {
    const suiteApp = options.suiteApp
      ? [
          '--publisherid',
          options.suiteApp.publisherId,
          '--projectid',
          options.suiteApp.projectId,
          '--projectversion',
          options.suiteApp.projectVersion,
        ]
      : [];
    return this.run([
      'project:create',
      '--type',
      options.suiteApp ? 'SUITEAPP' : 'ACCOUNTCUSTOMIZATION',
      '--projectname',
      options.name,
      ...suiteApp,
      ...(options.overwrite ? ['--overwrite'] : []),
    ]);
  }

  setupAccount(): Promise<void> {
    return this.run(['account:setup']);
  }

  listAuthIds(): Promise<string> {
    return this.capture(['account:manageauth', '--list']);
  }

  private async exec(args: string[], stdio: 'inherit' | 'pipe'): Promise<ExecResult> {
    const result = await this.runner('suitecloud', args, { cwd: this.cwd, stdio });
    if (notStarted(result)) {
      throw new NskError('SuiteCloud CLI not found.', NOT_INSTALLED_HINT);
    }
    if (result.signal) {
      throw new NskError(`suitecloud ${args[0]} was interrupted (${result.signal}).`);
    }
    if (result.exitCode !== 0) {
      const details = stdio === 'pipe' ? `\n${(result.stderr || result.stdout).trim()}` : '';
      throw new NskError(`suitecloud ${args[0]} failed with exit code ${result.exitCode}.${details}`);
    }
    return result;
  }
}

function accountSpecificValuesArgs(value: AccountSpecificValues | undefined): string[] {
  return value ? ['--accountspecificvalues', value] : [];
}
