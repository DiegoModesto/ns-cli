import { describe, expect, it } from 'vitest';
import { pascalCase, scaffoldOutDir } from '../../src/core/scaffold.js';

describe('pascalCase', () => {
  it.each([
    ['meu-projeto', 'MeuProjeto'],
    ['DiegoTests', 'DiegoTests'],
    ['sales_order.v2', 'SalesOrderV2'],
    ['acme', 'Acme'],
  ])('%s → %s', (name, expected) => {
    expect(pascalCase(name)).toBe(expected);
  });
});

describe('scaffoldOutDir', () => {
  it('puts account customization scripts in SuiteScripts/<ProjectName>', () => {
    expect(scaffoldOutDir({ name: 'meu-projeto', suiteApp: null, language: 'typescript' })).toBe(
      'src/FileCabinet/SuiteScripts/MeuProjeto',
    );
  });

  it("keeps SuiteApp scripts in the SuiteApp's own folder", () => {
    const suiteApp = { publisherId: 'com.acme', projectId: 'app' };
    expect(scaffoldOutDir({ name: 'app', suiteApp, language: 'javascript' })).toBe('src/FileCabinet/SuiteApps/com.acme.app');
  });
});
