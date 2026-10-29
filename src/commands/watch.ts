import { watch, type FSWatcher } from 'node:fs';
import { join, relative } from 'node:path';
import type { Command } from 'commander';
import { loadProject } from '../core/config.js';
import { notStarted, type LongRunning } from '../core/exec.js';
import { isUploadable, toFileCabinetPath } from '../core/paths.js';
import { SuiteCloud } from '../core/suitecloud.js';
import { watchProject } from '../core/tsc.js';
import { isIgnored, UploadQueue } from '../core/watch.js';
import { NskError } from '../errors.js';

export function registerWatch(program: Command): void {
  program
    .command('watch')
    .description('Compile on save (tsc --watch) and upload every changed file in the FileCabinet')
    .option('--no-upload', 'only compile, do not upload')
    .action(async (options: { upload: boolean }) => {
      const project = loadProject(process.cwd());
      if (!project.typescript && !options.upload) {
        throw new NskError('Nothing to watch: the project has no tsconfig and --no-upload was given.');
      }

      const log = (message: string) => console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
      const suitecloud = new SuiteCloud(project.root);
      const queue = options.upload
        ? new UploadQueue({
            upload: (paths) => suitecloud.upload(paths),
            toFileCabinetPath(file) {
              if (file === project.fileCabinetDir) return null;
              const path = toFileCabinetPath(file, project);
              if (isIgnored(path)) return null;
              if (!isUploadable(path)) {
                log(`Skipping ${path}: SuiteCloud cannot upload files outside its File Cabinet folders.`);
                return null;
              }
              return path;
            },
            log,
            waitForFirstBuild: project.typescript !== null,
          })
        : null;

      let watcher: FSWatcher | undefined;
      if (queue) {
        watcher = watch(project.fileCabinetDir, { recursive: true }, (_event, filename) => {
          if (filename) queue.fileChanged(join(project.fileCabinetDir, filename));
        });
      }

      let tsc: LongRunning | undefined;
      if (project.typescript) {
        tsc = watchProject(project, {
          onOutput: (line) => console.log(line),
          onEvent: (event) => (event.type === 'started' ? queue?.buildStarted() : queue?.buildFinished(event.errors)),
        });
      }

      const target = relative(process.cwd(), project.fileCabinetDir) || '.';
      log(queue ? `Watching ${target} (Ctrl+C to stop)` : 'Compiling on save, uploads disabled (Ctrl+C to stop)');

      let stopping = false;
      try {
        await new Promise<void>((resolve, reject) => {
          const stop = () => {
            stopping = true;
            resolve();
          };
          process.once('SIGINT', stop);
          process.once('SIGTERM', stop);
          void tsc?.exited.then((result) => {
            if (stopping || result.signal) return resolve(); // Ctrl+C also reaches tsc directly
            if (notStarted(result)) {
              return reject(
                new NskError('TypeScript compiler (tsc) not found.', 'Install it in the project with "npm install -D typescript".'),
              );
            }
            reject(new NskError(`tsc --watch exited unexpectedly (exit code ${result.exitCode}).`));
          });
        });
      } finally {
        stopping = true;
        watcher?.close();
        queue?.stop();
        await tsc?.stop();
      }
    });
}
