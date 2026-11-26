/**
 * A tool call's arguments, checked against the input schema the tool declares.
 *
 * The manifests use a small part of JSON Schema: `type` (object, string, number,
 * integer, boolean, array), `properties`, `required`, `items`, `minItems`,
 * `maxItems` and `enum`. This checks those and nothing else. A key the schema
 * does not name is left alone, as JSON Schema leaves it; the tool's own
 * validator still judges what is inside a recipe, a scene or a spec.
 */

const MAX_ISSUES = 20;

function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matches(type, value) {
  switch (type) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    default:
      return true;
  }
}

function check(schema, value, at, issues) {
  if (!schema || typeof schema !== 'object' || issues.length >= MAX_ISSUES) return;
  if (typeof schema.type === 'string' && !matches(schema.type, value)) {
    const article = /^[aeiou]/.test(schema.type) ? 'an' : 'a';
    // A number that is not the kind of number asked for is shown as it is (1.5, NaN).
    const got =
      typeof value === 'number' && /number|integer/.test(schema.type) ? value : kindOf(value);
    issues.push(`${at}: expected ${article} ${schema.type}, got ${got}`);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value))
    issues.push(`${at}: expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems)
      issues.push(`${at}: needs at least ${schema.minItems} items, got ${value.length}`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems)
      issues.push(`${at}: takes at most ${schema.maxItems} items, got ${value.length}`);
    if (schema.items)
      for (let i = 0; i < value.length && issues.length < MAX_ISSUES; i++)
        check(schema.items, value[i], `${at}[${i}]`, issues);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const name of Array.isArray(schema.required) ? schema.required : [])
    if (!Object.hasOwn(value, name) || value[name] === undefined)
      issues.push(`${at}.${name}: required`);
  for (const [name, property] of Object.entries(schema.properties || {}))
    if (Object.hasOwn(value, name) && value[name] !== undefined)
      check(property, value[name], `${at}.${name}`, issues);
}

/** The ways `value` does not fit `schema`, one line each; empty when it fits. */
export function validateToolArguments(schema, value, at = 'arguments') {
  const issues = [];
  check(schema, value, at, issues);
  return issues;
}

/** Throws one error that names every way the arguments do not fit the tool's schema. */
export function assertToolArguments(tool, value) {
  const issues = validateToolArguments(tool.inputSchema, value);
  if (issues.length)
    throw Error(`${tool.name}: the arguments do not fit its input schema: ${issues.join('; ')}`);
}
