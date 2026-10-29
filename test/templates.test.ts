import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findTemplate, loadTemplates, readTemplate, renderTemplate, templatesDir } from '../src/templates.js';

const templates = loadTemplates();

describe('templates manifest', () => {
  it('has unique ids', () => {
    const ids = templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(templates)('$id points to existing files', (template) => {
    for (const file of Object.values(template.files)) {
      expect(existsSync(join(templatesDir, file))).toBe(true);
    }
  });

  it.each(templates.filter((template) => template.kind === 'script'))(
    '$id declares its @NScriptType in every language',
    (template) => {
      for (const language of ['javascript', 'typescript'] as const) {
        expect(readTemplate(template, language)).toContain(`@NScriptType ${template.scriptType}`);
      }
    },
  );
});

describe('javascript templates', () => {
  it.each(templates.filter((template) => template.files.javascript))('$id is valid JavaScript', (template) => {
    execFileSync(process.execPath, ['--check', join(templatesDir, template.files.javascript!)]);
  });
});

describe('renderTemplate', () => {
  it('fills the SDF script object tokens and keeps unknown ones', () => {
    const xml = readTemplate(findTemplate('script-object')!, 'xml');
    const rendered = renderTemplate(xml, { scriptType: 'usereventscript', scriptId: 'ue_sales_order' });

    expect(rendered).toMatch(/^<usereventscript scriptid="customscript_ue_sales_order">/);
    expect(rendered).toContain('<scriptdeployment scriptid="customdeploy_ue_sales_order">');
    expect(rendered).toMatch(/<\/usereventscript>\n$/);
    expect(rendered).toContain('{{recordType}}');
  });
});
