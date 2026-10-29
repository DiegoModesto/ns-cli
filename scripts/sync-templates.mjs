// Generates templates/ from snippets/NetSuiteSnippets.json so both stay in sync.
// Usage: npm run sync:templates
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const snippets = JSON.parse(readFileSync(join(root, 'snippets/NetSuiteSnippets.json'), 'utf8'));
const templatesDir = join(root, 'templates');

const EXTENSIONS = { javascript: 'js', typescript: 'ts' };

// Placeholder numbers in the SDF snippet → named tokens filled by `nsk generate`.
const SDF_TOKENS = {
  1: 'scriptType',
  2: 'scriptId',
  3: 'description',
  4: 'name',
  5: 'scriptFile',
  7: 'logLevel',
  8: 'recordType',
  9: 'status',
};

const kebab = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Replaces VS Code placeholders with their default value and drops the final cursor stop. */
function toPlainCode(body) {
  let code = body.filter((line) => line.trim() !== '$0').join('\n');
  code = code.replace(/\$\{\d+\|([^,|]+)[^}]*\|\}/g, '$1');
  for (let i = 0; i < 3; i++) code = code.replace(/\$\{\d+:([^{}]*)\}/g, '$1');
  code = code.replace(/\$0/g, '').replace(/\\\$/g, '$').replace(/\{\n\s*\}/g, '{}');
  return code.replace(/\t/g, '    ') + '\n';
}

/** Replaces VS Code placeholders with {{token}} names (unmapped ones keep their default). */
function toTokenizedCode(body) {
  let code = body.join('\n');
  code = code.replace(/\$\{(\d+)(?:\|[^}]*\||:([^{}]*))\}|\$\{(\d+)\}/g, (match, n, def, mirror) => {
    const token = SDF_TOKENS[n ?? mirror];
    return token ? `{{${token}}}` : (def ?? match);
  });
  return code.replace(/\t/g, '    ') + '\n';
}

rmSync(join(templatesDir, 'javascript'), { recursive: true, force: true });
rmSync(join(templatesDir, 'typescript'), { recursive: true, force: true });
rmSync(join(templatesDir, 'sdf'), { recursive: true, force: true });

const manifest = new Map();

for (const [title, snippet] of Object.entries(snippets)) {
  const match = title.match(/^(.+) - (JavaScript|TypeScript|XML)$/);
  if (!match || title.startsWith('Import:') || title.startsWith('Interface')) continue;

  const [, name, language] = match;
  const id = language === 'XML' ? 'script-object' : kebab(name);

  if (language === 'XML') {
    mkdirSync(join(templatesDir, 'sdf'), { recursive: true });
    writeFileSync(join(templatesDir, 'sdf', `${id}.xml`), toTokenizedCode(snippet.body));
    manifest.set(id, { id, name, kind: 'sdf-object', tokens: Object.values(SDF_TOKENS), files: { xml: `sdf/${id}.xml` } });
    continue;
  }

  const lang = language.toLowerCase();
  const file = `${lang}/${id}.${EXTENSIONS[lang]}`;
  mkdirSync(join(templatesDir, lang), { recursive: true });
  writeFileSync(join(templatesDir, file), toPlainCode(snippet.body));

  const scriptType = snippet.body.join('\n').match(/@NScriptType (\w+)/)?.[1] ?? null;
  const entry = manifest.get(id) ?? { id, name, kind: scriptType ? 'script' : 'module', scriptType, files: {} };
  entry.files[lang] = file;
  manifest.set(id, entry);
}

writeFileSync(join(templatesDir, 'manifest.json'), JSON.stringify([...manifest.values()], null, 2) + '\n');
console.log(`Generated ${manifest.size} templates in templates/`);
