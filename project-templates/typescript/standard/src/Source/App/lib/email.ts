/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */

/** Trims and lowercases an e-mail address; anything that is not a string becomes ''. */
export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
