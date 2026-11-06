import { defineConfig } from 'vitest/config';

// project-templates/*/test are the generated projects' tests, not nsk's.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
