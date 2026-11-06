import { Argument, type Command } from 'commander';
import { writeSettings } from '../core/settings.js';
import {
  format,
  formatExamples,
  LANGUAGE_NAMES,
  type Locale,
  type LocaleSource,
  messagesFor,
  type Messages,
} from '../i18n.js';

export interface LanguageInfo {
  locale: Locale;
  source: LocaleSource;
  /** Language the computer would give without a saved choice. */
  computer: () => Locale;
}

export function registerLanguage(program: Command, t: Messages, info: LanguageInfo): void {
  program
    .command('language')
    .description(t.language.description)
    .addArgument(new Argument('[language]', t.language.arg).choices(['en', 'es', 'pt', 'auto']))
    .addHelpText('after', formatExamples(t.help.examples, t.language.examples))
    .action((language: Locale | 'auto' | undefined) => {
      for (const line of runLanguage(language, info, (settings) => writeSettings(settings))) console.log(line);
    });
}

/** Shows the language, or saves a new one ("auto" clears it); messages come out in the resulting language. */
export function runLanguage(
  language: Locale | 'auto' | undefined,
  info: LanguageInfo,
  save: (settings: { language: Locale | undefined }) => void,
): string[] {
  if (language === undefined) {
    const t = messagesFor(info.locale);
    return [
      format(t.language.current, { name: LANGUAGE_NAMES[info.locale], source: t.language.sources[info.source] }),
      t.language.change,
    ];
  }
  if (language === 'auto') {
    save({ language: undefined });
    const computer = info.computer();
    return [format(messagesFor(computer).language.auto, { name: LANGUAGE_NAMES[computer] })];
  }
  save({ language });
  return [format(messagesFor(language).language.saved, { name: LANGUAGE_NAMES[language] })];
}
