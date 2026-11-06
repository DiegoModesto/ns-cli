import { vi } from 'vitest';

export const create = vi.fn((options) => Object.assign(new Error(options.message), options));
