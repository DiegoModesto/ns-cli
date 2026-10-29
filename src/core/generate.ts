import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NskError } from '../errors.js';
import { findTemplate, readTemplate, renderTemplate, type Template } from '../templates.js';
import type { Project } from './config.js';
import { isInside, type PathApi, resolveUploadTarget } from './paths.js';

export interface GenerateOptions {
  language: 'typescript' | 'javascript';
  /** Subfolder below the scripts folder, e.g. "App/_EntryPoints". */
  dir?: string;
  /** Also generate the SDF script object (XML) with its deployment. */
  object: boolean;
  scriptId?: string;
  recordType?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

type GenerateProject = Pick<Project, 'fileCabinetDir' | 'typescript' | 'projectFolder' | 'suiteApp'>;

/**
 * SDF root element per @NScriptType. Only the types whose object the bundled XML template describes correctly
 * (a deployment with <recordtype>); the others need their own template.
 */
export const SDF_OBJECT_TYPES: Record<string, string> = {
  ClientScript: 'clientscript',
  UserEventScript: 'usereventscript',
};

/** "UE Sales-Order" → "ue_sales_order": the part after customscript_ / customdeploy_. */
export function normalizeScriptId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/** Works out the files `nsk generate` writes; nothing touches the disk except reading the templates. */
export function planGenerate(
  template: Template,
  name: string,
  options: GenerateOptions,
  project: GenerateProject,
  p: PathApi = path,
): GeneratedFile[] {
  if (template.kind === 'sdf-object') {
    throw new NskError(`"${template.id}" is generated together with a script.`, 'Use --object when generating a script.');
  }
  if (!/^[\w.-]+$/.test(name)) {
    throw new NskError(`Invalid name "${name}".`, 'Use letters, digits, "_", "-" or "."; put folders in --dir.');
  }

  const extension = options.language === 'typescript' ? '.ts' : '.js';
  const baseName = name.endsWith(extension) ? name.slice(0, -extension.length) : name;
  const scriptsDir = scriptsFolder(options.language, project, p);
  const file = p.join(scriptsDir, options.dir ?? '', baseName + extension);
  if (!isInside(scriptsDir, file, p)) {
    throw new NskError(`--dir "${options.dir}" points outside ${scriptsDir}.`);
  }

  const files: GeneratedFile[] = [{ path: file, content: readTemplate(template, options.language) }];
  if (options.object) {
    files.push(planObject(template, baseName, file, options, project, p));
  }
  return files;
}

function scriptsFolder(language: GenerateOptions['language'], project: GenerateProject, p: PathApi): string {
  if (language === 'typescript') {
    if (!project.typescript) {
      throw new NskError('This project has no tsconfig.', 'Use --language javascript, or add a tsconfig.json.');
    }
    return project.typescript.sourceDir;
  }
  return project.suiteApp
    ? p.join(project.fileCabinetDir, 'SuiteApps', `${project.suiteApp.publisherId}.${project.suiteApp.projectId}`)
    : p.join(project.fileCabinetDir, 'SuiteScripts');
}

function planObject(
  template: Template,
  name: string,
  scriptFile: string,
  options: GenerateOptions,
  project: GenerateProject,
  p: PathApi,
): GeneratedFile {
  const scriptType = template.scriptType && SDF_OBJECT_TYPES[template.scriptType];
  if (!scriptType) {
    throw new NskError(
      `--object is not supported for ${template.name} yet.`,
      'Supported: Client Script and User Event Script. Generate the script without --object.',
    );
  }
  if (!options.recordType) {
    throw new NskError('--object needs the record the script is deployed to.', 'Pass --record-type, e.g. SALESORDER.');
  }
  const scriptId = options.scriptId ?? normalizeScriptId(name);
  if (!/^[a-z0-9_]+$/.test(scriptId)) {
    throw new NskError(`Invalid script id "${scriptId}".`, 'Use lowercase letters, digits and "_" (without customscript_).');
  }

  const objectTemplate = findTemplate('script-object');
  if (!objectTemplate) throw new Error('templates/manifest.json has no "script-object" template.');
  const xml = readTemplate(objectTemplate, 'xml');
  return {
    path: p.join(project.projectFolder, 'Objects', `customscript_${scriptId}.xml`),
    content: renderTemplate(xml, {
      scriptType,
      scriptId,
      description: '',
      name,
      scriptFile: resolveUploadTarget(scriptFile, project, p).fileCabinetPath,
      logLevel: 'DEBUG',
      recordType: options.recordType.toUpperCase(),
      status: 'TESTING',
    }),
  };
}

/** Writes the files, refusing to overwrite any of them unless `force`. */
export function writeGenerated(files: GeneratedFile[], force: boolean): void {
  const existing = files.filter((file) => existsSync(file.path));
  if (existing.length > 0 && !force) {
    throw new NskError(
      `Already exists:\n${existing.map((file) => `  - ${file.path}`).join('\n')}`,
      'Pick another name or pass --force to overwrite.',
    );
  }
  for (const file of files) {
    mkdirSync(path.dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
  }
}
