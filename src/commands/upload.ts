import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Command } from 'commander';
import { loadProject, type Project } from '../core/config.js';
import { askInTerminal, type Confirm, guardProtectedAccount } from '../core/guard.js';
import { resolveUploadTarget, type UploadTarget } from '../core/paths.js';
import { SuiteCloud } from '../core/suitecloud.js';
import { compileProject } from '../core/tsc.js';
import { NskError } from '../errors.js';
import { formatExamples, type Messages } from '../i18n.js';

export interface UploadOptions {
  dryRun: boolean;
  compile: boolean;
  yes?: boolean;
}

export interface UploadDeps {
  cwd: string;
  suitecloud: Pick<SuiteCloud, 'upload'>;
  compile: (project: Project) => Promise<void>;
  exists: (file: string) => boolean;
  confirm: Confirm;
}

export function registerUpload(program: Command, t: Messages): void {
  program
    .command('upload')
    .description(t.upload.description)
    .argument('[files...]', t.upload.files)
    .option('--dry-run', t.upload.dryRun, false)
    .option('--no-compile', t.upload.noCompile)
    .option('-y, --yes', t.upload.yes, false)
    .addHelpText('after', formatExamples(t.help.examples, t.upload.examples))
    .action(async (files: string[], options: UploadOptions) => {
      const cwd = process.cwd();
      const project = loadProject(cwd);
      const targets = await runUpload(files, project, options, {
        cwd,
        suitecloud: new SuiteCloud(project.root),
        compile: compileProject,
        exists: existsSync,
        confirm: askInTerminal,
      });
      if (options.dryRun) {
        for (const target of targets) {
          console.log(`${relative(cwd, target.source)} → ${target.fileCabinetPath}`);
        }
      }
    });
}

/** Resolves, compiles (once) and uploads (in one suitecloud call) the given files; returns what was uploaded. */
export async function runUpload(
  files: string[],
  project: Project,
  options: UploadOptions,
  deps: UploadDeps,
): Promise<UploadTarget[]> {
  if (files.length === 0) {
    throw new NskError('No files to upload.', 'Pass one or more .ts/.js files.');
  }

  const byPath = new Map<string, UploadTarget>();
  for (const file of files) {
    const target = resolveUploadTarget(resolve(deps.cwd, file), project);
    if (!byPath.has(target.fileCabinetPath)) byPath.set(target.fileCabinetPath, target);
  }
  const targets = [...byPath.values()];
  if (options.dryRun) return targets;
  const count = targets.length === 1 ? '1 file' : `${targets.length} files`;
  await guardProtectedAccount(project, `Upload ${count} to it`, options.yes ?? false, deps.confirm);

  if (options.compile && targets.some((target) => target.needsCompile)) {
    await deps.compile(project);
  }

  const missing = targets.filter((target) => !deps.exists(target.compiled));
  if (missing.length > 0) {
    throw new NskError(
      `Compiled file not found:\n${missing.map((target) => `  - ${relative(deps.cwd, target.compiled)}`).join('\n')}`,
      options.compile
        ? 'Check rootDir/outDir in the tsconfig (run "nsk doctor").'
        : 'Compile the project first or drop --no-compile.',
    );
  }

  await deps.suitecloud.upload(targets.map((target) => target.fileCabinetPath));
  return targets;
}
