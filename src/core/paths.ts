import path from 'node:path';
import { NskError } from '../errors.js';
import type { Project } from './config.js';

/** `path` or `path.win32`/`path.posix`; injectable so Windows paths can be tested on any OS. */
export type PathApi = Pick<typeof path, 'resolve' | 'relative' | 'join' | 'isAbsolute' | 'sep' | 'extname'>;

export interface UploadTarget {
  /** File the user pointed at (.ts or .js). */
  source: string;
  /** File that is actually uploaded. */
  compiled: string;
  /** Path as SuiteCloud expects it, e.g. /SuiteScripts/MyProject/ue_sales_order.js */
  fileCabinetPath: string;
  /** Whether the project must be compiled before uploading. */
  needsCompile: boolean;
}

export function isInside(parent: string, child: string, p: PathApi = path): boolean {
  const relative = p.relative(parent, child);
  // Compare against `..` + sep, not a bare `..` prefix: a folder named `..x` is still inside.
  const escapes = relative === '..' || relative.startsWith('..' + p.sep);
  return relative !== '' && !escapes && !p.isAbsolute(relative);
}

/** Converts a file inside the FileCabinet folder to its File Cabinet path ("/SuiteScripts/..."). */
export function toFileCabinetPath(file: string, project: Pick<Project, 'fileCabinetDir'>, p: PathApi = path): string {
  const absolute = p.resolve(file);
  if (!isInside(project.fileCabinetDir, absolute, p)) {
    throw new NskError(`${file} is not inside the FileCabinet folder (${project.fileCabinetDir}).`);
  }
  return '/' + p.relative(project.fileCabinetDir, absolute).split(p.sep).join('/');
}

/** Maps a .ts source or a .js file to what must be uploaded and where. */
export function resolveUploadTarget(
  file: string,
  project: Pick<Project, 'fileCabinetDir' | 'typescript'>,
  p: PathApi = path,
): UploadTarget {
  const source = p.resolve(file);
  const extension = p.extname(source);

  if (extension === '.ts' && !source.endsWith('.d.ts')) {
    const ts = project.typescript;
    if (!ts) {
      throw new NskError(`${file} is a TypeScript file, but the project has no tsconfig.`);
    }
    if (!isInside(ts.sourceDir, source, p)) {
      throw new NskError(`${file} is outside the TypeScript source folder (${ts.sourceDir}).`);
    }
    const relative = p.relative(ts.sourceDir, source);
    const compiled = p.join(ts.outDir, relative.slice(0, -'.ts'.length) + '.js');
    if (!isInside(project.fileCabinetDir, compiled, p)) {
      throw new NskError(
        `The tsconfig outDir (${ts.outDir}) is outside the FileCabinet folder (${project.fileCabinetDir}).`,
        'Point compilerOptions.outDir to a folder inside FileCabinet, e.g. src/FileCabinet/SuiteScripts.',
      );
    }
    return { source, compiled, fileCabinetPath: toFileCabinetPath(compiled, project, p), needsCompile: true };
  }

  if (isInside(project.fileCabinetDir, source, p)) {
    return { source, compiled: source, fileCabinetPath: toFileCabinetPath(source, project, p), needsCompile: false };
  }

  throw new NskError(`${file} is not a TypeScript source nor a file inside the FileCabinet folder.`);
}
