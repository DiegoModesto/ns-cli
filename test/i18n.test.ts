import type { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { formatExamples, LOCALES, parseLocale, resolveLocale, stripLangArg, systemLocale } from '../src/i18n.js';
import { buildProgram } from '../src/program.js';

/** The program and every subcommand, depth first. */
function allCommands(command: Command): Command[] {
  return [command, ...command.commands.flatMap(allCommands)];
}

describe('parseLocale', () => {
  it('maps locale strings to the supported languages', () => {
    expect(parseLocale('pt_BR.UTF-8')).toBe('pt');
    expect(parseLocale('es-419')).toBe('es');
    expect(parseLocale('ES_mx')).toBe('es');
    expect(parseLocale('en')).toBe('en');
    expect(parseLocale('fr_FR.UTF-8')).toBeUndefined();
    expect(parseLocale('C')).toBeUndefined();
    expect(parseLocale(undefined)).toBeUndefined();
  });
});

describe('resolveLocale', () => {
  const argv = ['node', 'nsk'];
  const resolve = (overrides: Partial<Parameters<typeof resolveLocale>[0]>) => resolveLocale({ argv, env: {}, ...overrides });

  it('follows --lang, NSK_LANG, the saved choice, the terminal locale and then the computer', () => {
    const all = { env: { NSK_LANG: 'es', LANG: 'en_US.UTF-8' }, saved: 'pt', system: () => 'en-US' };
    expect(resolve({ ...all, argv: ['node', 'nsk', 'deploy', '--lang=pt'] })).toEqual({ locale: 'pt', source: 'flag' });
    expect(resolve(all)).toEqual({ locale: 'es', source: 'env' });
    expect(resolve({ ...all, env: { LANG: 'en_US.UTF-8' } })).toEqual({ locale: 'pt', source: 'saved' });
    expect(resolve({ env: { LC_ALL: 'es_ES.UTF-8', LANG: 'en_US.UTF-8' } })).toEqual({ locale: 'es', source: 'system' });
    expect(resolve({ env: { LANG: 'C' }, system: () => 'pt-BR' })).toEqual({ locale: 'pt', source: 'system' });
  });

  it('skips unsupported values and falls back to English', () => {
    expect(resolve({ argv: ['node', 'nsk', '--lang', 'de'], env: { LANG: 'es_AR.UTF-8' } })).toEqual({
      locale: 'es',
      source: 'system',
    });
    expect(resolve({ env: { LANG: 'fr_FR.UTF-8' }, system: () => 'fr-FR' })).toEqual({ locale: 'en', source: 'default' });
  });

  it('only asks the computer when nothing else decides', () => {
    let asked = false;
    resolve({ env: { LANG: 'pt_BR.UTF-8' }, system: () => ((asked = true), 'en') });
    expect(asked).toBe(false);
  });
});

describe('systemLocale', () => {
  it('reads the first AppleLanguages entry on macOS', () => {
    expect(systemLocale('darwin', () => '(\n    "es-419",\n    "en-BR"\n)\n')).toBe('es-419');
  });

  it('falls back to Intl when macOS cannot tell, and uses Intl elsewhere', () => {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale;
    expect(systemLocale('darwin', () => { throw new Error('no defaults'); })).toBe(intl);
    expect(systemLocale('win32')).toBe(intl);
  });
});

describe('stripLangArg', () => {
  it('removes --lang wherever it is, keeping everything else', () => {
    expect(stripLangArg(['node', 'nsk', '--lang', 'pt', 'deploy', '--yes'])).toEqual(['node', 'nsk', 'deploy', '--yes']);
    expect(stripLangArg(['node', 'nsk', 'upload', 'a.ts', '--lang=pt'])).toEqual(['node', 'nsk', 'upload', 'a.ts']);
  });
});

describe('formatExamples', () => {
  it('aligns the comments', () => {
    expect(formatExamples('Examples:', [['nsk a', 'one'], ['nsk long', 'two']])).toBe(
      '\nExamples:\n  nsk a     # one\n  nsk long  # two',
    );
  });
});

describe.each(LOCALES)('help (%s)', (locale) => {
  const program = buildProgram(locale, '1.2.3');

  it.each(allCommands(program).map((command) => [command.name(), command] as const))(
    '%s has a description and renders its help',
    (_name, command) => {
      expect(command.description()).not.toBe('');
      expect(command.helpInformation()).toContain(command.description().split(' ')[0]);
    },
  );

  it('groups the commands of the main help', () => {
    const help = program.helpInformation();
    for (const command of ['init', 'doctor', 'generate', 'build', 'templates', 'upload', 'watch', 'deploy', 'account', 'language']) {
      expect(help).toMatch(new RegExp(`^  ${command}\\b`, 'm'));
    }
  });
});

describe.each(['pt', 'es'] as const)('%s help', (locale) => {
  it('has no English text left from commander', () => {
    for (const command of allCommands(buildProgram(locale, '1.2.3'))) {
      const help = command.helpInformation();
      expect(help, command.name()).not.toMatch(/Usage:|Options:|Commands:|Arguments:|\[options\]|\[command\]|default:|choices:/);
      expect(help, command.name()).not.toMatch(/display help|output the version/);
    }
  });
});

describe('Spanish help', () => {
  it('shows translated titles and groups', () => {
    const help = buildProgram('es', '1.2.3').helpInformation();
    expect(help).toMatch(/^Uso: nsk \[opciones\] \[comando\]/);
    expect(help).toContain('Sincronizar con NetSuite:');
    expect(help).toContain('Configuración:');
  });
});

describe('Portuguese help', () => {
  const program = buildProgram('pt', '1.2.3');

  it('has no English text left from commander', () => {
    for (const command of allCommands(program)) {
      const help = command.helpInformation();
      expect(help, command.name()).not.toMatch(/Usage:|Options:|Commands:|Arguments:|\[options\]|\[command\]|default:|choices:/);
      expect(help, command.name()).not.toMatch(/display help|output the version/);
    }
  });

  it('shows translated titles, groups and examples', () => {
    expect(program.helpInformation()).toMatch(/^Uso: nsk \[opções\] \[comando\]/);
    expect(program.helpInformation()).toContain('Sincronizar com o NetSuite:');

    const deploy = program.commands.find((command) => command.name() === 'deploy')!;
    let output = '';
    deploy.configureOutput({ writeOut: (text) => (output += text) });
    deploy.outputHelp();
    expect(output).toContain('Exemplos:');
    expect(output).toContain('(opções: ERROR, WARNING)');
  });
});
