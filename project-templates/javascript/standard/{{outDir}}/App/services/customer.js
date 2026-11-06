/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/search'], (search) => {
  /** Internal id of a customer that already uses this e-mail (ignoring `exceptId`), or null. */
  const findCustomerByEmail = (email, exceptId) => {
    const filters = [['email', 'is', email]];
    if (exceptId) filters.push('AND', ['internalid', 'noneof', exceptId]);

    const [result] = search
      .create({ type: 'customer', filters, columns: ['internalid'] })
      .run()
      .getRange({ start: 0, end: 1 });
    return result ? Number(result.id) : null;
  };

  return { findCustomerByEmail };
});
