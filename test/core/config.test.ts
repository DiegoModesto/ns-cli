import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findProjectRoot, loadProject, writeAuthId } from '../../src/core/config.js';
import { NskError } from '../../src/errors.js';

let root: string;

function write(file: string, content: string): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

const SUITECLOUD_CONFIG = 'module.exports = { defaultProjectFolder: "src", commands: {} };';
const TSCONFIG = `{
  // SuiteScript project
  "compilerOptions": {
    "rootDir": "src/Source",
    "outDir": "src/FileCabinet/SuiteScripts",
  },
}`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nsk-config-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findProjectRoot', () => {
  it('walks up to the folder with suitecloud.config.js', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    mkdirSync(join(root, 'src/Source/deep'), { recursive: true });
    expect(findProjectRoot(join(root, 'src/Source/deep'))).toBe(root);
  });

  it('throws a NskError outside a project', () => {
    expect(() => findProjectRoot(root)).toThrow(NskError);
  });
});

describe('writeAuthId', () => {
  it('sets defaultAuthId keeping other keys, or creates project.json', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    writeAuthId(root, 'sandbox');
    expect(loadProject(root).authId).toBe('sandbox');

    write('project.json', '{ "defaultAuthId": "sandbox", "other": 1 }');
    writeAuthId(root, 'production');
    expect(JSON.parse(readFileSync(join(root, 'project.json'), 'utf8'))).toEqual({ defaultAuthId: 'production', other: 1 });
  });
});

describe('loadProject', () => {
  it('reads defaults, suitecloud.config.js, tsconfig and project.json', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write('tsconfig.json', TSCONFIG);
    write('project.json', '{ "defaultAuthId": "sandbox" }');

    const project = loadProject(root);

    expect(project.configFile).toBeNull();
    expect(project.projectFolder).toBe(join(root, 'src'));
    expect(project.fileCabinetDir).toBe(join(root, 'src/FileCabinet'));
    expect(project.typescript).toEqual({
      tsconfig: join(root, 'tsconfig.json'),
      sourceDir: join(root, 'src/Source'),
      outDir: join(root, 'src/FileCabinet/SuiteScripts'),
    });
    expect(project.authId).toBe('sandbox');
  });

  it('honors a custom defaultProjectFolder', () => {
    write('suitecloud.config.js', 'module.exports = { defaultProjectFolder: "sdf" };');
    expect(loadProject(root).fileCabinetDir).toBe(join(root, 'sdf/FileCabinet'));
  });

  it('reads an ESM suitecloud.config.js', () => {
    write('package.json', '{ "type": "module" }');
    write('suitecloud.config.js', 'export default { defaultProjectFolder: "sdf" };');
    expect(loadProject(root).fileCabinetDir).toBe(join(root, 'sdf/FileCabinet'));
  });

  it('reports a broken suitecloud.config.js', () => {
    write('suitecloud.config.js', 'module.exports = {');
    expect(() => loadProject(root)).toThrow(NskError);
    expect(() => loadProject(root)).toThrow(/Could not load suitecloud\.config\.js/);
  });

  it('rejects malformed project.json', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write('project.json', '{bad');
    expect(() => loadProject(root)).toThrow(NskError);
    expect(() => loadProject(root)).toThrow(/project\.json is not valid JSON/);
  });

  it('detects SuiteApp projects from manifest.xml', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write(
      'src/manifest.xml',
      '<manifest projecttype="SUITEAPP">\n  <publisherid>com.acme</publisherid>\n  <projectid>myapp</projectid>\n</manifest>',
    );
    expect(loadProject(root).suiteApp).toEqual({ publisherId: 'com.acme', projectId: 'myapp' });
  });

  it('treats account customization projects as not SuiteApp', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write('src/manifest.xml', '<manifest projecttype="ACCOUNTCUSTOMIZATION">\n  <projectname>demo</projectname>\n</manifest>');
    expect(loadProject(root).suiteApp).toBeNull();
  });

  it('treats projects without tsconfig as JavaScript only', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    const project = loadProject(root);
    expect(project.typescript).toBeNull();
    expect(project.authId).toBeNull();
  });

  it('lets ns.config.json override the tsconfig and its dirs', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write('tsconfig.build.json', '{ "compilerOptions": { "rootDir": "ignored", "outDir": "src/FileCabinet/SuiteScripts/App" } }');
    write('ns.config.json', '{ "tsconfig": "tsconfig.build.json", "sourceDir": "ts" }');

    const project = loadProject(root);

    expect(project.configFile).toBe(join(root, 'ns.config.json'));
    expect(project.typescript).toEqual({
      tsconfig: join(root, 'tsconfig.build.json'),
      sourceDir: join(root, 'ts'),
      outDir: join(root, 'src/FileCabinet/SuiteScripts/App'),
    });
  });

  it('follows relative "extends", resolving dirs against the file that declares them', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write('config/tsconfig.base.json', '{ "compilerOptions": { "rootDir": "../src/Source", "outDir": "../wrong" } }');
    write('tsconfig.json', '{ "extends": "./config/tsconfig.base", "compilerOptions": { "outDir": "src/FileCabinet/SuiteScripts" } }');

    expect(loadProject(root).typescript).toMatchObject({
      sourceDir: join(root, 'src/Source'),
      outDir: join(root, 'src/FileCabinet/SuiteScripts'),
    });
  });

  it('explains a missing rootDir', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    write('tsconfig.json', '{ "compilerOptions": { "outDir": "out" } }');
    expect(() => loadProject(root)).toThrow(/compilerOptions\.rootDir/);
  });

  it('accepts rollup as bundler and nothing else', () => {
    write('ns.config.json', '{ "bundler": "rollup" }');
    expect(loadProject(root).config.bundler).toBe('rollup');
    write('ns.config.json', '{ "bundler": "webpack" }');
    expect(() => loadProject(root)).toThrow(/bundler/);
  });

  it('reads protectedAuthIds (empty by default)', () => {
    write('suitecloud.config.js', SUITECLOUD_CONFIG);
    expect(loadProject(root).config.protectedAuthIds).toEqual([]);
    write('ns.config.json', '{ "protectedAuthIds": ["production"] }');
    expect(loadProject(root).config.protectedAuthIds).toEqual(['production']);
  });

  it('rejects unknown keys in ns.config.json', () => {
    write('ns.config.json', '{ "srcDir": "src" }');
    expect(() => loadProject(root)).toThrow(/Invalid ns\.config\.json/);
  });

  it('rejects malformed ns.config.json', () => {
    write('ns.config.json', '{ "tsconfig": }');
    expect(() => loadProject(root)).toThrow(/not valid JSON/);
  });
});
