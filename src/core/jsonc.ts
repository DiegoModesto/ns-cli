/** Parses JSON with comments and trailing commas (tsconfig.json style). */
export function parseJsonc<T = unknown>(text: string): T {
  return JSON.parse(stripTrailingCommas(stripComments(text))) as T;
}

/** Calls `visit` for every character outside string literals; string contents are copied as-is. */
function transformOutsideStrings(text: string, visit: (index: number) => { output: string; skip: number }): string {
  let output = '';
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inString) {
      output += char;
      if (char === '\\') {
        output += text[i + 1] ?? '';
        i++;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    const result = visit(i);
    output += result.output;
    i += result.skip;
  }

  return output;
}

function stripComments(text: string): string {
  return transformOutsideStrings(text, (i) => {
    if (text[i] === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      return { output: '\n', skip: (end === -1 ? text.length : end) - i };
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      return { output: ' ', skip: (end === -1 ? text.length : end + 2) - i - 1 };
    }
    return { output: text[i]!, skip: 0 };
  });
}

function stripTrailingCommas(text: string): string {
  return transformOutsideStrings(text, (i) => {
    if (text[i] === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) {
      return { output: '', skip: 0 };
    }
    return { output: text[i]!, skip: 0 };
  });
}
