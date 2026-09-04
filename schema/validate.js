/**
 * schema/validate.js — minimal JSON Schema validator.
 *
 * Plumbing, not an architecture module. It exists so Module 1's output can be
 * checked against schema/itinerary_schema.json without pulling in ajv — the
 * schema uses a small, fixed subset of draft 2020-12 (type, required,
 * properties, additionalProperties, items, minimum, minLength, pattern), and a
 * ~90-line validator beats a dependency for a 6-day class prototype.
 *
 * Returns every error rather than the first, so a failing Stage 6 test case
 * shows the whole picture in one pass.
 */

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function checkType(value, expected) {
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'null') return value === null;
  return typeof value === expected;
}

function walk(value, schema, path, errors) {
  if (schema.type && !checkType(value, schema.type)) {
    errors.push(`${path}: expected ${schema.type}, got ${typeOf(value)}`);
    return; // Type is wrong; deeper checks would only add noise.
  }

  if (schema.type === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) {
          errors.push(`${path}: unexpected property "${key}" (additionalProperties is false)`);
        }
      }
    }
    for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) walk(value[key], subSchema, `${path}/${key}`, errors);
    }
  }

  if (schema.type === 'array' && schema.items) {
    value.forEach((item, i) => walk(item, schema.items, `${path}[${i}]`, errors));
  }

  if (schema.type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: "${value}" does not match pattern ${schema.pattern}`);
    }
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} is below minimum ${schema.minimum}`);
    }
  }
}

/**
 * @param {unknown} data   Parsed JSON to check.
 * @param {object} schema  Parsed JSON Schema.
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validate(data, schema) {
  const errors = [];
  walk(data, schema, '$', errors);
  return { valid: errors.length === 0, errors };
}
