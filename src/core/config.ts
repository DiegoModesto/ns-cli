import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { NskError } from '../errors.js';
import { parseJsonc } from './jsonc.js';

export const CONFIG_FILE = 'ns.config.json';
const SUITECLOUD_CONFIG_FILE = 'suitecloud.config.js';

const configSchema = z
  .object({
    $schema: z.string().optional(),
    /** tsconfig used to compile the project, relative to the project root. */
    tsconfig: z.string().default('tsconfig.json'),
    /** Overrides compilerOptions.rootDir from the tsconfig. */
    sourceDir: z.string().optional(),
    /** Overrides compilerOptions.outDir from the tsconfig. */
    outDir: z.string().optional(),
  })
  .strict();

export type NskConfig = z.infer<typeof configSchema>;

export interface TypeScriptSettings {
  tsconfig: string;
  /** Folder with the .ts sources (compilerOptions.rootDir). */
  sourceDir: string;
  /** Folder that receives the compiled .js (compilerOptions.outDir), inside the FileCabinet. */
  outDir: string;
}

export interface Project {
  root: string;
  /** Absolute path of ns.config.json, or null when running with defaults. */
  configFile: string | null;
  config: NskConfig;
  /** SDF project folder (suitecloud.config.js → defaultProjectFolder). */
  projectFolder: string;
  fileCabinetDir: string;
  /** null for JavaScript-only projects (no tsconfig). */
  typescript: TypeScriptSettings | null;
  /** Default auth ID from project.json, set by `suitecloud account:setup`. */
  authId: string | null;
}

/** Walks up from `cwd` to the folder holding ns.config.json or suitecloud.config.js. */
export function findProjectRoot(cwd: string): string {
  let dir = resolve(cwd);
  while (true) {
    if (existsSync(join(dir, CONFIG_FILE)) || existsSync(join(dir, SUITECLOUD_CONFIG_FILE))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new NskError(
        'No SuiteCloud project found in this folder or its parents.',
        `Run nsk inside a project with ${SUITECLOUD_CONFIG_FILE} or ${CONFIG_FILE}.`,
      );
    }
    dir = parent;
  }
}

export function loadProject(cwd: string = process.cwd()): Project {
  const root = findProjectRoot(cwd);
  const { config, configFile } = readNskConfig(root);
  const projectFolder = join(root, readProjectFolder(root));
  const fileCabinetDir = join(projectFolder, 'FileCabinet');

  return {
    root,
    configFile,
    config,
    projectFolder,
    fileCabinetDir,
    typescript: readTypeScriptSettings(root, config),
    authId: readAuthId(root),
  };
}

function readNskConfig(root: string): { config: NskConfig; configFile: string | null } {
  const configFile = join(root, CONFIG_FILE);
  if (!existsSync(configFile)) {
    return { config: configSchema.parse({}), configFile: null };
  }

  let raw: unknown;
  try {
    raw = parseJsonc(readFileSync(configFile, 'utf8'));
  } catch (error) {
    throw new NskError(`${CONFIG_FILE} is not valid JSON: ${(error as Error).message}`);
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new NskError(`Invalid ${CONFIG_FILE}:\n${issues.join('\n')}`);
  }
  return { config: result.data, configFile };
}

function readProjectFolder(root: string): string {
  const file = join(root, SUITECLOUD_CONFIG_FILE);
  if (!existsSync(file)) return 'src';

  const suitecloudConfig = createRequire(file)(file) as { defaultProjectFolder?: unknown };
  return typeof suitecloudConfig.defaultProjectFolder === 'string' ? suitecloudConfig.defaultProjectFolder : 'src';
}

function readAuthId(root: string): string | null {
  const file = join(root, 'project.json');
  if (!existsSync(file)) return null;

  const { defaultAuthId } = parseJsonc<{ defaultAuthId?: unknown }>(readFileSync(file, 'utf8'));
  return typeof defaultAuthId === 'string' && defaultAuthId ? defaultAuthId : null;
}

function readTypeScriptSettings(root: string, config: NskConfig): TypeScriptSettings | null {
  const tsconfig = join(root, config.tsconfig);
  if (!existsSync(tsconfig)) {
    if (config.sourceDir || config.outDir) {
      throw new NskError(`${config.tsconfig} not found, but ${CONFIG_FILE} sets sourceDir/outDir.`);
    }
    return null;
  }

  const options = readCompilerDirs(tsconfig);
  const sourceDir = config.sourceDir ? join(root, config.sourceDir) : options.rootDir;
  const outDir = config.outDir ? join(root, config.outDir) : options.outDir;

  if (!sourceDir || !outDir) {
    const missing = !sourceDir ? 'rootDir' : 'outDir';
    throw new NskError(
      `${config.tsconfig} does not define compilerOptions.${missing}.`,
      `Set it in ${config.tsconfig} (e.g. "rootDir": "src/Source", "outDir": "src/FileCabinet/SuiteScripts") or set ${missing === 'rootDir' ? 'sourceDir' : 'outDir'} in ${CONFIG_FILE}.`,
    );
  }
  return { tsconfig, sourceDir, outDir };
}

interface CompilerDirs {
  rootDir?: string;
  outDir?: string;
}

/** Reads rootDir/outDir following relative `extends`; paths resolve against the tsconfig that declares them. */
function readCompilerDirs(tsconfig: string, seen = new Set<string>()): CompilerDirs {
  if (seen.has(tsconfig)) {
    throw new NskError(`Circular "extends" in ${tsconfig}.`);
  }
  seen.add(tsconfig);

  let json: { extends?: string | string[]; compilerOptions?: { rootDir?: string; outDir?: string } };
  try {
    json = parseJsonc(readFileSync(tsconfig, 'utf8'));
  } catch (error) {
    throw new NskError(`Could not read ${tsconfig}: ${(error as Error).message}`);
  }

  const dir = dirname(tsconfig);
  const own: CompilerDirs = {
    rootDir: json.compilerOptions?.rootDir && resolve(dir, json.compilerOptions.rootDir),
    outDir: json.compilerOptions?.outDir && resolve(dir, json.compilerOptions.outDir),
  };

  // Later entries in `extends` win; package-based extends (no leading ".") are skipped.
  const parents = [json.extends ?? []].flat().filter((entry) => entry.startsWith('.'));
  const inherited = parents.reduce<CompilerDirs>((acc, entry) => {
    const file = resolve(dir, entry.endsWith('.json') ? entry : `${entry}.json`);
    const parent = existsSync(file) ? readCompilerDirs(file, seen) : {};
    return { rootDir: parent.rootDir ?? acc.rootDir, outDir: parent.outDir ?? acc.outDir };
  }, {});

  return { rootDir: own.rootDir ?? inherited.rootDir, outDir: own.outDir ?? inherited.outDir };
}
