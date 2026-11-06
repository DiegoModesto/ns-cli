import { describe, expect, it, vi } from 'vitest';
import { loadScript } from '../../amd.js';
import * as search from '../../mocks/N/search.js';

const { findCustomerByEmail } = loadScript('{{outDir}}/App/services/customer.js');

/** A search whose run().getRange() returns these internal ids. */
function searchReturning(...ids) {
  return { run: () => ({ getRange: () => ids.map((id) => ({ id })) }) };
}

describe('findCustomerByEmail', () => {
  it('returns the id of the customer found', () => {
    search.create.mockReturnValue(searchReturning('42'));
    expect(findCustomerByEmail('ana@example.com')).toBe(42);
    expect(search.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'customer', filters: [['email', 'is', 'ana@example.com']] }),
    );
  });

  it('ignores the record being saved', () => {
    search.create.mockReturnValue(searchReturning());
    expect(findCustomerByEmail('ana@example.com', 7)).toBeNull();
    expect(vi.mocked(search.create).mock.calls[0]?.[0].filters).toContainEqual(['internalid', 'noneof', 7]);
  });
});
