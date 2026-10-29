import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isInside, resolveUploadTarget, toFileCabinetPath } from '../../src/core/paths.js';
import { NskError } from '../../src/errors.js';

const cases = [
  {
    os: 'posix',
    p: path.posix,
    root: '/work/project',
  },
  {
    os: 'win32',
    p: path.win32,
    root: 'C:\\work\\project',
  },
] as const;

describe.each(cases)('paths ($os)', ({ p, root }) => {
  const project = {
    fileCabinetDir: p.join(root, 'src', 'FileCabinet'),
    typescript: {
      tsconfig: p.join(root, 'tsconfig.json'),
      sourceDir: p.join(root, 'src', 'Source'),
      outDir: p.join(root, 'src', 'FileCabinet', 'SuiteScripts'),
    },
  };

  it('maps a .ts source to the compiled .js and its File Cabinet path', () => {
    const source = p.join(root, 'src', 'Source', 'MyProject', '_EntryPoints', 'ue_sales_order.ts');
    expect(resolveUploadTarget(source, project, p)).toEqual({
      source,
      compiled: p.join(root, 'src', 'FileCabinet', 'SuiteScripts', 'MyProject', '_EntryPoints', 'ue_sales_order.js'),
      fileCabinetPath: '/SuiteScripts/MyProject/_EntryPoints/ue_sales_order.js',
      needsCompile: true,
    });
  });

  it('uploads a .js inside the FileCabinet as is', () => {
    const source = p.join(root, 'src', 'FileCabinet', 'SuiteScripts', 'lib', 'utils.js');
    expect(resolveUploadTarget(source, project, p)).toMatchObject({
      compiled: source,
      fileCabinetPath: '/SuiteScripts/lib/utils.js',
      needsCompile: false,
    });
  });

  it('supports SuiteApp folders', () => {
    const file = p.join(root, 'src', 'FileCabinet', 'SuiteApps', 'com.acme.app', 'script.js');
    expect(toFileCabinetPath(file, project, p)).toBe('/SuiteApps/com.acme.app/script.js');
  });

  it('rejects .ts files outside the source folder', () => {
    expect(() => resolveUploadTarget(p.join(root, 'scripts', 'build.ts'), project, p)).toThrow(/outside the TypeScript source folder/);
  });

  it('rejects files outside the FileCabinet', () => {
    expect(() => resolveUploadTarget(p.join(root, 'README.js'), project, p)).toThrow(NskError);
    expect(() => toFileCabinetPath(p.join(root, 'src', 'FileCabinetOld', 'a.js'), project, p)).toThrow(NskError);
  });

  it('does not treat declaration files as sources', () => {
    expect(() => resolveUploadTarget(p.join(root, 'src', 'Source', 'types.d.ts'), project, p)).toThrow(/not a TypeScript source/);
  });

  it('rejects .ts files when the project has no tsconfig', () => {
    const source = p.join(root, 'src', 'Source', 'a.ts');
    expect(() => resolveUploadTarget(source, { ...project, typescript: null }, p)).toThrow(/no tsconfig/);
  });

  it('rejects an outDir outside the FileCabinet', () => {
    const misconfigured = { ...project, typescript: { ...project.typescript, outDir: p.join(root, 'dist') } };
    expect(() => resolveUploadTarget(p.join(root, 'src', 'Source', 'a.ts'), misconfigured, p)).toThrow(/outDir/);
  });

  it('isInside is false for the folder itself and for siblings with a common prefix', () => {
    expect(isInside(project.fileCabinetDir, project.fileCabinetDir, p)).toBe(false);
    expect(isInside(project.fileCabinetDir, project.fileCabinetDir + 'Old', p)).toBe(false);
  });

  it('isInside accepts children whose name starts with ".."', () => {
    expect(isInside(project.fileCabinetDir, p.join(project.fileCabinetDir, '..x', 'a.js'), p)).toBe(true);
    expect(isInside(project.fileCabinetDir, p.join(project.fileCabinetDir, '..'), p)).toBe(false);
    expect(isInside(project.fileCabinetDir, p.join(project.fileCabinetDir, '..', 'x', 'a.js'), p)).toBe(false);
  });
});
