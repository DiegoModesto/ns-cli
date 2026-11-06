/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */

import * as search from 'N/search';

/** Internal id of a customer that already uses this e-mail (ignoring `exceptId`), or null. */
export function findCustomerByEmail(email: string, exceptId?: number | null): number | null {
  const filters: unknown[] = [['email', 'is', email]];
  if (exceptId) filters.push('AND', ['internalid', 'noneof', exceptId]);

  const [result] = search
    .create({ type: 'customer', filters, columns: ['internalid'] })
    .run()
    .getRange({ start: 0, end: 1 });
  return result ? Number(result.id) : null;
}
