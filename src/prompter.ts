import * as clack from '@clack/prompts';

export interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface TextOptions {
  /** Used when the answer is left empty (also shown as the placeholder). */
  defaultValue?: string;
  placeholder?: string;
  /** Returns an error message, or undefined when the value is valid. */
  validate?: (value: string) => string | undefined;
}

/** The questions the interactive mode asks; injectable so tests can answer them. */
export interface Prompter {
  select<T>(message: string, choices: Choice<T>[], initial?: T): Promise<T>;
  /** Like select, but the user can type to filter long lists. */
  search<T>(message: string, choices: Choice<T>[]): Promise<T>;
  /** Pick one or more; type to filter. */
  searchMany<T>(message: string, choices: Choice<T>[]): Promise<T[]>;
  text(message: string, options?: TextOptions): Promise<string>;
  confirm(message: string, initial: boolean): Promise<boolean>;
}

/** Thrown when the user cancels a question (Ctrl+C / Esc). */
export class PromptCancelled extends Error {
  constructor() {
    super('Prompt cancelled');
    this.name = 'PromptCancelled';
  }
}

function answer<T>(value: T | symbol): T {
  if (clack.isCancel(value)) throw new PromptCancelled();
  return value as T;
}

/** Terminal prompts with arrow keys and type-to-filter. */
export const clackPrompter: Prompter = {
  async select<T>(message: string, choices: Choice<T>[], initial?: T) {
    return answer<T>(await clack.select<T>({ message, options: choices as clack.Option<T>[], initialValue: initial }));
  },
  async search<T>(message: string, choices: Choice<T>[]) {
    return answer<T>(await clack.autocomplete<T>({ message, options: choices as clack.Option<T>[], maxItems: 10 }));
  },
  async searchMany<T>(message: string, choices: Choice<T>[]) {
    const options = choices as clack.Option<T>[];
    return answer<T[]>(await clack.autocompleteMultiselect<T>({ message, options, maxItems: 10, required: true }));
  },
  async text(message: string, { defaultValue, placeholder, validate }: TextOptions = {}) {
    const check = (value: string | undefined) => (!value && defaultValue !== undefined ? undefined : validate?.(value ?? ''));
    return answer<string>(await clack.text({ message, defaultValue, placeholder: placeholder ?? defaultValue, validate: check }));
  },
  async confirm(message: string, initial: boolean) {
    return answer<boolean>(await clack.confirm({ message, initialValue: initial }));
  },
};
