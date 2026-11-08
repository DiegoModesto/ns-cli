import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadProject } from '../src/core/config.js';
import { NskError } from '../src/errors.js';
import { messagesFor } from '../src/i18n.js';
import {
  formatCommand,
  type InteractiveDeps,
  runInteractive,
  takeInteractiveFlag,
  uploadCandidates,
} from '../src/interactive.js';
import type { Choice, Prompter, TextOptions } from '../src/prompter.js';

const t = messagesFor('en');
let root: string;

function write(file: string, content = '') {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

interface Asked {
  kind: string;
  message: string;
  choices?: unknown[];
}

/** Answers questions in order; `undefined` for a text question means "accept the default". */
function fakePrompter(answers: unknown[]) {
  const asked: Asked[] = [];
  const next = () => {
    if (answers.length === 0) throw new Error(`No answer left for: ${asked.at(-1)?.message}`);
    return answers.shift();
  };
  const pick = (kind: string) => async (message: string, choices: Choice<unknown>[]) => {
    asked.push({ kind, message, choices: choices.map((choice) => choice.value) });
    return next();
  };
  const prompt = {
    select: pick('select'),
    search: pick('search'),
    searchMany: pick('searchMany'),
    async text(message: string, options: TextOptions = {}) {
      asked.push({ kind: 'text', message });
      const value = (next() as string | undefined) ?? options.defaultValue ?? '';
      const error = options.validate?.(value);
      if (error) throw new Error(`invalid answer "${value}": ${error}`);
      return value;
    },
    async confirm(message: string) {
      asked.push({ kind: 'confirm', message });
      return next() as boolean;
    },
  } as Prompter;
  return { prompt, asked, answers };
}

function deps(prompt: Prompter, authIds = [{ id: 'acme_sb1', description: 'Admin @ Acme' }]): InteractiveDeps {
  return { prompt, t, cwd: root, loadProject, listAuthIds: async () => authIds };
}

function typescriptProject() {
  write('suitecloud.config.js', 'module.exports = { defaultProjectFolder: "src" };');
  write('tsconfig.json', '{ "compilerOptions": { "rootDir": "src/Source", "outDir": "src/FileCabinet/SuiteScripts/App" } }');
  write('project.json', '{ "defaultAuthId": "acme_sb1" }');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nsk-interactive-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('runInteractive', () => {
  it('starts with the command menu, listing every command with its description', async () => {
    typescriptProject();
    const { prompt, asked } = fakePrompter(['doctor']);
    expect(await runInteractive(undefined, deps(prompt))).toEqual(['doctor']);
    expect(asked[0]).toMatchObject({ message: t.interactive.chooseCommand });
    expect(asked[0]!.choices).toEqual([
      'init', 'doctor', 'generate', 'build', 'templates', 'upload', 'watch', 'validate', 'deploy', 'account', 'language',
    ]);
  });

  it('goes straight to the questions of a given command, accepting aliases', async () => {
    typescriptProject();
    const { prompt, asked } = fakePrompter(['user-event-script', 'ue_order', 'typescript', '', false]);
    expect(await runInteractive('g', deps(prompt))).toEqual(['generate', 'user-event-script', 'ue_order']);
    expect(asked[0]!.message).toBe(t.interactive.template);
  });

  it('rejects unknown commands', async () => {
    await expect(runInteractive('publish', deps(fakePrompter([]).prompt))).rejects.toThrow(NskError);
  });

  describe('init', () => {
    it('account customization project', async () => {
      const { prompt } = fakePrompter(['demo', 'acp', 'typescript', 'standard', false]);
      expect(await runInteractive('init', deps(prompt))).toEqual(['init', 'demo', '--no-install']);
    });

    it('passes a built-in or custom template', async () => {
      const minimal = fakePrompter(['demo', 'acp', 'javascript', 'minimal', true]);
      expect(await runInteractive('init', deps(minimal.prompt))).toEqual([
        'init', 'demo', '--language', 'javascript', '--template', 'minimal',
      ]);
      const custom = fakePrompter(['demo', 'acp', 'typescript', 'custom', ' github:acme/ns-template ', true]);
      expect(await runInteractive('init', deps(custom.prompt))).toEqual([
        'init', 'demo', '--template', 'github:acme/ns-template',
      ]);
    });

    it('SuiteApp with ids, a custom version and --force for a folder that is not empty', async () => {
      write('com.acme.app/notes.txt', 'x');
      const { prompt } = fakePrompter(['app', 'suiteapp', 'com.acme', 'app', '2.0.0', true, 'typescript', 'standard', true]);
      expect(await runInteractive('init', deps(prompt))).toEqual([
        'init', 'app', '--suiteapp', '--publisher-id', 'com.acme', '--project-id', 'app', '--project-version', '2.0.0',
        '--force',
      ]);
    });

    it('validates the project name', async () => {
      const { prompt } = fakePrompter(['../x']);
      await expect(runInteractive('init', deps(prompt))).rejects.toThrow(t.interactive.invalidName);
    });
  });

  describe('generate', () => {
    it('asks for the SDF object only for supported types, defaulting the script id', async () => {
      typescriptProject();
      const { prompt, asked } = fakePrompter(['user-event-script', 'UE-Order', 'javascript', 'App', true, 'salesorder', undefined]);
      expect(await runInteractive('generate', deps(prompt))).toEqual([
        'generate', 'user-event-script', 'UE-Order', '--language', 'javascript', '--dir', 'App', '--object',
        '--record-type', 'SALESORDER',
      ]);
      expect(asked.map((question) => question.message)).not.toContain(t.interactive.overwriteFiles);

      const suitelet = fakePrompter(['suitelet', 'sl_x', 'typescript', '']);
      expect(await runInteractive('generate', deps(suitelet.prompt))).toEqual(['generate', 'suitelet', 'sl_x']);
      expect(suitelet.asked.map((question) => question.message)).not.toContain(t.interactive.object);
    });

    it('asks to overwrite only when a file exists, and skips the language question in JavaScript projects', async () => {
      write('suitecloud.config.js', 'module.exports = {};');
      write('src/FileCabinet/SuiteScripts/rl.js', 'old');
      const { prompt, asked } = fakePrompter(['restlet', 'rl', '', true]);
      expect(await runInteractive('generate', deps(prompt))).toEqual(['generate', 'restlet', 'rl', '--force']);
      expect(asked.map((question) => question.message)).not.toContain(t.interactive.language);
    });
  });

  it('upload offers the project files and the compile/dry-run options', async () => {
    typescriptProject();
    write('src/Source/ue.ts');
    write('src/FileCabinet/SuiteScripts/lib/legacy.js');
    const { prompt, asked } = fakePrompter([[join('src', 'Source', 'ue.ts')], false, true]);
    expect(await runInteractive('upload', deps(prompt))).toEqual([
      'upload', '--no-compile', '--dry-run', join('src', 'Source', 'ue.ts'),
    ]);
    expect(asked[0]!.choices).toEqual([
      join('src', 'FileCabinet', 'SuiteScripts', 'lib', 'legacy.js'),
      join('src', 'Source', 'ue.ts'),
    ]);
  });

  it('deploy defaults to a preview and asks --asv only in account customization projects', async () => {
    typescriptProject();
    const { prompt, asked } = fakePrompter(['deploy', 'WARNING', true]);
    expect(await runInteractive('deploy', deps(prompt))).toEqual(['deploy', '--asv', 'WARNING']);
    expect(asked[0]!.choices).toEqual(['preview', 'deploy']);

    write('src/manifest.xml', '<manifest projecttype="SUITEAPP"><publisherid>a.b</publisherid><projectid>c</projectid></manifest>');
    const suiteApp = fakePrompter(['preview', true]);
    expect(await runInteractive('deploy', deps(suiteApp.prompt))).toEqual(['deploy', '--dry-run']);
  });

  it('validate and watch', async () => {
    typescriptProject();
    expect(await runInteractive('validate', deps(fakePrompter([true, '', false]).prompt))).toEqual([
      'validate', '--server', '--no-compile',
    ]);
    expect(await runInteractive('watch', deps(fakePrompter([false]).prompt))).toEqual(['watch', '--no-upload']);
  });

  it('account use lists the auth IDs, starting on the current one', async () => {
    typescriptProject();
    const authIds = [
      { id: 'acme_prd', description: 'Admin @ Acme' },
      { id: 'acme_sb1', description: 'Admin @ Acme' },
    ];
    const { prompt, asked } = fakePrompter(['use', 'acme_prd']);
    expect(await runInteractive('account', deps(prompt, authIds))).toEqual(['account', 'use', 'acme_prd']);
    expect(asked[1]!.choices).toEqual(['acme_prd', 'acme_sb1']);
  });

  it('language offers automatic and the three languages, starting on the saved one', async () => {
    const { prompt, asked } = fakePrompter(['es']);
    expect(await runInteractive('language', { ...deps(prompt), savedLanguage: 'pt' })).toEqual(['language', 'es']);
    expect(asked[0]!.choices).toEqual(['auto', 'en', 'es', 'pt']);
  });

  it('templates show asks the language only when there is a choice', async () => {
    expect(await runInteractive('templates', deps(fakePrompter(['show', 'restlet', 'javascript']).prompt))).toEqual([
      'templates', 'show', 'restlet', '--language', 'javascript',
    ]);
    expect(await runInteractive('templates', deps(fakePrompter(['show', 'script-object']).prompt))).toEqual([
      'templates', 'show', 'script-object',
    ]);
  });
});

describe('uploadCandidates', () => {
  it('lists sources and hand-written FileCabinet files, not compiler output or files suitecloud rejects', () => {
    typescriptProject();
    write('src/Source/a.ts');
    write('src/Source/types.d.ts');
    write('src/FileCabinet/SuiteScripts/App/a.js');
    write('src/FileCabinet/SuiteScripts/lib/b.js');
    write('src/FileCabinet/SuiteScripts/lib/b.js.map');
    write('src/FileCabinet/readme.txt');
    const files = uploadCandidates(loadProject(root)).map((file) => file.slice(root.length + 1));
    expect(files).toEqual([join('src', 'FileCabinet', 'SuiteScripts', 'lib', 'b.js'), join('src', 'Source', 'a.ts')]);
  });
});

describe('helpers', () => {
  it('formatCommand quotes arguments with spaces', () => {
    expect(formatCommand(['upload', 'src/FileCabinet/Web Site Hosting Files/a.html'])).toBe(
      'nsk upload "src/FileCabinet/Web Site Hosting Files/a.html"',
    );
  });

  it('takeInteractiveFlag removes -i and --interactive', () => {
    expect(takeInteractiveFlag(['node', 'nsk', 'deploy', '-i'])).toEqual({ interactive: true, argv: ['node', 'nsk', 'deploy'] });
    expect(takeInteractiveFlag(['node', 'nsk', 'doctor'])).toEqual({ interactive: false, argv: ['node', 'nsk', 'doctor'] });
  });
});
