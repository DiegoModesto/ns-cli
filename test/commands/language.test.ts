import { describe, expect, it, vi } from 'vitest';
import { type LanguageInfo, runLanguage } from '../../src/commands/language.js';

const info: LanguageInfo = { locale: 'pt', source: 'system', computer: () => 'es' };

describe('runLanguage', () => {
  it('shows the current language and where it came from, in that language', () => {
    const save = vi.fn();
    expect(runLanguage(undefined, info, save)).toEqual([
      'Idioma: Português (detectado do computador).',
      'Troque com "nsk language <en|es|pt|auto>", ou só para um comando com --lang.',
    ]);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a language and answers in it', () => {
    const save = vi.fn();
    expect(runLanguage('en', info, save)).toEqual(['Language saved: English.']);
    expect(save).toHaveBeenCalledWith({ language: 'en' });
  });

  it('auto clears the saved language and reports the computer one', () => {
    const save = vi.fn();
    expect(runLanguage('auto', info, save)).toEqual(['nsk ahora sigue el idioma de la computadora: Español.']);
    expect(save).toHaveBeenCalledWith({ language: undefined });
  });
});
