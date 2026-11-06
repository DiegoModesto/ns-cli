// Tests run in Node, where the NetSuite modules (N/*) do not exist: each import of "N/<module>" loads
// test/mocks/N/<module>.ts instead. Add a mock there when a script uses a module that has none yet.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{ find: /^N\/(.+)$/, replacement: fileURLToPath(new URL('./test/mocks/N/$1.ts', import.meta.url)) }],
  },
  test: {
    include: ['test/**/*.test.ts'],
    mockReset: true,
  },
});
