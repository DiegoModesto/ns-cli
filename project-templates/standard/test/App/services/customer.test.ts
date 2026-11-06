import * as search from 'N/search';
import { describe, expect, it, vi } from 'vitest';
import { findCustomerByEmail } from '../../../{{sourceDir}}/App/services/customer';

/** A search whose run().getRange() returns these internal ids. */
function searchReturning(...ids: string[]) {
  return { run: () => ({ getRange: () => ids.map((id) => ({ id })) }) } as unknown as search.Search;
}

describe('findCustomerByEmail', () => {
  it('returns the id of the customer found', () => {
    vi.mocked(search.create).mockReturnValue(searchReturning('42'));
    expect(findCustomerByEmail('ana@example.com')).toBe(42);
    expect(search.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'customer', filters: [['email', 'is', 'ana@example.com']] }),
    );
  });

  it('ignores the record being saved', () => {
    vi.mocked(search.create).mockReturnValue(searchReturning());
    expect(findCustomerByEmail('ana@example.com', 7)).toBeNull();
    expect(vi.mocked(search.create).mock.calls[0]?.[0].filters).toContainEqual(['internalid', 'noneof', 7]);
  });
});
