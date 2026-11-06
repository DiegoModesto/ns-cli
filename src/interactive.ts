import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as clack from '@clack/prompts';
import { loadProject, type Project } from './core/config.js';
import { normalizeScriptId, planGenerate, SDF_OBJECT_TYPES } from './core/generate.js';
import { isInside, isUploadable, toFileCabinetPath } from './core/paths.js';
import { type AuthIdEntry, SuiteCloud } from './core/suitecloud.js';
import { isIgnored } from './core/watch.js';
import { NskError } from './errors.js';
import type { Messages } from './i18n.js';
import { type Choice, clackPrompter, type Prompter } from './prompter.js';
import { loadTemplates, type TemplateLanguage } from './templates.js';

export interface InteractiveDeps {
  prompt: Prompter;
  t: Messages;
  cwd: string;
  loadProject: (cwd: string) => Project;
  listAuthIds: (cwd: string) => Promise<AuthIdEntry[]>;
}

/** Commands in the order of the main help; each one asks its own questions. */
export const INTERACTIVE_COMMANDS = [
  'init',
  'doctor',
  'generate',
  'build',
  'templates',
  'upload',
  'watch',
  'validate',
  'deploy',
  'account',
] as const;

type CommandName = (typeof INTERACTIVE_COMMANDS)[number];

const ALIASES: Record<string, CommandName> = { g: 'generate' };

const NAME = /^[\w.-]+$/;

/**
 * Asks which command to run (unless `command` is given) and then its options, and returns the equivalent argv
 * (without "node nsk"). The commands themselves still do all the work and validation.
 */
export async function runInteractive(command: string | undefined, deps: InteractiveDeps): Promise<string[]> {
  const { prompt, t } = deps;
  let name = command && (ALIASES[command] ?? command);
  if (name && !(INTERACTIVE_COMMANDS as readonly string[]).includes(name)) {
    throw new NskError(`Unknown command "${command}".`, 'Run "nsk -i" to choose one from the menu.');
  }
  name ??= await prompt.select(
    t.interactive.chooseCommand,
    INTERACTIVE_COMMANDS.map((value) => ({ value, label: value, hint: t[value].description })),
  );
  return QUESTIONS[name as CommandName](deps);
}

