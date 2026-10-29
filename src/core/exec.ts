import { execa } from 'execa';

export interface ExecOptions {
  cwd: string;
  /** `inherit` streams output to the terminal; `pipe` captures it. */
  stdio: 'inherit' | 'pipe';
}

export interface ExecResult {
  /** `undefined` when the command could not be started (e.g. not installed). */
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
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
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
};
