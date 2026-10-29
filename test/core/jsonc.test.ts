import { describe, expect, it } from 'vitest';
import { parseJsonc } from '../../src/core/jsonc.js';

describe('parseJsonc', () => {
  it('strips line and block comments', () => {
    const text = `{
      // line comment
      "a": 1, /* block */ "b": /* inline */ 2
    }`;
    expect(parseJsonc(text)).toEqual({ a: 1, b: 2 });
  });

  it('removes trailing commas in objects and arrays', () => {
    expect(parseJsonc('{ "a": [1, 2, ], "b": { "c": 3, }, }')).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it('keeps comment-like and comma-like text inside strings', () => {
    const text = '{ "url": "https://x.com/a", "glob": "src/**/*.ts", "odd": "a,}", "quote": "say \\"hi\\" // no" }';
    expect(parseJsonc(text)).toEqual({ url: 'https://x.com/a', glob: 'src/**/*.ts', odd: 'a,}', quote: 'say "hi" // no' });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonc('{ "a": }')).toThrow();
  });
});