/** "nsk deploy --asv WARNING" — quotes arguments with spaces so the line can be copied. */
export function formatCommand(args: string[]): string {
  return ['nsk', ...args].map((arg) => (/[\s"']/.test(arg) ? JSON.stringify(arg) : arg)).join(' ');
}

const QUESTIONS: Record<CommandName, (deps: InteractiveDeps) => Promise<string[]>> = {
  async init({ prompt, t, cwd }) {
    const i = t.interactive;
    const name = await prompt.text(i.projectName, { validate: (value) => validateName(value, t) });
    const args = ['init', name];
    const type = await prompt.select(i.projectType, [
      { value: 'acp', label: i.accountCustomization, hint: i.accountCustomizationHint },
      { value: 'suiteapp', label: i.suiteApp, hint: i.suiteAppHint },
    ]);

    let folder = name;
    if (type === 'suiteapp') {
      const publisherId = await prompt.text(i.publisherId, { validate: (value) => validateName(value, t) });
      const projectId = await prompt.text(i.projectId, { validate: (value) => validateName(value, t) });
      const version = await prompt.text(i.projectVersion, { defaultValue: '1.0.0' });
      args.push('--suiteapp', '--publisher-id', publisherId, '--project-id', projectId);
      if (version !== '1.0.0') args.push('--project-version', version);
      folder = `${publisherId}.${projectId}`;
    }

    const target = join(cwd, folder);
    if (existsSync(target) && readdirSync(target).length > 0 && (await prompt.confirm(i.overwriteFolder, false))) {
      args.push('--force');
    }
    if (!(await prompt.confirm(i.install, true))) args.push('--no-install');
    return args;
  },

  async doctor() {
    return ['doctor'];
  },

  async build() {
    return ['build'];
  },

  async templates({ prompt, t }) {
    const i = t.interactive;
    const action = await prompt.select(i.templatesAction, [
      { value: 'list', label: i.listTemplates },
      { value: 'show', label: i.showTemplate },
    ]);
    if (action === 'list') return ['templates', 'list'];

    const templates = loadTemplates();
    const id = await prompt.search(
      i.template,
      templates.map((template) => ({ value: template.id, label: template.id, hint: template.name })),
    );
    const languages = Object.keys(templates.find((template) => template.id === id)!.files) as TemplateLanguage[];
    if (languages.length < 2) return ['templates', 'show', id];
    const language = await prompt.select(i.language, languageChoices(languages), 'typescript');
    return ['templates', 'show', id, '--language', language];
  },

  async generate({ prompt, t, cwd, loadProject }) {
    const i = t.interactive;
    const project = loadProject(cwd);
    const templates = loadTemplates().filter((template) => template.kind !== 'sdf-object');
    const id = await prompt.search(
      i.template,
      templates.map((template) => ({ value: template.id, label: template.id, hint: template.scriptType ?? template.name })),
    );
    const template = templates.find((candidate) => candidate.id === id)!;
    const name = await prompt.text(i.scriptName, { validate: (value) => validateName(value, t) });
    const args = ['generate', id, name];

    const language = project.typescript
      ? await prompt.select<'typescript' | 'javascript'>(i.language, languageChoices(['typescript', 'javascript']), 'typescript')
      : 'javascript';
    if (project.typescript && language === 'javascript') args.push('--language', 'javascript');

    const dir = (await prompt.text(i.dir, { placeholder: 'App/_EntryPoints' })).trim();
    if (dir) args.push('--dir', dir);

    let object = false;
    let recordType: string | undefined;
    let scriptId: string | undefined;
    if (template.scriptType && SDF_OBJECT_TYPES[template.scriptType] && (await prompt.confirm(i.object, false))) {
      object = true;
      recordType = (await prompt.text(i.recordType, { validate: (value) => (value.trim() ? undefined : i.required) }))
        .trim()
        .toUpperCase();
      scriptId = await prompt.text(i.scriptId, { defaultValue: normalizeScriptId(name) });
      args.push('--object', '--record-type', recordType);
      if (scriptId !== normalizeScriptId(name)) args.push('--script-id', scriptId);
    }

    const files = planGenerate(template, name, { language, dir: dir || undefined, object, recordType, scriptId }, project);
    if (files.some((file) => existsSync(file.path)) && (await prompt.confirm(i.overwriteFiles, false))) {
      args.push('--force');
    }
    return args;
  },

  async upload({ prompt, t, cwd, loadProject }) {
    const i = t.interactive;
    const project = loadProject(cwd);
    const candidates = uploadCandidates(project).map((file) => relative(cwd, file));
    if (candidates.length === 0) throw new NskError(i.noFiles);

    const files = await prompt.searchMany(
      i.files,
      candidates.map((file) => ({ value: file, label: file })),
    );
    const args = ['upload'];
    if (files.some((file) => file.endsWith('.ts')) && !(await prompt.confirm(i.compile, true))) args.push('--no-compile');
    if (await prompt.confirm(i.dryRun, false)) args.push('--dry-run');
    return [...args, ...files];
  },

  async watch({ prompt, t, cwd, loadProject }) {
    const project = loadProject(cwd);
    if (project.typescript && !(await prompt.confirm(t.interactive.watchUpload, true))) return ['watch', '--no-upload'];
    return ['watch'];
  },

  async validate({ prompt, t, cwd, loadProject }) {
    const project = loadProject(cwd);
    const args = ['validate'];
    if (await prompt.confirm(t.interactive.server, false)) args.push('--server');
    args.push(...(await accountSpecificValues(project, prompt, t)), ...(await compile(project, prompt, t)));
    return args;
  },

  async deploy({ prompt, t, cwd, loadProject }) {
    const i = t.interactive;
    const project = loadProject(cwd);
    const mode = await prompt.select(
      i.deployMode,
      [
        { value: 'preview', label: i.deployPreview },
        { value: 'deploy', label: i.deployReal },
      ],
      'preview',
    );
    const args = ['deploy'];
    if (mode === 'preview') args.push('--dry-run');
    args.push(...(await accountSpecificValues(project, prompt, t)), ...(await compile(project, prompt, t)));
    return args;
  },

  async account({ prompt, t, cwd, loadProject, listAuthIds }) {
    const action = await prompt.select(t.interactive.accountAction, [
      { value: 'list', label: t.account.list },
      { value: 'use', label: t.account.use },
      { value: 'setup', label: t.account.setup },
    ]);
    if (action !== 'use') return ['account', action];

    const project = loadProject(cwd);
    const entries = await listAuthIds(project.root);
    if (entries.length === 0) throw new NskError(t.interactive.noAuthIds);
    const authId = await prompt.select(
      t.interactive.authId,
      entries.map((entry) => ({
        value: entry.id,
        label: entry.id,
        hint: entry.id === project.authId ? `${entry.description} (${t.interactive.current})` : entry.description,
      })),
      project.authId ?? undefined,
    );
    return ['account', 'use', authId];
  },
};

function validateName(value: string, t: Messages): string | undefined {
  if (!value.trim()) return t.interactive.required;
  return NAME.test(value) ? undefined : t.interactive.invalidName;
}

function languageChoices<T extends TemplateLanguage>(languages: T[]): Choice<T>[] {
  const labels: Record<TemplateLanguage, string> = { typescript: 'TypeScript', javascript: 'JavaScript', xml: 'XML' };
  return languages.map((language) => ({ value: language, label: labels[language] }));
}

/** --asv only exists for account customization projects. */
async function accountSpecificValues(project: Project, prompt: Prompter, t: Messages): Promise<string[]> {
  if (project.suiteApp) return [];
  const asv = await prompt.select(
    t.interactive.asv,
    [
      { value: '', label: t.interactive.asvDefault },
      { value: 'WARNING', label: t.interactive.asvWarning },
    ],
    '',
  );
  return asv ? ['--asv', asv] : [];
}

async function compile(project: Project, prompt: Prompter, t: Messages): Promise<string[]> {
  return project.typescript && !(await prompt.confirm(t.interactive.compile, true)) ? ['--no-compile'] : [];
}

/**
 * Files worth offering for upload: the .ts sources, plus FileCabinet files that are not compiler output (in a
 * TypeScript project those come from the sources) and that SuiteCloud can upload.
 */
export function uploadCandidates(project: Pick<Project, 'fileCabinetDir' | 'typescript'>): string[] {
  const sources = project.typescript
    ? listFiles(project.typescript.sourceDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    : [];
  const outDir = project.typescript?.outDir;
  const cabinet = listFiles(project.fileCabinetDir).filter((file) => {
    if (outDir && (file === outDir || isInside(outDir, file))) return false;
    const path = toFileCabinetPath(file, project);
    return isUploadable(path) && !isIgnored(path);
  });
  return [...sources, ...cabinet].sort();
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Removes -i / --interactive from argv and tells whether it was there. */
export function takeInteractiveFlag(argv: string[]): { interactive: boolean; argv: string[] } {
  const rest = argv.filter((arg) => arg !== '-i' && arg !== '--interactive');
  return { interactive: rest.length !== argv.length, argv: rest };
}

/**
 * Terminal session: asks the questions, shows the equivalent command and asks whether to run it. Returns the
 * arguments to run, or null when the user chose not to.
 */
export async function startInteractive(command: string | undefined, t: Messages): Promise<string[] | null> {
  clack.updateSettings({ messages: { cancel: t.interactive.cancelled } });
  clack.intro(t.interactive.intro);
  const args = await runInteractive(command, {
    prompt: clackPrompter,
    t,
    cwd: process.cwd(),
    loadProject,
    listAuthIds: (root) => new SuiteCloud(root).listAuthIds(),
  });
  clack.note(formatCommand(args), t.interactive.equivalent);
  if (!(await clackPrompter.confirm(t.interactive.run, true))) {
    clack.outro(t.interactive.cancelled);
    return null;
  }
  clack.outro(formatCommand(args));
  return args;
}
