/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/error', '../lib/email', '../services/customer'], (error, email, customer) => {
  /** Example (deploy on Customer): saves e-mails in lowercase and blocks a second customer with the same e-mail. */
  const beforeSubmit = (context) => {
    if (context.type === context.UserEventType.DELETE) return;

    const value = email.normalizeEmail(context.newRecord.getValue('email'));
    if (!value) return;
    context.newRecord.setValue({ fieldId: 'email', value });

    const duplicate = customer.findCustomerByEmail(value, context.newRecord.id);
    if (duplicate !== null) {
      throw error.create({ name: 'DUPLICATE_EMAIL', message: `Customer ${duplicate} already uses ${value}.` });
    }
  };

  return { beforeSubmit };
});
