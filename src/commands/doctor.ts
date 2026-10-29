import { relative } from 'node:path';
import type { Command } from 'commander';
import { loadProject } from '../core/config.js';
import { SuiteCloud } from '../core/suitecloud.js';
import { NskError } from '../errors.js';

interface Check {
  label: string;
  value: string;
  ok: boolean;
  hint?: string;
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Check the environment and show how nsk sees the current project')
    .action(async () => {
      const checks = await runChecks(process.cwd());
      for (const check of checks) {
        console.log(`${check.ok ? '✔' : '✖'} ${check.label.padEnd(16)} ${check.value}`);
        if (check.hint) console.log(`  ${''.padEnd(16)} ${check.hint}`);
      }
      if (checks.some((check) => !check.ok)) {
        process.exitCode = 1;
      }
    });
}

export async function runChecks(cwd: string, suitecloud = new SuiteCloud(cwd)): Promise<Check[]> {
  const version = await suitecloud.version();
  const checks: Check[] = [
    { label: 'Node.js', value: process.version, ok: true },
    version
      ? { label: 'SuiteCloud CLI', value: version, ok: true }
      : { label: 'SuiteCloud CLI', value: 'not found', ok: false, hint: 'npm install -g @oracle/suitecloud-cli' },
  ];

  let project;
  try {
    project = loadProject(cwd);
  } catch (error) {
    if (!(error instanceof NskError)) throw error;
    checks.push({ label: 'Project', value: error.message, ok: false, hint: error.hint });
    return checks;
  }

  const rel = (path: string) => relative(project.root, path) || '.';
  checks.push(
    { label: 'Project root', value: project.root, ok: true },
    { label: 'Config', value: project.configFile ? rel(project.configFile) : 'defaults (no ns.config.json)', ok: true },
    { label: 'FileCabinet', value: rel(project.fileCabinetDir), ok: true },
    project.typescript
      ? {
          label: 'TypeScript',
          value: `${rel(project.typescript.sourceDir)} → ${rel(project.typescript.outDir)} (${rel(project.typescript.tsconfig)}${project.config.bundler ? `, ${project.config.bundler}` : ''})`,
          ok: true,
        }
      : { label: 'TypeScript', value: 'not configured (JavaScript only)', ok: true },
    project.authId
      ? { label: 'Auth ID', value: project.authId, ok: true }
      : { label: 'Auth ID', value: 'not set', ok: false, hint: 'Run "suitecloud account:setup" in the project folder.' },
  );
  return checks;
}
