import { vi } from 'vitest';

export const create = vi.fn((options: { name: string; message: string }) =>
  Object.assign(new Error(options.message), options),
);
