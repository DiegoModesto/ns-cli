import { vi } from 'vitest';

export const load = vi.fn();
export const create = vi.fn();
export const copy = vi.fn();
export const transform = vi.fn();
export const submitFields = vi.fn();

// "delete" is a reserved word, so it is exported under an alias.
const deleteRecord = vi.fn();

export { deleteRecord as delete };
