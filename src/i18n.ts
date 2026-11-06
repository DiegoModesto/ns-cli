import { execFileSync } from 'node:child_process';
import { en, type Examples, type Messages } from './locales/en.js';
import { es } from './locales/es.js';
import { pt } from './locales/pt.js';

export type { Messages };

export type Locale = 'en' | 'es' | 'pt';

export const LOCALES: Locale[] = ['en', 'es', 'pt'];

/** Each language in its own name, as shown in menus and messages. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español', pt: 'Português' };

/** Where the active language came from, in precedence order. */
export type LocaleSource = 'flag' | 'env' | 'saved' | 'system' | 'default';

const MESSAGES: Record<Locale, Messages> = { en, es, pt };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** "pt_BR.UTF-8", "es-419", "en" → a supported locale; undefined for unsupported ones (and C/POSIX). */
export function parseLocale(value: string | undefined): Locale | undefined {
  const language = value?.trim().toLowerCase().slice(0, 2);
  return LOCALES.find((locale) => locale === language);
}

export interface LocaleInputs {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Language saved with `nsk language`. */
  saved?: string;
  /** Computer language; only called when nothing before it decides. */
  system?: () => string | undefined;
}

/**
 * Picks the language: --lang, NSK_LANG, the saved choice, the terminal locale (LC_ALL, LC_MESSAGES, LANG), the
 * computer language, then English. Unsupported values are skipped.
 */
export function resolveLocale({ argv, env, saved, system }: LocaleInputs): { locale: Locale; source: LocaleSource } {
  const candidates: [() => string | undefined, LocaleSource][] = [
    [() => readLangArg(argv), 'flag'],
    [() => env.NSK_LANG, 'env'],
    [() => saved, 'saved'],
    [() => env.LC_ALL || env.LC_MESSAGES || env.LANG, 'system'],
    [() => system?.(), 'system'],
  ];
  for (const [read, source] of candidates) {
    const locale = parseLocale(read());
    if (locale) return { locale, source };
  }
  return { locale: 'en', source: 'default' };
}

/**
 * The computer's language. macOS keeps it in AppleLanguages (Node's Intl falls back to en-US there when LANG is
 * unset); on Windows and Linux, Intl reflects the user locale.
 */
export function systemLocale(
  platform: NodeJS.Platform = process.platform,
  readAppleLanguages: () => string = () =>
    execFileSync('defaults', ['read', '-g', 'AppleLanguages'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }),
): string | undefined {
  if (platform === 'darwin') {
    try {
      // Output: ( "pt-BR", "en-BR" )
      const first = readAppleLanguages().match(/"?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)"?/)?.[1];
      if (first) return first;
    } catch {
      // fall back to Intl
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

/** Fills {name} placeholders. */
export function format(message: string, values: Record<string, string>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Removes `--lang <value>` / `--lang=<value>` from argv, so it works before or after any command. */
export function stripLangArg(argv: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') i++;
    else if (!argv[i]!.startsWith('--lang=')) result.push(argv[i]!);
  }
  return result;
}

function readLangArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') return argv[i + 1];
    if (argv[i]!.startsWith('--lang=')) return argv[i]!.slice('--lang='.length);
  }
  return undefined;
}

/** Formats examples as aligned "  command   # comment" lines. */
export function formatExamples(title: string, examples: Examples): string {
  const width = Math.max(...examples.map(([command]) => command.length));
  return `\n${title}\n${examples.map(([command, comment]) => `  ${command.padEnd(width)}  # ${comment}`).join('\n')}`;
}
