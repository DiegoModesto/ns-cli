import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NskError } from './errors.js';

export type TemplateLanguage = 'javascript' | 'typescript' | 'xml';

export interface Template {
  id: string;
  name: string;
  kind: 'script' | 'module' | 'sdf-object';
  scriptType?: string | null;
  tokens?: string[];
  files: Partial<Record<TemplateLanguage, string>>;
}

// Works from both src/ (tests) and dist/ (published package): templates/ is a sibling of either.
export const templatesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

export function loadTemplates(): Template[] {
  return JSON.parse(readFileSync(join(templatesDir, 'manifest.json'), 'utf8')) as Template[];
}

export function findTemplate(id: string): Template | undefined {
  return loadTemplates().find((template) => template.id === id);
}

export function readTemplate(template: Template, language: TemplateLanguage): string {
  const file = template.files[language];
  if (!file) {
    const available = Object.keys(template.files).join(', ');
    throw new NskError(`Template "${template.id}" is not available in ${language}.`, `Available: ${available}.`);
  }
  return readFileSync(join(templatesDir, file), 'utf8');
}

/** Replaces {{token}} markers; unknown tokens are left untouched. */
export function renderTemplate(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, token: string) => values[token] ?? match);
}
