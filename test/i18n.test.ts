import type { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { detectLocale, formatExamples, LOCALES, stripLangArg } from '../src/i18n.js';
import { buildProgram } from '../src/program.js';

/** The program and every subcommand, depth first. */
function allCommands(command: Command): Command[] {
  return [command, ...command.commands.flatMap(allCommands)];
}

describe('detectLocale', () => {
  it('prefers --lang, then NSK_LANG, then the system locale', () => {
    expect(detectLocale(['node', 'nsk', '--lang', 'pt'], { LANG: 'en_US.UTF-8' })).toBe('pt');
    expect(detectLocale(['node', 'nsk', 'deploy', '--lang=en'], { NSK_LANG: 'pt' })).toBe('en');
    expect(detectLocale(['node', 'nsk'], { NSK_LANG: 'pt-BR', LANG: 'en_US.UTF-8' })).toBe('pt');
    expect(detectLocale(['node', 'nsk'], { LANG: 'pt_BR.UTF-8' })).toBe('pt');
    expect(detectLocale(['node', 'nsk'], { LC_ALL: 'pt_PT.UTF-8', LANG: 'en_US.UTF-8' })).toBe('pt');
  });

  it('falls back to English', () => {
    expect(detectLocale(['node', 'nsk'], {})).toBe('en');
    expect(detectLocale(['node', 'nsk'], { LANG: 'C' })).toBe('en');
    expect(detectLocale(['node', 'nsk', '--lang', 'es'], {})).toBe('en');
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
    for (const command of ['init', 'doctor', 'generate', 'build', 'templates', 'upload', 'watch', 'deploy', 'account']) {
      expect(help).toMatch(new RegExp(`^  ${command}\\b`, 'm'));
    }
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
