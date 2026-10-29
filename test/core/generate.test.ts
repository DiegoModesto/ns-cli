import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type GenerateOptions, normalizeScriptId, planGenerate, writeGenerated } from '../../src/core/generate.js';
import { NskError } from '../../src/errors.js';
import { findTemplate, readTemplate } from '../../src/templates.js';

const userEvent = findTemplate('user-event-script')!;
const suitelet = findTemplate('suitelet')!;

const cases = [
  { os: 'posix', p: path.posix, root: '/work/project' },
  { os: 'win32', p: path.win32, root: 'C:\\work\\project' },
] as const;

describe.each(cases)('planGenerate ($os)', ({ p, root }) => {
  const project = {
    projectFolder: p.join(root, 'src'),
    fileCabinetDir: p.join(root, 'src', 'FileCabinet'),
    typescript: {
      tsconfig: p.join(root, 'tsconfig.json'),
      sourceDir: p.join(root, 'src', 'Source'),
      outDir: p.join(root, 'src', 'FileCabinet', 'SuiteScripts'),
    },
    suiteApp: null,
  };
  const ts: GenerateOptions = { language: 'typescript', object: false };
  const js: GenerateOptions = { language: 'javascript', object: false };

  it('puts TypeScript scripts in the source folder', () => {
    const [file] = planGenerate(userEvent, 'ue_sales_order', { ...ts, dir: 'App/_EntryPoints' }, project, p);
    expect(file!.path).toBe(p.join(root, 'src', 'Source', 'App', '_EntryPoints', 'ue_sales_order.ts'));
    expect(file!.content).toBe(readTemplate(userEvent, 'typescript'));
  });

  it('puts JavaScript scripts in SuiteScripts, accepting the extension in the name', () => {
    const [file] = planGenerate(userEvent, 'ue_sales_order.js', js, project, p);
    expect(file!.path).toBe(p.join(root, 'src', 'FileCabinet', 'SuiteScripts', 'ue_sales_order.js'));
  });

  it('puts JavaScript scripts of a SuiteApp in its SuiteApps folder', () => {
    const suiteApp = { ...project, suiteApp: { publisherId: 'com.acme', projectId: 'myapp' } };
    const [file] = planGenerate(userEvent, 'ue', { ...js, dir: 'App' }, suiteApp, p);
    expect(file!.path).toBe(p.join(root, 'src', 'FileCabinet', 'SuiteApps', 'com.acme.myapp', 'App', 'ue.js'));
  });

  it('refuses a --dir or name that escapes the scripts folder', () => {
    expect(() => planGenerate(userEvent, 'ue', { ...ts, dir: '../../x' }, project, p)).toThrow(/points outside/);
    expect(() => planGenerate(userEvent, '../ue', ts, project, p)).toThrow(/Invalid name/);
  });

  it('refuses TypeScript without a tsconfig', () => {
    expect(() => planGenerate(userEvent, 'ue', ts, { ...project, typescript: null }, p)).toThrow(/no tsconfig/);
  });

  it('generates the SDF object pointing at the compiled file', () => {
    const files = planGenerate(
      userEvent,
      'UE-Sales-Order',
      { ...ts, dir: 'App', object: true, recordType: 'salesorder' },
      project,
      p,
    );
    const object = files[1]!;

    expect(object.path).toBe(p.join(root, 'src', 'Objects', 'customscript_ue_sales_order.xml'));
    expect(object.content).toMatch(/^<usereventscript scriptid="customscript_ue_sales_order">/);
    expect(object.content).toContain('<scriptfile>[/SuiteScripts/App/UE-Sales-Order.js]</scriptfile>');
    expect(object.content).toContain('<scriptdeployment scriptid="customdeploy_ue_sales_order">');
    expect(object.content).toContain('<recordtype>SALESORDER</recordtype>');
    expect(object.content).toContain('<status>TESTING</status>');
    expect(object.content).not.toMatch(/\{\{\w+\}\}/);
  });

  it('honors --script-id and validates it', () => {
    const options = { ...ts, object: true, recordType: 'CUSTOMER', scriptId: 'acme_customer_ue' };
    expect(planGenerate(userEvent, 'ue', options, project, p)[1]!.path).toMatch(/customscript_acme_customer_ue\.xml$/);
    expect(() => planGenerate(userEvent, 'ue', { ...options, scriptId: 'Bad-Id' }, project, p)).toThrow(/Invalid script id/);
  });

  it('requires a record type and a supported script type for --object', () => {
    expect(() => planGenerate(userEvent, 'ue', { ...ts, object: true }, project, p)).toThrow(
      expect.objectContaining({ hint: expect.stringContaining('--record-type') }),
    );
    expect(() => planGenerate(suitelet, 'sl', { ...ts, object: true, recordType: 'X' }, project, p)).toThrow(
      /not supported for Suitelet/,
    );
  });

  it('refuses to generate the SDF object template on its own', () => {
    expect(() => planGenerate(findTemplate('script-object')!, 'x', ts, project, p)).toThrow(NskError);
  });
});

describe('normalizeScriptId', () => {
  it('lowercases and replaces anything outside [a-z0-9_]', () => {
    expect(normalizeScriptId('UE Sales-Order.v2')).toBe('ue_sales_order_v2');
  });
});

describe('writeGenerated', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates folders and refuses to overwrite unless forced', () => {
    dir = mkdtempSync(join(tmpdir(), 'nsk-generate-'));
    const existing = join(dir, 'a.ts');
    writeFileSync(existing, 'old');
    const files = [
      { path: join(dir, 'deep', 'b.ts'), content: 'b' },
      { path: existing, content: 'new' },
    ];

    expect(() => writeGenerated(files, false)).toThrow(/Already exists:\n {2}- .*a\.ts$/);
    expect(readFileSync(existing, 'utf8')).toBe('old');

    writeGenerated(files, true);
    expect(readFileSync(existing, 'utf8')).toBe('new');
    expect(readFileSync(join(dir, 'deep', 'b.ts'), 'utf8')).toBe('b');
  });
});
