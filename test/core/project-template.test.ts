import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecResult, Runner } from '../../src/core/exec.js';
import {
  applyProjectTemplate,
  listProjectTemplates,
  loadProjectTemplate,
  mergePackageJson,
  parseTemplateSpec,
  readTemplateFiles,
  type TemplateFile,
} from '../../src/core/project-template.js';
import { NskError } from '../../src/errors.js';
import { projectTemplatesDir } from '../../src/templates.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nsk-template-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(file: string, content: string | Buffer = ''): void {
  mkdirSync(path.dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), content);
}

function file(filePath: string, content: string | Buffer): TemplateFile {
  return { path: filePath, content: Buffer.from(content) };
}

function fakeRunner(result: Partial<ExecResult> = {}) {
  return vi.fn<Runner>(async () => ({ exitCode: 0, stdout: '', stderr: '', ...result }));
}

describe('listProjectTemplates', () => {
  it('lists the built-in templates with the default first', () => {
    const templates = listProjectTemplates();
    expect(templates.map((template) => template.id)).toEqual(['standard', 'minimal']);
    expect(templates.every((template) => template.description.length > 0)).toBe(true);
  });
});

describe.each([
  ['posix', path.posix, '/work'],
  ['win32', path.win32, 'C:\\work'],
] as const)('parseTemplateSpec (%s)', (_name, p, cwd) => {
  const builtins = ['standard', 'minimal'];

  it('recognizes built-in templates', () => {
    expect(parseTemplateSpec('minimal', cwd, builtins, p)).toEqual({
      kind: 'builtin',
      id: 'minimal',
      dir: p.join(projectTemplatesDir, 'minimal'),
    });
  });

  it('expands github: shorthands, with an optional branch or tag', () => {
    expect(parseTemplateSpec('github:acme/ns-template', cwd, builtins, p)).toEqual({
      kind: 'git',
      url: 'https://github.com/acme/ns-template.git',
    });
    expect(parseTemplateSpec('github:acme/ns-template.git#v2', cwd, builtins, p)).toEqual({
      kind: 'git',
      url: 'https://github.com/acme/ns-template.git',
      ref: 'v2',
    });
  });

  it.each([
    ['https://gitlab.com/acme/tpl.git#main', 'https://gitlab.com/acme/tpl.git', 'main'],
    ['git@github.com:acme/tpl.git', 'git@github.com:acme/tpl.git', undefined],
    ['ssh://git@host/acme/tpl.git', 'ssh://git@host/acme/tpl.git', undefined],
    ['file:///srv/tpl', 'file:///srv/tpl', undefined],
  ])('treats %s as a git repository', (spec, url, ref) => {
    expect(parseTemplateSpec(spec, cwd, builtins, p)).toEqual({ kind: 'git', url, ...(ref ? { ref } : {}) });
  });

  it('resolves anything else as a folder, so ./standard is the folder and not the built-in', () => {
    expect(parseTemplateSpec('./standard', cwd, builtins, p)).toEqual({ kind: 'path', dir: p.join(cwd, 'standard') });
    expect(parseTemplateSpec('../templates/acme', cwd, builtins, p)).toEqual({
      kind: 'path',
      dir: p.resolve(cwd, '../templates/acme'),
    });
  });
});

describe('readTemplateFiles', () => {
  it('reads every file with "/" paths, except .git, node_modules and template.json', () => {
    write('template.json', '{}');
    write('.git/HEAD', 'ref');
    write('node_modules/x/index.js', '');
    write('_gitignore', 'coverage');
    write('src/Source/App/a.ts', 'a');
    expect(readTemplateFiles(dir).map((entry) => entry.path)).toEqual(['_gitignore', 'src/Source/App/a.ts']);
  });
});

