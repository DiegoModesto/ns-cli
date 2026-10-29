/** An expected failure: printed to the user without a stack trace. */
export class NskError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'NskError';
  }
}
