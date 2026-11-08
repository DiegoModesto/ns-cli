// Loads SuiteScript AMD files (define([...], factory)) in tests, the way NetSuite does: each "N/<module>"
// dependency comes from test/mocks/N/<module>.js, and relative dependencies are loaded the same way.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const mocks = import.meta.glob('./mocks/N/*.js', { eager: true });

/**
 * Returns what the script's factory returns. `file` is relative to the project root. `replace` swaps
 * dependencies by the id used in define(), e.g. { '../services/customer': { findCustomerByEmail: vi.fn() } }.
 */
export function loadScript(file, replace = {}) {
  const path = resolve(root, file);
  let dependencies = [];
  let factory;
  const define = (...args) => {
    factory = args.pop();
    dependencies = args.find(Array.isArray) ?? [];
  };
  new Function('define', readFileSync(path, 'utf8'))(define);
  if (typeof factory !== 'function') throw new Error(`${file} does not call define(..., factory).`);
  return factory(...dependencies.map((id) => dependency(id, dirname(path), replace)));
}

function dependency(id, dir, replace) {
  if (id in replace) return replace[id];
  if (id.startsWith('N/')) {
    const mock = mocks[`./mocks/${id}.js`];
    if (!mock) throw new Error(`No mock for ${id}: add test/mocks/${id}.js.`);
    return mock;
  }
  if (id.startsWith('.')) return loadScript(join(dir, `${id}.js`), replace);
  throw new Error(`Unknown dependency "${id}".`);
}