describe('loadProjectTemplate', () => {
  it('reads a folder', async () => {
    write('README.md', '# {{name}}');
    const runner = fakeRunner();
    expect(await loadProjectTemplate({ kind: 'path', dir }, runner)).toEqual([file('README.md', '# {{name}}')]);
    expect(runner).not.toHaveBeenCalled();
  });

  it('fails for a missing folder before touching anything', async () => {
    await expect(loadProjectTemplate({ kind: 'path', dir: join(dir, 'missing') })).rejects.toThrow(/Template not found/);
  });

  it('clones git templates shallowly, on the requested branch', async () => {
    const runner = fakeRunner();
    expect(await loadProjectTemplate({ kind: 'git', url: 'https://x/t.git', ref: 'v2' }, runner)).toEqual([]);
    const [command, args] = runner.mock.calls[0]!;
    expect(command).toBe('git');
    expect(args.slice(0, -1)).toEqual(['clone', '--depth', '1', '--quiet', '--branch', 'v2', 'https://x/t.git']);
  });

  it('explains clone failures and a missing git', async () => {
    const failed = loadProjectTemplate({ kind: 'git', url: 'https://x/t.git' }, fakeRunner({ exitCode: 128, stderr: 'not found' }));
    await expect(failed).rejects.toThrow(NskError);
    await expect(failed).rejects.toMatchObject({ hint: 'not found' });
    const missing = loadProjectTemplate({ kind: 'git', url: 'https://x/t.git' }, fakeRunner({ exitCode: undefined }));
    await expect(missing).rejects.toThrow('git not found.');
  });
});

describe('applyProjectTemplate', () => {
  const root = join('/work', 'demo');
  const base = [
    { path: join(root, 'package.json'), content: '{"name":"demo","scripts":{"build":"nsk build","typecheck":"tsc"}}' },
    { path: join(root, 'tsconfig.json'), content: '{}' },
  ];

  it('merges package.json, appends .gitignore lines and fills tokens', () => {
    const applied = applyProjectTemplate(
      base,
      [
        file('package.json', '{"scripts":{"typecheck":"tsc -p test","test":"vitest run"},"devDependencies":{"vitest":"^5"}}'),
        file('_gitignore', '# comment\n!.vscode\n\ncoverage\n'),
        file('README.md', '# {{name}} in {{outDir}} {{unknown}}'),
      ],
      root,
      { name: 'demo', outDir: 'src/FileCabinet/SuiteScripts' },
    );

    expect(applied.gitignore).toEqual(['!.vscode', 'coverage']);
    const pkg = JSON.parse(String(applied.files.find((entry) => entry.path === join(root, 'package.json'))!.content));
    expect(pkg).toEqual({
      name: 'demo',
      scripts: { build: 'nsk build', typecheck: 'tsc -p test', test: 'vitest run' },
      devDependencies: { vitest: '^5' },
    });
    expect(applied.files.find((entry) => entry.path === join(root, 'README.md'))!.content).toBe(
      '# demo in src/FileCabinet/SuiteScripts {{unknown}}',
    );
  });

  it('lets template files replace generated ones and copies binary files untouched', () => {
    const binary = Buffer.from([0x89, 0x50, 0x00, 0x7b, 0x7b]);
    const applied = applyProjectTemplate(
      base,
      [file('tsconfig.json', '{"strict":true}'), file('docs/logo.png', binary)],
      root,
      {},
    );
    expect(applied.files.map((entry) => entry.path)).toEqual([
      join(root, 'package.json'),
      join(root, 'tsconfig.json'),
      join(root, 'docs', 'logo.png'),
    ]);
    expect(applied.files[1]!.content).toBe('{"strict":true}');
    expect(applied.files[2]!.content).toEqual(binary);
  });
});

describe('mergePackageJson', () => {
  it('replaces non-object fields and rejects invalid JSON', () => {
    expect(JSON.parse(mergePackageJson('{"private":true,"type":"commonjs"}', '{"type":"module"}'))).toEqual({
      private: true,
      type: 'module',
    });
    expect(() => mergePackageJson('{}', '{ nope')).toThrow(/not valid JSON/);
  });
});
