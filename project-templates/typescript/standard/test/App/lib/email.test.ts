import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../../../{{sourceDir}}/App/lib/email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('turns empty values into ""', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });
});
