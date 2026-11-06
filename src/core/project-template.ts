import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NskError } from '../errors.js';
import { projectTemplatesDir, renderTemplate } from '../templates.js';
import { execaRunner, notStarted, type Runner } from './exec.js';
import type { GeneratedFile } from './generate.js';
import type { ProjectLanguage } from './scaffold.js';

export interface ProjectTemplateInfo {
  id: string;
  description: string;
}

/** Where a project template comes from: bundled with nsk, a local folder, or a git repository. */
export type ProjectTemplateSource =
  | { kind: 'builtin'; id: string; dir: string }
  | { kind: 'path'; dir: string }
  | { kind: 'git'; url: string; ref?: string };

/** A template file, relative to the template root with "/" separators. */
export interface TemplateFile {
  path: string;
  content: Buffer;
}

export const DEFAULT_PROJECT_TEMPLATE = 'standard';

/** Never copied: git metadata and installed packages of a template checked out locally. */
const SKIPPED_FOLDERS = new Set(['.git', 'node_modules']);

/** Template metadata, not copied into the project. */
const TEMPLATE_INFO = 'template.json';

/** npm drops .gitignore from published packages, so the bundled templates ship it as _gitignore. */
const GITIGNORE_NAMES = new Set(['.gitignore', '_gitignore']);

/** Built-in project templates: each folder of project-templates/<language>/ with its template.json description. */
export function listProjectTemplates(
  language: ProjectLanguage = 'typescript',
  root: string = projectTemplatesDir,
): ProjectTemplateInfo[] {
  const dir = path.join(root, language);
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ id: entry.name, description: readDescription(path.join(dir, entry.name)) }))
    .sort((a, b) => (a.id === DEFAULT_PROJECT_TEMPLATE ? -1 : b.id === DEFAULT_PROJECT_TEMPLATE ? 1 : 0));
}

/**
 * "standard" (built-in), "github:acme/ns-template#v2", "https://…/x.git", "git@host:x.git" or a folder path.
 * Built-in ids win over a folder with the same name; use "./standard" for the folder.
 */
export function parseTemplateSpec(
  spec: string,
  cwd: string,
  language: ProjectLanguage = 'typescript',
  builtins: string[] = listProjectTemplates(language).map((template) => template.id),
  p: typeof path = path,
): ProjectTemplateSource {
  if (builtins.includes(spec)) {
    return { kind: 'builtin', id: spec, dir: p.join(projectTemplatesDir, language, spec) };
  }

  const [location = '', ref] = spec.split('#', 2);
  const github = location.match(/^github:([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (github) return { kind: 'git', url: `https://github.com/${github[1]}.git`, ...(ref ? { ref } : {}) };
  if (/^(https?|ssh|git|file):\/\//.test(location) || /^[\w.-]+@[\w.-]+:/.test(location)) {
    return { kind: 'git', url: location, ...(ref ? { ref } : {}) };
  }
  return { kind: 'path', dir: p.resolve(cwd, spec) };
}

/**
 * Reads a template's files. Git templates are cloned (shallow) into a temporary folder that is removed afterwards.
 */
export async function loadProjectTemplate(
  source: ProjectTemplateSource,
  runner: Runner = execaRunner,
): Promise<TemplateFile[]> {
  if (source.kind !== 'git') {
    if (!existsSync(source.dir) || !statSync(source.dir).isDirectory()) {
      const builtins = listProjectTemplates().map((template) => template.id).join(', ');
      throw new NskError(
        `Template not found: ${source.dir}`,
        `Use a built-in template (${builtins}), a folder, or a git repository such as github:user/repo.`,
      );
    }
    return readTemplateFiles(source.dir);
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'nsk-template-'));
  try {
    const branch = source.ref ? ['--branch', source.ref] : [];
    const result = await runner('git', ['clone', '--depth', '1', '--quiet', ...branch, source.url, dir], {
      cwd: tmpdir(),
      stdio: 'pipe',
    });
    if (notStarted(result)) {
      throw new NskError('git not found.', 'Install git, or download the template and pass its folder.');
    }
    if (result.exitCode !== 0) {
      throw new NskError(
        `Could not clone ${source.url}${source.ref ? ` (${source.ref})` : ''}.`,
        result.stderr.trim() || 'Check the URL, the branch/tag and your access to the repository.',
      );
    }
    return readTemplateFiles(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Every file below `dir`, except .git, node_modules and template.json. */
export function readTemplateFiles(dir: string): TemplateFile[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .filter((file) => file !== TEMPLATE_INFO && !file.split('/').some((part) => SKIPPED_FOLDERS.has(part)))
    .sort()
    .map((file) => ({ path: file, content: readFileSync(path.join(dir, file)) }));
}

export interface AppliedTemplate {
  files: GeneratedFile[];
  /** Lines to add to the project's .gitignore (the one `suitecloud project:create` wrote). */
  gitignore: string[];
}

/**
 * Lays the template over the files nsk generates for every project: package.json is merged (scripts and
 * dependencies are added or replaced), .gitignore lines are appended, other files replace the generated ones.
 * {{token}} markers are filled in text files and in file paths (e.g. a "{{outDir}}" folder).
 */
export function applyProjectTemplate(
  base: GeneratedFile[],
  template: TemplateFile[],
  root: string,
  tokens: Record<string, string>,
  p: typeof path = path,
): AppliedTemplate {
  const files = new Map(base.map((file) => [file.path, file]));
  const gitignore: string[] = [];
  for (const file of template) {
    const target = p.join(root, ...renderTemplate(file.path, tokens).split('/'));
    const content = isText(file.content) ? renderTemplate(file.content.toString('utf8'), tokens) : file.content;
    if (GITIGNORE_NAMES.has(file.path)) {
      const lines = String(content).split(/\r?\n/).map((line) => line.trim());
      gitignore.push(...lines.filter((line) => line && !line.startsWith('#')));
    } else if (file.path === 'package.json' && files.has(target)) {
      const merged = mergePackageJson(String(files.get(target)!.content), String(content));
      files.set(target, { path: target, content: merged });
    } else {
      files.set(target, { path: target, content });
    }
  }
  return { files: [...files.values()], gitignore };
}

/** Adds the template's package.json to the generated one; nested objects (scripts, devDependencies…) are merged. */
export function mergePackageJson(base: string, extra: string): string {
  const merged: Record<string, unknown> = JSON.parse(base);
  let overlay: Record<string, unknown>;
  try {
    overlay = JSON.parse(extra);
  } catch (error) {
    throw new NskError(`The template's package.json is not valid JSON: ${(error as Error).message}`);
  }
  for (const [key, value] of Object.entries(overlay)) {
    const current = merged[key];
    merged[key] = isRecord(current) && isRecord(value) ? { ...current, ...value } : value;
  }
  return JSON.stringify(merged, null, 2) + '\n';
}

function readDescription(dir: string): string {
  try {
    const info: unknown = JSON.parse(readFileSync(path.join(dir, TEMPLATE_INFO), 'utf8'));
    return isRecord(info) && typeof info.description === 'string' ? info.description : '';
  } catch {
    return '';
  }
}

/** Files with a NUL byte are treated as binary and copied as they are. */
function isText(content: Buffer): boolean {
  return !content.includes(0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
