/**
 * Parses JSON text and remembers the line each value starts on, so a check
 * can say `file:line` for a path such as `cameraPath[3].time` or
 * `budget.gpuMaxMs`. Throws the same errors as JSON.parse, with the line.
 */
export function parseJsonWithLines(text) {
  const lines = new Map();
  let i = 0,
    line = 1;
  const fail = (message) => {
    throw new SyntaxError(`${message} at line ${line}`);
  };
  const space = () => {
    while (i < text.length && ' \t\r\n'.includes(text[i])) {
      if (text[i] === '\n') line++;
      i++;
    }
  };
  const value = (path) => {
    space();
    lines.set(path, line);
    const c = text[i];
    if (c === '{') {
      i++;
      const object = {};
      space();
      if (text[i] === '}') return (i++, object);
      for (;;) {
        space();
        if (text[i] !== '"') fail('Expected a key');
        const key = string();
        space();
        if (text[i++] !== ':') fail('Expected :');
        object[key] = value(path ? `${path}.${key}` : key);
        space();
        if (text[i] === ',') i++;
        else if (text[i] === '}') return (i++, object);
        else fail('Expected , or }');
      }
    }
    if (c === '[') {
      i++;
      const array = [];
      space();
      if (text[i] === ']') return (i++, array);
      for (;;) {
        array.push(value(`${path}[${array.length}]`));
        space();
        if (text[i] === ',') i++;
        else if (text[i] === ']') return (i++, array);
        else fail('Expected , or ]');
      }
    }
    if (c === '"') return string();
    const match = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
    if (!match) fail('Unexpected character');
    i += match[0].length;
    return JSON.parse(match[0]);
  };
  const string = () => {
    const start = i;
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\n') fail('Line break in a string');
      i += text[i] === '\\' ? 2 : 1;
    }
    if (i >= text.length) fail('Unterminated string');
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const data = value('');
  space();
  if (i < text.length) fail('Text after the value');
  /** The line of `path`, or of its nearest parent that has one. */
  const lineOf = (path) => {
    let p = path;
    for (;;) {
      if (lines.has(p)) return lines.get(p);
      const cut = Math.max(p.lastIndexOf('.'), p.lastIndexOf('['));
      if (cut <= 0) return lines.get('') ?? 1;
      p = p.slice(0, cut);
    }
  };
  return { data, lineOf };
}
