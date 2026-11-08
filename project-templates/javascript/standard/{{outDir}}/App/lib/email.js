/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
  /** Trims and lowercases an e-mail address; anything that is not a string becomes ''. */
  const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

  return { normalizeEmail };
});
