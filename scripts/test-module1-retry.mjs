#!/usr/bin/env node
/**
 * scripts/test-module1-retry.mjs
 *
 * Standalone check for Module 1's structured-output + bounded-retry path.
 *   node scripts/test-module1-retry.mjs
 *
 * Stubs globalThis.fetch before importing server.mjs, so it exercises the REAL
 * server pipeline end-to-end over HTTP and makes ZERO API calls. It asserts the
 * retry is capped at MAX_RETRIES = 1 - i.e. at most two Module 1 calls, never
 * an unbounded loop against a metered API.
 */
import assert from 'node:assert/strict';

const PORT = 39117;
process.env.PORT = String(PORT);
process.env.GEMINI_API_KEY = 'MOCK-KEY-NOT-REAL';
process.env.GEMINI_MODEL_ID = 'gemini-3.8-flash';

const VALID = {
  days: [{ day: 1, stops: [
    { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: '09:00', end_time: '10:30', is_dining: false },
    { name: 'Sankyu Halal Japanese Food Asakusa', ward_or_city: 'Asakusa', start_time: '12:00', end_time: '13:00', is_dining: true }
  ] }],
  transit_segments: [{ from_station: 'Asakusa', to_station: 'Asakusa', mode: 'Walking', day: 1, order: 1 }],
  missing_info: []
};

// Each scenario supplies the Module 1 replies in order.
let module1Replies = [];
let module1Calls = [];
let module2Calls = 0;

// Keep the real fetch: this script uses it to drive the server over HTTP.
// Without this the stub would swallow our own requests and they would never
// reach the pipeline under test.
const realFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (url, init) => {
  if (String(url).includes(`localhost:${PORT}`)) return realFetch(url, init);
  const body = JSON.parse(init.body);
  const text = body.contents?.[0]?.parts?.[0]?.text ?? '';

  if (text.includes('<audit_result>')) {
    module2Calls += 1;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"verdict":"DO NOT BUY","headline":"x","explanation":"y","caveats":[],"evidence":[]}' }] } }] }) };
  }

  module1Calls.push({ prompt: text, generationConfig: body.generationConfig });
  const reply = module1Replies.shift() ?? '(exhausted)';
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
};

await import('../server.mjs');
await new Promise((r) => setTimeout(r, 300));

const REQUEST = {
  mode: 'live', start: '2026-10-01', end: '2026-10-02',
  arrival_time: '08:00', departure_time: '19:00',
  arrival_airport: 'HND', departure_airport: 'HND',
  dietary: 'halal', pace: 'moderate', preferences: ''
};

async function scenario(name, replies, check) {
  module1Replies = [...replies];
  module1Calls = [];
  module2Calls = 0;
  const res = await realFetch(`http://localhost:${PORT}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(REQUEST)
  });
  const json = await res.json();
  try {
    check(json, module1Calls);
    console.log(`  PASS  ${name}`);
    return true;
  } catch (error) {
    console.log(`  FAIL  ${name}\n        ${error.message}`);
    return false;
  }
}

console.log('\nModule 1 structured output + bounded retry\n');
const results = [];

results.push(await scenario(
  'JSON mode and responseSchema are sent on the Module 1 call',
  [JSON.stringify(VALID)],
  (json, calls) => {
    assert.equal(calls.length, 1);
    assert.equal(calls[0].generationConfig.responseMimeType, 'application/json');
    assert.ok(calls[0].generationConfig.responseSchema, 'responseSchema missing');
    assert.equal(calls[0].generationConfig.temperature, 0, 'temperature must stay 0');
    assert.deepEqual(
      calls[0].generationConfig.responseSchema.required,
      ['days', 'transit_segments', 'missing_info']
    );
  }
));

results.push(await scenario(
  'curated venues and canonical areas are injected into the prompt',
  [JSON.stringify(VALID)],
  (json, calls) => {
    const p = calls[0].prompt;
    assert.ok(p.includes('Ain Soph. Journey Shinjuku'), 'newly added venue not injected');
    assert.ok(p.includes('Sankyu Halal Japanese Food Asakusa'), 'existing venue not injected');
    assert.ok(/- Asakusa\n/.test(p), 'canonical area list not injected');
    assert.ok(p.includes('Do NOT use administrative ward names'), 'vocabulary rule missing');
    assert.ok(!/\{\{/.test(p), 'unfilled template slot left in prompt');
  }
));

results.push(await scenario(
  'a valid first response does NOT trigger a retry',
  [JSON.stringify(VALID)],
  (json, calls) => {
    assert.equal(calls.length, 1, 'expected exactly one Module 1 call');
    assert.notEqual(json.stage, 'module1');
  }
));

results.push(await scenario(
  'a fenced response is recovered locally, still without a retry',
  ['```json\n' + JSON.stringify(VALID) + '\n```'],
  (json, calls) => {
    assert.equal(calls.length, 1, 'markdown fence must be repaired locally, not by a retry');
    assert.notEqual(json.stage, 'module1');
  }
));

results.push(await scenario(
  'an unparseable first response triggers exactly one retry, and recovers',
  ['I cannot produce that.', JSON.stringify(VALID)],
  (json, calls) => {
    assert.equal(calls.length, 2, 'expected exactly two Module 1 calls');
    assert.ok(
      calls[1].prompt.includes('Error: Your output was invalid JSON.'),
      'retry prompt must name the failure'
    );
    assert.ok(
      calls[1].prompt.includes('Rewrite your exact response as valid JSON.'),
      'retry prompt must ask for a rewrite'
    );
    assert.notEqual(json.stage, 'module1', 'the retry should have recovered the run');
  }
));

results.push(await scenario(
  'GUARDRAIL: two bad responses stop at two calls, never a third',
  ['still not json', 'nope, prose again', JSON.stringify(VALID)],
  (json, calls) => {
    assert.equal(calls.length, 2, `MAX_RETRIES=1 breached: ${calls.length} calls`);
    assert.equal(json.ok, false);
    assert.equal(json.stage, 'module1');
    assert.equal(json.metadata.module1Attempts, 2);
    assert.match(json.error, /after 2 attempt\(s\)/);
  }
));

results.push(await scenario(
  'schema-invalid JSON also triggers the repair path, then gives up',
  [
    JSON.stringify({ days: [{ day: 1, stops: [{ name: 'X', ward_or_city: 'Asakusa', start_time: '9am', end_time: '10:00', is_dining: false }] }], transit_segments: [], missing_info: [] }),
    JSON.stringify({ days: [{ day: 1, stops: [{ name: 'X', ward_or_city: 'Asakusa', start_time: '9am', end_time: '10:00', is_dining: false }] }], transit_segments: [], missing_info: [] })
  ],
  (json, calls) => {
    assert.equal(calls.length, 2, 'schema violation should spend the one retry, no more');
    assert.ok(
      calls[1].prompt.includes('Schema validation failed'),
      'retry prompt must carry the validation error'
    );
    assert.equal(json.stage, 'module1');
  }
));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
