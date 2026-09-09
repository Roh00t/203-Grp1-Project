/**
 * calculator.test.js — unit tests for the Module 2 fare calculator.
 * Run with: npm test   (Node's built-in runner; no test framework dependency)
 *
 * Fixture numbers are structural, not authoritative — see fixtures/test_fares.json.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  sumFares,
  applyPassSupplements,
  auditPassDecision,
  findFare,
  MissingFareError,
  AmbiguousFareError,
  MissingSupplementDataError
} from './calculator.js';

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/test_fares.json', import.meta.url)), 'utf8')
);

const FARES_AS_BRIEFED = fixture.fares_as_briefed;
const FARES_WITH_SUPPLEMENTS = fixture.fares_with_placeholder_supplements;
const JR_PASS = fixture.passes[0];
const TOKYO_KYOTO = fixture.itineraries.tokyo_kyoto_round_trip;
const TOKYO_HIROSHIMA = fixture.itineraries.tokyo_hiroshima_round_trip_nozomi;
const PLACEHOLDER_SUPPLEMENT = 9999;

// ---------------------------------------------------------------------------
// sumFares
// ---------------------------------------------------------------------------

test('sumFares: Tokyo<->Kyoto round trip sums to the briefed ticket total', () => {
  assert.equal(sumFares(TOKYO_KYOTO, FARES_AS_BRIEFED), 27940);
});

test('sumFares: Tokyo<->Hiroshima round trip sums to the briefed ticket total', () => {
  assert.equal(sumFares(TOKYO_HIROSHIMA, FARES_AS_BRIEFED), 36760);
});

test('sumFares: empty itinerary costs nothing', () => {
  assert.equal(sumFares([], FARES_AS_BRIEFED), 0);
});

test('sumFares: never folds a pass supplement into the ticket side', () => {
  // Supplements exist only on the pass side. Same segments, two fare tables,
  // one of which carries supplement_yen — the ticket total must not move.
  assert.equal(
    sumFares(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS),
    sumFares(TOKYO_HIROSHIMA, FARES_AS_BRIEFED)
  );
});

test('sumFares: throws on a segment the fare table does not price', () => {
  const unpriced = [{ from_station: 'Tokyo', to_station: 'Sapporo', mode: 'shinkansen' }];
  assert.throws(() => sumFares(unpriced, FARES_AS_BRIEFED), MissingFareError);
});

test('REGRESSION (TC05/TC12): a hyphenated station name matches its spaced fare row', () => {
  const rows = [{ from: 'Namba', to: 'Kansai Airport', service_type: 'Nankai', price_yen: 1410 }];
  assert.equal(
    findFare({ from_station: 'Namba', to_station: 'Kansai-Airport', mode: 'Nankai' }, rows).price_yen,
    1410
  );
});

test('REGRESSION (TC05/TC12): hyphenated names stay distinct where they should', () => {
  const rows = [{ from: 'Shin-Osaka', to: 'Hiroshima', service_type: 'Sakura', price_yen: 10220 }];
  assert.equal(
    findFare({ from_station: 'Shin Osaka', to_station: 'Hiroshima', mode: 'Sakura' }, rows).price_yen,
    10220
  );
  assert.throws(
    () => findFare({ from_station: 'Osaka', to_station: 'Hiroshima', mode: 'Sakura' }, rows),
    MissingFareError
  );
});

test('findFare: refuses to guess when two rows match and the segment is silent', () => {
  const twoServices = [
    { from: 'Tokyo', to: 'Kyoto', service_type: 'Hikari', price_yen: 13970 },
    { from: 'Tokyo', to: 'Kyoto', service_type: 'Nozomi', price_yen: 14170 }
  ];
  assert.throws(
    () => findFare({ from_station: 'Tokyo', to_station: 'Kyoto' }, twoServices),
    AmbiguousFareError
  );
  // ...but uses service_type to disambiguate when the segment supplies it.
  assert.equal(
    findFare({ from_station: 'Tokyo', to_station: 'Kyoto', service_type: 'Nozomi' }, twoServices)
      .price_yen,
    14170
  );
});

// ---------------------------------------------------------------------------
// applyPassSupplements — EDGE CASE A: zero Nozomi/Mizuho segments
// ---------------------------------------------------------------------------

test('applyPassSupplements: itinerary with NO Nozomi/Mizuho segments owes nothing', () => {
  const result = applyPassSupplements(TOKYO_KYOTO, FARES_WITH_SUPPLEMENTS, JR_PASS);
  assert.equal(result.total_supplement_yen, 0);
  assert.equal(result.per_segment.length, 2);
  assert.deepEqual(
    result.per_segment.map((s) => s.service_type),
    ['Hikari', 'Hikari']
  );
  assert.ok(result.per_segment.every((s) => s.supplement_yen === 0));
});

test('applyPassSupplements: a Hikari-only itinerary needs no supplement data at all', () => {
  // FARES_AS_BRIEFED has no supplement_yen anywhere. That must not matter when
  // no segment uses a service requiring one.
  assert.doesNotThrow(() => applyPassSupplements(TOKYO_KYOTO, FARES_AS_BRIEFED, JR_PASS));
});

// ---------------------------------------------------------------------------
// applyPassSupplements — EDGE CASE B: at least one Nozomi/Mizuho segment
// ---------------------------------------------------------------------------

test('applyPassSupplements: charges a supplement per Nozomi segment, not once per trip', () => {
  const result = applyPassSupplements(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, JR_PASS);
  assert.equal(result.per_segment.length, 2);
  assert.equal(result.total_supplement_yen, PLACEHOLDER_SUPPLEMENT * 2);
  assert.ok(
    result.per_segment.every((s) => s.supplement_yen === PLACEHOLDER_SUPPLEMENT),
    'both legs of a Nozomi round trip owe a supplement'
  );
});

test('applyPassSupplements: mixed itinerary charges only the Nozomi legs', () => {
  const mixed = [...TOKYO_KYOTO, ...TOKYO_HIROSHIMA];
  const result = applyPassSupplements(mixed, FARES_WITH_SUPPLEMENTS, JR_PASS);
  assert.equal(result.total_supplement_yen, PLACEHOLDER_SUPPLEMENT * 2);
  assert.deepEqual(
    result.per_segment.map((s) => s.supplement_yen),
    [0, 0, PLACEHOLDER_SUPPLEMENT, PLACEHOLDER_SUPPLEMENT]
  );
});

test('applyPassSupplements: a pass that covers Nozomi owes no supplement', () => {
  const result = applyPassSupplements(
    TOKYO_HIROSHIMA,
    FARES_WITH_SUPPLEMENTS,
    fixture.synthetic_covering_pass
  );
  assert.equal(result.total_supplement_yen, 0);
});

test('applyPassSupplements: throws when a Nozomi segment has no supplement figure', () => {
  // This is the production path today: the briefed fare table has no
  // supplement_yen, and the supplement schedule is still TBD. Refusing beats
  // returning a verdict built on an incomplete comparison.
  assert.throws(
    () => applyPassSupplements(TOKYO_HIROSHIMA, FARES_AS_BRIEFED, JR_PASS),
    MissingSupplementDataError
  );
});

test('applyPassSupplements: rejects a bare pass name string', () => {
  assert.throws(
    () => applyPassSupplements(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, 'JR Pass 7-day Ordinary'),
    TypeError
  );
});

// ---------------------------------------------------------------------------
// auditPassDecision — the two briefed test cases
// ---------------------------------------------------------------------------

test('TEST CASE 1 (no Nozomi): Tokyo<->Kyoto -> DO NOT BUY', () => {
  const result = auditPassDecision(TOKYO_KYOTO, FARES_WITH_SUPPLEMENTS, [JR_PASS]);

  assert.equal(result.recommendation, 'DO NOT BUY');
  assert.equal(result.ticket_total, 27940);
  assert.equal(result.pass_price, 50000); // no Nozomi, so all-in == base price
  assert.equal(result.difference, 22060); // pass_price - ticket_total, positive = pass costs more
  assert.equal(result.per_segment_breakdown.length, 2);
  assert.ok(result.per_segment_breakdown.every((s) => s.pass_supplement_yen === 0));
});

test('TEST CASE 2 (Nozomi present): Tokyo<->Hiroshima pass side INCLUDES supplements', () => {
  const result = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [JR_PASS]);

  assert.equal(result.ticket_total, 36760);

  // The load-bearing assertion. If applyPassSupplements were unwired,
  // pass_price would be a flat 50000 and this fails loudly rather than
  // passing quietly on an incomplete comparison.
  assert.notEqual(result.pass_price, 50000, 'pass_price must not be the flat pass price');
  assert.equal(result.pass_price, 50000 + PLACEHOLDER_SUPPLEMENT * 2);
  assert.equal(result.difference, result.pass_price - result.ticket_total);
  assert.equal(result.recommendation, 'DO NOT BUY');

  assert.deepEqual(
    result.per_segment_breakdown.map((s) => s.pass_supplement_yen),
    [PLACEHOLDER_SUPPLEMENT, PLACEHOLDER_SUPPLEMENT]
  );
});

test('REGRESSION: supplements flip BUY -> DO NOT BUY on a Nozomi itinerary', () => {
  // The strongest guard for the Architecture.md Stage 3 correctness requirement.
  // Base 34000 < tickets 36760, so ignoring supplements yields BUY. Adding the
  // supplements makes the pass genuinely more expensive, so the honest verdict
  // is DO NOT BUY. Any regression that drops supplements changes the ADVICE,
  // not just a number.
  const pass = fixture.synthetic_cheap_pass;
  const result = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [pass]);

  assert.ok(pass.price_yen < result.ticket_total, 'precondition: flat price alone would say BUY');
  assert.equal(result.pass_price, 34000 + PLACEHOLDER_SUPPLEMENT * 2);
  assert.equal(result.recommendation, 'DO NOT BUY');
});

test('auditPassDecision: recommends BUY when the all-in pass genuinely undercuts tickets', () => {
  const cheapCoveringPass = {
    name: 'SYNTHETIC cheap covering pass',
    price_yen: 20000,
    covers_nozomi: true
  };
  const result = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [cheapCoveringPass]);
  assert.equal(result.recommendation, 'BUY');
  assert.equal(result.pass_price, 20000);
  assert.equal(result.difference, 20000 - 36760);
  assert.ok(result.difference < 0, 'negative difference means the pass saves money');
});

test('auditPassDecision: an exact tie is DO NOT BUY', () => {
  const tiePass = { name: 'SYNTHETIC tie pass', price_yen: 27940, covers_nozomi: false };
  const result = auditPassDecision(TOKYO_KYOTO, FARES_WITH_SUPPLEMENTS, [tiePass]);
  assert.equal(result.difference, 0);
  assert.equal(result.recommendation, 'DO NOT BUY');
});

test('auditPassDecision: with several passes, audits the cheapest ALL-IN one', () => {
  // JR Pass is cheaper on sticker price (50000 vs 55000) but the rival covers
  // Nozomi. All-in: 50000 + 19998 = 69998 vs 55000. The rival must win.
  const rival = { name: 'SYNTHETIC rival pass', price_yen: 55000, covers_nozomi: true };
  const result = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [JR_PASS, rival]);
  assert.equal(result.pass_price, 55000);
  assert.ok(result.per_segment_breakdown.every((s) => s.pass_supplement_yen === 0));
});

test('auditPassDecision: propagates missing supplement data instead of skipping the pass', () => {
  assert.throws(
    () => auditPassDecision(TOKYO_HIROSHIMA, FARES_AS_BRIEFED, [JR_PASS]),
    MissingSupplementDataError
  );
});

// ---------------------------------------------------------------------------
// Output schema — Architecture.md Stage 3 / Stage 6
// ---------------------------------------------------------------------------

test('auditPassDecision: returns exactly the Stage 3 output keys, no more', () => {
  const result = auditPassDecision(TOKYO_KYOTO, FARES_WITH_SUPPLEMENTS, [JR_PASS]);
  assert.deepEqual(Object.keys(result).sort(), [
    'difference',
    'evidence',
    'pass_price',
    'per_segment_breakdown',
    'recommendation',
    'ticket_total'
  ]);
});

test('auditPassDecision: every evidence entry has the Stage 6 claim/source_id/source_date shape', () => {
  const result = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [JR_PASS]);
  assert.ok(result.evidence.length > 0);
  for (const e of result.evidence) {
    assert.deepEqual(Object.keys(e).sort(), ['claim', 'source_date', 'source_id']);
    assert.equal(typeof e.claim, 'string');
    assert.ok(e.claim.length > 0);
  }
});

test('auditPassDecision: an unsourced fare yields a NULL pointer, never an invented one', () => {
  // Faithfulness must measure the gap, not paper over it. FARES_AS_BRIEFED has
  // no source_id/source_date, so those claims must come back null and be
  // counted as unpointed by the Stage 6 metric.
  const result = auditPassDecision(TOKYO_KYOTO, FARES_AS_BRIEFED, [JR_PASS]);
  const fareClaims = result.evidence.filter((e) => e.claim.includes('Hikari'));
  assert.ok(fareClaims.length > 0);
  assert.ok(fareClaims.every((e) => e.source_id === null && e.source_date === null));
});

test('auditPassDecision: every numeric claim in the result is covered by evidence', () => {
  const result = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [JR_PASS]);
  const claims = result.evidence.map((e) => e.claim).join(' | ');
  assert.match(claims, /36760 yen/);           // ticket total
  assert.match(claims, /50000 yen/);           // pass base price
  assert.match(claims, /9999 yen supplement/); // each supplement
});

// ---------------------------------------------------------------------------
// Determinism — Stage 6 requires a fair A/B/C comparison
// ---------------------------------------------------------------------------

test('auditPassDecision: is deterministic and does not mutate its inputs', () => {
  const segmentsBefore = JSON.stringify(TOKYO_HIROSHIMA);
  const faresBefore = JSON.stringify(FARES_WITH_SUPPLEMENTS);

  const a = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [JR_PASS]);
  const b = auditPassDecision(TOKYO_HIROSHIMA, FARES_WITH_SUPPLEMENTS, [JR_PASS]);

  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(TOKYO_HIROSHIMA), segmentsBefore);
  assert.equal(JSON.stringify(FARES_WITH_SUPPLEMENTS), faresBefore);
});

test('assertYen: rejects a non-integer fare rather than silently rounding', () => {
  const badTable = [{ from: 'Tokyo', to: 'Kyoto', service_type: 'Hikari', price_yen: 13970.5 }];
  assert.throws(
    () => sumFares([{ from_station: 'Tokyo', to_station: 'Kyoto' }], badTable),
    TypeError
  );
});
