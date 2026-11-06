/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

import * as error from 'N/error';
import type { EntryPoints } from 'N/types';
import { normalizeEmail } from '../lib/email';
import { findCustomerByEmail } from '../services/customer';

/** Example (deploy on Customer): saves e-mails in lowercase and blocks a second customer with the same e-mail. */
export const beforeSubmit: EntryPoints.UserEvent.beforeSubmit = (context) => {
  if (context.type === context.UserEventType.DELETE) return;

  const email = normalizeEmail(context.newRecord.getValue('email'));
  if (!email) return;
  context.newRecord.setValue({ fieldId: 'email', value: email });

  const duplicate = findCustomerByEmail(email, context.newRecord.id);
  if (duplicate !== null) {
    throw error.create({ name: 'DUPLICATE_EMAIL', message: `Customer ${duplicate} already uses ${email}.` });
  }
};
