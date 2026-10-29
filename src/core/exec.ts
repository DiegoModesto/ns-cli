import { createInterface } from 'node:readline';
import { execa } from 'execa';

export interface ExecOptions {
  cwd: string;
  /** `inherit` streams output to the terminal; `pipe` captures it. */
  stdio: 'inherit' | 'pipe';
}

export interface ExecResult {
  /** `undefined` when the command could not be started (e.g. not installed) or was killed by `signal`. */
  exitCode: number | undefined;
  /** Signal that terminated the process (e.g. `SIGINT` on Ctrl+C); absent when it exited on its own. */
  signal?: string;
  stdout: string;
  stderr: string;
}

/** True when the command never ran, as opposed to running and failing or being interrupted. */
export function notStarted(result: ExecResult): boolean {
  return result.exitCode === undefined && !result.signal;
}

export type Runner = (command: string, args: string[], options: ExecOptions) => Promise<ExecResult>;

/** Default runner: resolves binaries from the project's node_modules/.bin first, then PATH. */
export const execaRunner: Runner = async (command, args, { cwd, stdio }) => {
  const result = await execa(command, args, {
    cwd,
    stdio,
    reject: false,
    preferLocal: true,
    localDir: cwd,
  });
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
};

/** A process that runs until stopped, like `tsc --watch`. */
export interface LongRunning {
  /** Resolves when the process exits, whatever the reason. */
  exited: Promise<ExecResult>;
  /** Terminates the process and waits for it to exit. */
  stop(): Promise<void>;
}

/** Starts a long-running process, handing each output line (stdout and stderr) to `onLine`. */
export type Spawner = (
  command: string,
  args: string[],
  options: { cwd: string; onLine: (line: string) => void },
) => LongRunning;

export const execaSpawner: Spawner = (command, args, { cwd, onLine }) => {
  const subprocess = execa(command, args, {
    cwd,
    stdin: 'ignore',
    all: true,
    buffer: false,
    reject: false,
    preferLocal: true,
    localDir: cwd,
  });
  if (subprocess.all) {
    createInterface({ input: subprocess.all }).on('line', onLine);
  }
  const exited = subprocess.then(
    (result): ExecResult => ({ exitCode: result.exitCode, signal: result.signal, stdout: '', stderr: '' }),
  );
  return {
    exited,
    async stop() {
      subprocess.kill();
      await exited;
    },
  };
};
