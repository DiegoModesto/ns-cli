import type { EntryPoints } from 'N/types';
import { describe, expect, it, vi } from 'vitest';
import { beforeSubmit } from '../../../{{sourceDir}}/App/_EntryPoints/ue_customer_email';
import { findCustomerByEmail } from '../../../{{sourceDir}}/App/services/customer';

// Replaces the service with a mock, so this test only covers the script's own logic.
vi.mock('../../../{{sourceDir}}/App/services/customer');

/** A beforeSubmit context with a customer record whose e-mail is `email`. */
function contextWith(email: string, type = 'create') {
  const newRecord = { id: null, getValue: vi.fn(() => email), setValue: vi.fn() };
  const context = { type, UserEventType: { CREATE: 'create', DELETE: 'delete' }, newRecord };
  return { context: context as unknown as EntryPoints.UserEvent.beforeSubmitContext, newRecord };
}

describe('ue_customer_email beforeSubmit', () => {
  it('saves the e-mail in lowercase', () => {
    vi.mocked(findCustomerByEmail).mockReturnValue(null);
    const { context, newRecord } = contextWith(' Ana@Example.com');
    beforeSubmit(context);
    expect(newRecord.setValue).toHaveBeenCalledWith({ fieldId: 'email', value: 'ana@example.com' });
  });

  it('blocks a duplicated e-mail', () => {
    vi.mocked(findCustomerByEmail).mockReturnValue(42);
    expect(() => beforeSubmit(contextWith('ana@example.com').context)).toThrow('Customer 42 already uses');
  });

  it('does nothing on delete', () => {
    const { context, newRecord } = contextWith('Ana@Example.com', 'delete');
    beforeSubmit(context);
    expect(newRecord.setValue).not.toHaveBeenCalled();
  });
});
