import { describe, expect, it, vi } from 'vitest';
import { loadScript } from '../../amd.js';

// Replaces the service with a mock, so this test only covers the script's own logic.
const customer = { findCustomerByEmail: vi.fn() };
const { beforeSubmit } = loadScript('{{outDir}}/App/_EntryPoints/ue_customer_email.js', {
  '../services/customer': customer,
});

/** A beforeSubmit context with a customer record whose e-mail is `email`. */
function contextWith(email, type = 'create') {
  const newRecord = { id: null, getValue: vi.fn(() => email), setValue: vi.fn() };
  return { context: { type, UserEventType: { CREATE: 'create', DELETE: 'delete' }, newRecord }, newRecord };
}

describe('ue_customer_email beforeSubmit', () => {
  it('saves the e-mail in lowercase', () => {
    customer.findCustomerByEmail.mockReturnValue(null);
    const { context, newRecord } = contextWith(' Ana@Example.com');
    beforeSubmit(context);
    expect(newRecord.setValue).toHaveBeenCalledWith({ fieldId: 'email', value: 'ana@example.com' });
  });

  it('blocks a duplicated e-mail', () => {
    customer.findCustomerByEmail.mockReturnValue(42);
    expect(() => beforeSubmit(contextWith('ana@example.com').context)).toThrow('Customer 42 already uses');
  });

  it('does nothing on delete', () => {
    const { context, newRecord } = contextWith('Ana@Example.com', 'delete');
    beforeSubmit(context);
    expect(newRecord.setValue).not.toHaveBeenCalled();
  });
});
