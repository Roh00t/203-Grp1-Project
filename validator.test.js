/**
 * validator.test.js — unit tests for the Constraint Validator.
 * Run with: npm test
 *
 * Fixture data is structural only — see the __WARNING__ banners in
 * fixtures/test_dietary.json and fixtures/test_travel_times.json.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  normalizeKey,
  checkDietaryCompliance,
  checkGeographicFeasibility,
  validateItinerary,
  collectFailureLog,
  buildDietaryIndex,
  buildTravelTimeIndex,
  COMPLIANT,
  NON_COMPLIANT,
  UNVERIFIED
} from './validator.js';

const load = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));

const DIETARY = load('test_dietary.json').dietary;
const TRAVEL = load('test_travel_times.json').travel_times;

const dining = (name, ward_or_city, times = {}) => ({
  name,
  ward_or_city,
  is_dining: true,
  start_time: '12:00',
  end_time: '13:00',
  ...times
});

// ---------------------------------------------------------------------------
// normalizeKey
// ---------------------------------------------------------------------------

test('normalizeKey: lowercases, trims, strips punctuation, collapses whitespace', () => {
  assert.equal(normalizeKey('  Sushi Zanmai Asakusa  '), 'sushi zanmai asakusa');
  assert.equal(normalizeKey('SUSHI ZANMAI ASAKUSA'), 'sushi zanmai asakusa');
  assert.equal(normalizeKey('Sushi  Zanmai   Asakusa'), 'sushi zanmai asakusa');
  assert.equal(normalizeKey("T's TanTan"), 't s tantan');
  assert.equal(normalizeKey('Ginza (Chuo)'), 'ginza chuo');
});

test('normalizeKey: treats punctuation as a separator, never joins across it', () => {
  // "shinosaka" appears in neither string, so deleting the hyphen would invent a token.
  assert.equal(normalizeKey('Shin-Osaka'), 'shin osaka');
  assert.equal(normalizeKey('Shin Osaka'), 'shin osaka');
});

test('normalizeKey: macron and non-macron romanizations converge', () => {
  // Architecture.md locked: every place name here is a romanized Japanese
  // term, so macron variance is the expected case, not an edge case.
  const pairs = [
    ['T\u014dky\u014d', 'Tokyo'],
    ['\u014csaka', 'Osaka'],
    ['Ky\u014dto', 'Kyoto'],
    ['Ry\u014dgoku', 'Ryogoku'],
    ['K\u014denji', 'Koenji']
  ];
  for (const [withMacron, without] of pairs) {
    assert.equal(
      normalizeKey(withMacron),
      normalizeKey(without),
      `${withMacron} should normalize the same as ${without}`
    );
  }
  assert.equal(normalizeKey('T\u014dky\u014d'), 'tokyo');
});

test('normalizeKey: applies NFKC, so full-width and half-width converge', () => {
  assert.equal(normalizeKey('\uff34\uff4f\uff4b\uff59\uff4f'), normalizeKey('Tokyo'));
});

test('normalizeKey: strips only Latin diacritics, never kana voiced-sound marks', () => {
  // The trap: under NFD, \u304c (ga) decomposes to \u304b + \u3099. A blanket
  // strip of all combining marks would rewrite it to \u304b (ka) and silently
  // change the word. U+3099/U+309A sit outside the Latin block we strip.
  for (const [voiced, plain] of [['\u304c', '\u304b'], ['\u3071', '\u306f'], ['\u3058', '\u3057']]) {
    assert.notEqual(
      normalizeKey(voiced),
      normalizeKey(plain),
      `${voiced} must not fold into ${plain}`
    );
  }
  assert.equal(normalizeKey('\u304c\u3063\u3053\u3046'), '\u304c\u3063\u3053\u3046');
});

test('normalizeKey: a macron variant now MATCHES where it once resolved to unverified', () => {
  // End-to-end proof of the change, through a real lookup rather than the
  // normalizer alone. "Ky\u014dto" is not a literal string in the table.
  const table = [
    { venue_name: 'Nishiki Market', ward: 'Kyoto', tags: ['vegan'], source_id: 't', source_date: '2026-09-04' }
  ];
  const [result] = checkDietaryCompliance(
    [{ name: 'Nishiki Market', ward_or_city: 'Ky\u014dto', is_dining: true }],
    table,
    ['vegan']
  );
  assert.equal(result.status, COMPLIANT);
  assert.notEqual(result.status, UNVERIFIED, 'macron variance must no longer force unverified');
});

test('normalizeKey: macron folding works on the geographic side too', () => {
  const table = [
    { ward_a: 'Tokyo', ward_b: 'Osaka', estimated_transit_minutes: 150, mode: 'shinkansen',
      source_id: 't', source_date: '2026-09-04' }
  ];
  const days = [
    {
      day: 1,
      stops: [
        { name: 'A', ward_or_city: 'T\u014dky\u014d', start_time: '09:00', end_time: '10:00' },
        { name: 'B', ward_or_city: '\u014csaka', start_time: '12:30', end_time: '13:00' }
      ]
    }
  ];
  const [result] = checkGeographicFeasibility(days, [], table);
  assert.equal(result.status, COMPLIANT);
  assert.equal(result.required_minutes, 150);
});

test('normalizeKey: folding a macron does NOT make matching fuzzy', () => {
  // A genuinely different name is still unverified — this is a deterministic
  // character fold, not a similarity score.
  const [result] = checkDietaryCompliance(
    [dining('Sushi Zanmai Asakus\u014d', 'Asakusa')],
    DIETARY,
    ['halal']
  );
  assert.equal(result.status, UNVERIFIED);
});

test('normalizeKey: preserves Japanese characters', () => {
  assert.equal(normalizeKey('浅草寺'), '浅草寺');
  assert.equal(normalizeKey('  浅草寺 '), '浅草寺');
});

test('normalizeKey: handles null, undefined and non-strings without throwing', () => {
  assert.equal(normalizeKey(null), '');
  assert.equal(normalizeKey(undefined), '');
  assert.equal(normalizeKey(''), '');
  assert.equal(normalizeKey(42), '42');
});

test('normalizeKey: is idempotent', () => {
  const once = normalizeKey('  Sushi Zanmai, Asakusa!  ');
  assert.equal(normalizeKey(once), once);
});

// ---------------------------------------------------------------------------
// TEST CASE A — exact match, compliant
// ---------------------------------------------------------------------------

test('CASE A: exact match with a satisfied constraint is compliant', () => {
  const results = checkDietaryCompliance(
    [dining('Sushi Zanmai Asakusa', 'Asakusa')],
    DIETARY,
    ['halal']
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].status, COMPLIANT);
  assert.deepEqual(results[0].venue_tags, ['halal']);
  assert.deepEqual(results[0].missing_tags, []);
  assert.equal(results[0].source_id, 'test-fixture');
  assert.equal(results[0].source_date, '2026-09-04');
});

test('CASE A variant: casing and spacing differences still match', () => {
  const results = checkDietaryCompliance(
    [dining('  SUSHI   ZANMAI ASAKUSA ', 'asakusa')],
    DIETARY,
    ['halal']
  );
  assert.equal(results[0].status, COMPLIANT);
});

// ---------------------------------------------------------------------------
// Real dietary violation
// ---------------------------------------------------------------------------

test('a matched venue that lacks the required tag is non_compliant, not unverified', () => {
  // Sushi Zanmai Asakusa is halal-tagged; a vegan traveller is a real violation.
  const results = checkDietaryCompliance(
    [dining('Sushi Zanmai Asakusa', 'Asakusa')],
    DIETARY,
    ['vegan']
  );
  assert.equal(results[0].status, NON_COMPLIANT);
  assert.deepEqual(results[0].missing_tags, ['vegan']);
  assert.match(results[0].reason, /do not satisfy required tag/);
});

test('a venue must satisfy EVERY constraint, not just one', () => {
  const results = checkDietaryCompliance(
    [dining('Sushi Zanmai Asakusa', 'Asakusa')],
    DIETARY,
    ['halal', 'vegan']
  );
  assert.equal(results[0].status, NON_COMPLIANT);
  assert.deepEqual(results[0].missing_tags, ['vegan']);
});

test('the right ward is required — same venue name, wrong ward is unverified', () => {
  const results = checkDietaryCompliance(
    [dining('Sushi Zanmai Asakusa', 'Shibuya')],
    DIETARY,
    ['halal']
  );
  assert.equal(results[0].status, UNVERIFIED);
});

// ---------------------------------------------------------------------------
// TEST CASE B — name variant must be unverified, never a false pass or fail
// ---------------------------------------------------------------------------

test('CASE B: a genuine name variant resolves to unverified, not a false pass', () => {
  const results = checkDietaryCompliance(
    [dining('Sushi Zanmai, Asakusa Branch', 'Asakusa')],
    DIETARY,
    ['halal']
  );
  assert.equal(results[0].status, UNVERIFIED);
  assert.notEqual(results[0].status, COMPLIANT, 'must not be a false pass');
  assert.notEqual(results[0].status, NON_COMPLIANT, 'must not be a false fail');
  assert.equal(results[0].venue_tags, null);
  assert.match(results[0].reason, /No dietary table entry matches/);
});

test('CASE B: normalization alone cannot rescue a genuinely different string', () => {
  // Documents WHY case B is unverified: the normalized forms really do differ.
  assert.notEqual(
    normalizeKey('Sushi Zanmai, Asakusa Branch'),
    normalizeKey('Sushi Zanmai Asakusa')
  );
});

test('no fuzzy matching: a near-miss is unverified, however close', () => {
  for (const almost of ['Sushi Zanmai Asakus', 'Sushi Zanmai Asakusaa', 'Sushi Zanmai']) {
    const results = checkDietaryCompliance([dining(almost, 'Asakusa')], DIETARY, ['halal']);
    assert.equal(results[0].status, UNVERIFIED, `"${almost}" must not fuzzy-match`);
  }
});

// ---------------------------------------------------------------------------
// Dining tagging
// ---------------------------------------------------------------------------

test('stops explicitly marked is_dining:false are skipped entirely', () => {
  const results = checkDietaryCompliance(
    [
      { name: 'Senso-ji', ward_or_city: 'Asakusa', is_dining: false },
      dining('Sushi Zanmai Asakusa', 'Asakusa')
    ],
    DIETARY,
    ['halal']
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].stop_name, 'Sushi Zanmai Asakusa');
});

test('a stop with no is_dining flag is unverified, never assumed non-dining', () => {
  const results = checkDietaryCompliance(
    [{ name: 'Senso-ji', ward_or_city: 'Asakusa' }],
    DIETARY,
    ['halal']
  );
  assert.equal(results[0].status, UNVERIFIED);
  assert.match(results[0].reason, /does not declare is_dining/);
});

test('with no dietary constraints, a matched venue is compliant and an unknown one is not', () => {
  const results = checkDietaryCompliance(
    [dining('Sushi Zanmai Asakusa', 'Asakusa'), dining('Nowhere Cafe', 'Asakusa')],
    DIETARY,
    []
  );
  assert.equal(results[0].status, COMPLIANT);
  assert.match(results[0].reason, /no dietary constraints were specified/);
  assert.equal(results[1].status, UNVERIFIED);
});

// ---------------------------------------------------------------------------
// TEST CASE C — geographic boundary
// ---------------------------------------------------------------------------

const geoDay = (gapMinutes) => {
  const start = 10 * 60;
  const depart = start + 60;
  const arrive = depart + gapMinutes;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return [
    {
      day: 1,
      stops: [
        { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: hhmm(start), end_time: hhmm(depart) },
        { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', start_time: hhmm(arrive), end_time: hhmm(arrive + 60) }
      ]
    }
  ];
};

test('CASE C: a gap exactly equal to the required time PASSES (>= not >)', () => {
  const results = checkGeographicFeasibility(geoDay(33), [], TRAVEL);
  assert.equal(results.length, 1);
  assert.equal(results[0].scheduled_gap_minutes, 33);
  assert.equal(results[0].required_minutes, 33);
  assert.equal(results[0].status, COMPLIANT, 'an exact fit is achievable, not a failure');
});

test('CASE C: one minute short is flagged', () => {
  const results = checkGeographicFeasibility(geoDay(32), [], TRAVEL);
  assert.equal(results[0].status, NON_COMPLIANT);
  assert.equal(results[0].scheduled_gap_minutes, 32);
  assert.match(results[0].reason, /short of the required 33 min by 1 min/);
});

test('CASE C: a comfortable gap passes', () => {
  assert.equal(checkGeographicFeasibility(geoDay(90), [], TRAVEL)[0].status, COMPLIANT);
});

test('geographic: an overlapping schedule produces a negative gap and is flagged', () => {
  assert.equal(checkGeographicFeasibility(geoDay(-15), [], TRAVEL)[0].status, NON_COMPLIANT);
});

test('geographic: the travel-time table is symmetric — reversing the pair still matches', () => {
  const reversed = [
    {
      day: 1,
      stops: [
        { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', start_time: '10:00', end_time: '11:00' },
        { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: '11:33', end_time: '12:30' }
      ]
    }
  ];
  const results = checkGeographicFeasibility(reversed, [], TRAVEL);
  assert.equal(results[0].status, COMPLIANT);
  assert.equal(results[0].required_minutes, 33);
});

// ---------------------------------------------------------------------------
// TEST CASE D — unmatched ward pair
// ---------------------------------------------------------------------------

test('CASE D: a ward pair absent from the table is unverified, not a silent pass', () => {
  const days = [
    {
      day: 1,
      stops: [
        { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11:00' },
        { name: 'Tsukiji Market', ward_or_city: 'Ginza', start_time: '11:05', end_time: '12:00' }
      ]
    }
  ];
  const results = checkGeographicFeasibility(days, [], TRAVEL);
  assert.equal(results[0].status, UNVERIFIED);
  assert.notEqual(results[0].status, COMPLIANT, 'a 5-minute gap must never pass unverified');
  assert.equal(results[0].required_minutes, null);
  assert.match(results[0].reason, /No travel-time entry for the ward pair/);
});

test('CASE D: same-ward pairs are unverified unless the table covers them', () => {
  // Documented consequence of the locked rule: Ulfa needs same-ward rows
  // (e.g. Asakusa <-> Asakusa) for within-ward transitions to be verifiable.
  const days = [
    {
      day: 1,
      stops: [
        { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11:00' },
        { name: 'Nakamise Street', ward_or_city: 'Asakusa', start_time: '11:10', end_time: '12:00' }
      ]
    }
  ];
  assert.equal(checkGeographicFeasibility(days, [], TRAVEL)[0].status, UNVERIFIED);
});

test('geographic: an unparseable time is unverified even when the pair is known', () => {
  const days = [
    {
      day: 1,
      stops: [
        { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11am' },
        { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', start_time: '12:00', end_time: '13:00' }
      ]
    }
  ];
  const results = checkGeographicFeasibility(days, [], TRAVEL);
  assert.equal(results[0].status, UNVERIFIED);
  assert.equal(results[0].required_minutes, 33);
  assert.match(results[0].reason, /scheduled gap could not be computed/);
});

// ---------------------------------------------------------------------------
// Pair scoping and mode
// ---------------------------------------------------------------------------

test('geographic: pairs are taken within a day, never across an overnight', () => {
  const days = [
    { day: 1, stops: [{ name: 'A', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '18:00' }] },
    { day: 2, stops: [{ name: 'B', ward_or_city: 'Shibuya', start_time: '09:00', end_time: '10:00' }] }
  ];
  assert.equal(checkGeographicFeasibility(days, [], TRAVEL).length, 0);
});

test('SAME-DAY RULE: a Day-1-to-Day-2 pair inside one stops array is skipped', () => {
  // The case the loop structure alone does not catch: both stops sit in the
  // same `stops` array but carry different `day` values.
  const days = [
    {
      day: 1,
      stops: [
        { name: 'Senso-ji', ward_or_city: 'Asakusa', day: 1,
          start_time: '16:00', end_time: '18:00' },
        { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', day: 2,
          start_time: '09:00', end_time: '10:00' }
      ]
    }
  ];

  const results = checkGeographicFeasibility(days, [], TRAVEL);

  // Skipped entirely: not compliant, not unverified, no result at all.
  assert.equal(results.length, 0, 'a cross-day pair must emit no result');
});

test('SAME-DAY RULE: the overnight gap is never computed as a negative number', () => {
  // Without the rule this pair computes 09:00 - 18:00 = -540 minutes and is
  // flagged non_compliant, penalising an ordinary overnight.
  const days = [
    {
      day: 1,
      stops: [
        { name: 'A', ward_or_city: 'Asakusa', day: 1, start_time: '16:00', end_time: '18:00' },
        { name: 'B', ward_or_city: 'Shibuya', day: 2, start_time: '09:00', end_time: '10:00' }
      ]
    }
  ];
  const results = checkGeographicFeasibility(days, [], TRAVEL);
  assert.equal(results.length, 0);
  assert.equal(
    results.find((r) => r.scheduled_gap_minutes < 0),
    undefined,
    'no negative gap may be produced across a day boundary'
  );
});

test('SAME-DAY RULE: same-day pairs are still compared normally', () => {
  // The rule must not suppress legitimate within-day pairs.
  const days = [
    {
      day: 1,
      stops: [
        { name: 'A', ward_or_city: 'Asakusa', day: 1, start_time: '10:00', end_time: '11:00' },
        { name: 'B', ward_or_city: 'Shibuya', day: 1, start_time: '11:33', end_time: '12:00' }
      ]
    }
  ];
  const results = checkGeographicFeasibility(days, [], TRAVEL);
  assert.equal(results.length, 1);
  assert.equal(results[0].status, COMPLIANT);
  assert.equal(results[0].scheduled_gap_minutes, 33);
});

test('SAME-DAY RULE: stops inheriting the day from their day entry still pair', () => {
  // No explicit `day` on the stops — both inherit day 1, so they compare.
  const days = [
    {
      day: 1,
      stops: [
        { name: 'A', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11:00' },
        { name: 'B', ward_or_city: 'Shibuya', start_time: '11:33', end_time: '12:00' }
      ]
    }
  ];
  assert.equal(checkGeographicFeasibility(days, [], TRAVEL).length, 1);
});

test('SAME-DAY RULE: cross-day pairs stay out of the geographic denominator', () => {
  const itinerary = {
    days: [
      {
        day: 1,
        stops: [
          { name: 'A', ward_or_city: 'Asakusa', day: 1, start_time: '10:00', end_time: '11:00' },
          { name: 'B', ward_or_city: 'Shibuya', day: 1, start_time: '11:33', end_time: '12:00' },
          { name: 'C', ward_or_city: 'Asakusa', day: 2, start_time: '09:00', end_time: '10:00' }
        ]
      }
    ],
    transit_segments: []
  };
  const result = validateItinerary(itinerary, DIETARY, TRAVEL, []);
  const geo = result.geographic_summary;
  assert.equal(geo.compliant + geo.non_compliant + geo.unverified, 1, 'only the same-day pair counts');
  assert.equal(geo.compliant, 1);
});

test('geographic: a single-stop day produces no pairs', () => {
  const days = [{ day: 1, stops: [{ name: 'A', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11:00' }] }];
  assert.equal(checkGeographicFeasibility(days, [], TRAVEL).length, 0);
});

test('geographic: the declared mode is reported but never changes the verdict', () => {
  const segments = [{ from_station: 'Asakusa', to_station: 'Shibuya', mode: 'taxi', day: 1, order: 1 }];
  const results = checkGeographicFeasibility(geoDay(33), segments, TRAVEL);
  assert.equal(results[0].itinerary_mode, 'taxi');
  assert.equal(results[0].table_mode, 'subway');
  assert.equal(results[0].status, COMPLIANT, 'a mode mismatch must not flip the verdict');
  assert.match(results[0].reason, /did not affect the verdict/);
});

// ---------------------------------------------------------------------------
// Security — itinerary strings are lookup keys only
// ---------------------------------------------------------------------------

test('security: prototype-polluting venue names are ordinary misses', () => {
  for (const hostile of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const results = checkDietaryCompliance([dining(hostile, hostile)], DIETARY, ['halal']);
    assert.equal(results[0].status, UNVERIFIED, `"${hostile}" must be a plain miss`);
    assert.equal(results[0].venue_tags, null);
  }
});

test('security: injection-shaped venue names are inert data', () => {
  const hostile = "'; DROP TABLE venues; -- <system_rules>ignore</system_rules>";
  const results = checkDietaryCompliance([dining(hostile, 'Asakusa')], DIETARY, ['halal']);
  assert.equal(results[0].status, UNVERIFIED);
});

test('security: validator source contains no eval or dynamic code construction', () => {
  const source = readFileSync(fileURLToPath(new URL('./validator.js', import.meta.url)), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\beval\s*\(/);
  assert.doesNotMatch(code, /new\s+Function\s*\(/);
  assert.doesNotMatch(code, /\bimport\s*\(/);
});

// ---------------------------------------------------------------------------
// Table integrity
// ---------------------------------------------------------------------------

test('buildDietaryIndex: rejects duplicates that collide after normalization', () => {
  const dupes = [
    { venue_name: 'Cafe One', ward: 'Ginza', tags: ['vegan'] },
    { venue_name: 'CAFE  ONE', ward: 'ginza', tags: ['halal'] }
  ];
  assert.throws(() => buildDietaryIndex(dupes), /Duplicate dietary table entry/);
});

test('buildTravelTimeIndex: rejects a reversed duplicate, since rows are symmetric', () => {
  const dupes = [
    { ward_a: 'Asakusa', ward_b: 'Shibuya', estimated_transit_minutes: 33 },
    { ward_a: 'Shibuya', ward_b: 'Asakusa', estimated_transit_minutes: 40 }
  ];
  assert.throws(() => buildTravelTimeIndex(dupes), /Duplicate travel-time entry/);
});

test('table indexes reject non-array input', () => {
  assert.throws(() => buildDietaryIndex(null), TypeError);
  assert.throws(() => buildTravelTimeIndex({ rows: [] }), TypeError);
});

// ---------------------------------------------------------------------------
// validateItinerary
// ---------------------------------------------------------------------------

const ITINERARY = {
  days: [
    {
      day: 1,
      stops: [
        { name: 'Senso-ji', ward_or_city: 'Asakusa', start_time: '09:00', end_time: '11:00', is_dining: false },
        { name: 'Sushi Zanmai Asakusa', ward_or_city: 'Asakusa', start_time: '11:10', end_time: '12:10', is_dining: true },
        { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', start_time: '12:43', end_time: '14:00', is_dining: false }
      ]
    }
  ],
  transit_segments: [
    { from_station: 'Asakusa', to_station: 'Asakusa', mode: 'walk', day: 1, order: 1 },
    { from_station: 'Asakusa', to_station: 'Shibuya', mode: 'subway', day: 1, order: 2 }
  ],
  missing_info: []
};

test('validateItinerary: returns the result arrays plus three summaries', () => {
  const result = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  assert.deepEqual(Object.keys(result).sort(), [
    'dietary_results',
    'dietary_summary',
    'geographic_results',
    'geographic_summary',
    'summary'
  ]);
  for (const key of ['summary', 'dietary_summary', 'geographic_summary']) {
    assert.deepEqual(
      Object.keys(result[key]).sort(),
      ['compliant', 'non_compliant', 'unverified'],
      `${key} has the wrong shape`
    );
  }
});

test('validateItinerary: summary counts every result across both checks', () => {
  const result = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  const total = result.dietary_results.length + result.geographic_results.length;
  const { compliant, non_compliant, unverified } = result.summary;
  assert.equal(compliant + non_compliant + unverified, total);
});

test('validateItinerary: the worked example scores as expected', () => {
  const result = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);

  // One dining stop, matched and halal-tagged.
  assert.equal(result.dietary_results.length, 1);
  assert.equal(result.dietary_results[0].status, COMPLIANT);

  // Two consecutive pairs: Asakusa->Asakusa (not in table) and
  // Asakusa->Shibuya with a 33-minute gap (exact boundary).
  assert.equal(result.geographic_results.length, 2);
  assert.equal(result.geographic_results[0].status, UNVERIFIED);
  assert.equal(result.geographic_results[1].status, COMPLIANT);
  assert.equal(result.geographic_results[1].scheduled_gap_minutes, 33);
});

test('validateItinerary: scores dietary and geographic independently on a mixed itinerary', () => {
  // Built so the two checks CANNOT share a score. Worked through by hand:
  //
  //   Day 1  Sushi Zanmai Asakusa (Asakusa, dining, 10:00-11:00)
  //          Shibuya Crossing     (Shibuya,  11:33-12:00)
  //          Senso-ji             (Asakusa,  12:05-13:00)
  //     geo  Asakusa->Shibuya gap 33 vs required 33 -> compliant
  //          Shibuya->Asakusa gap  5 vs required 33 -> non_compliant
  //   Day 2  T's TanTan Tokyo Station (Tokyo Station, dining, 09:00-10:00)
  //          Sushi Zanmai Asakusa     (Asakusa,       dining, 12:00-13:00)
  //     geo  Tokyo Station->Asakusa not in table -> unverified
  //   Day 3  Nowhere Cafe (Nowhere, dining) -- single stop, so no geo pair
  //
  //   dietary   : 2 compliant (halal venue twice), 1 non_compliant
  //               (T's TanTan is vegan-tagged, halal required), 1 unverified
  //   geographic: 1 compliant, 1 non_compliant, 1 unverified
  const mixed = {
    days: [
      {
        day: 1,
        stops: [
          { name: 'Sushi Zanmai Asakusa', ward_or_city: 'Asakusa', is_dining: true,
            start_time: '10:00', end_time: '11:00' },
          { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', is_dining: false,
            start_time: '11:33', end_time: '12:00' },
          { name: 'Senso-ji', ward_or_city: 'Asakusa', is_dining: false,
            start_time: '12:05', end_time: '13:00' }
        ]
      },
      {
        day: 2,
        stops: [
          { name: "T's TanTan Tokyo Station", ward_or_city: 'Tokyo Station', is_dining: true,
            start_time: '09:00', end_time: '10:00' },
          { name: 'Sushi Zanmai Asakusa', ward_or_city: 'Asakusa', is_dining: true,
            start_time: '12:00', end_time: '13:00' }
        ]
      },
      {
        day: 3,
        stops: [
          { name: 'Nowhere Cafe', ward_or_city: 'Nowhere', is_dining: true,
            start_time: '12:00', end_time: '13:00' }
        ]
      }
    ],
    transit_segments: []
  };

  const result = validateItinerary(mixed, DIETARY, TRAVEL, ['halal']);

  assert.deepEqual(result.dietary_summary, { compliant: 2, non_compliant: 1, unverified: 1 });
  assert.deepEqual(result.geographic_summary, { compliant: 1, non_compliant: 1, unverified: 1 });

  // The load-bearing point: the two checks score differently, so the combined
  // summary cannot stand in for either target (100% dietary vs >=90% geographic).
  assert.notDeepEqual(result.dietary_summary, result.geographic_summary);
  assert.deepEqual(result.summary, { compliant: 3, non_compliant: 2, unverified: 2 });
});

test('validateItinerary: the per-check summaries add up to the combined summary', () => {
  const result = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  for (const status of ['compliant', 'non_compliant', 'unverified']) {
    assert.equal(
      result.dietary_summary[status] + result.geographic_summary[status],
      result.summary[status],
      `${status} does not reconcile between per-check and combined summaries`
    );
  }
});

test('validateItinerary: each per-check summary totals its own result array', () => {
  const result = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  const total = (s) => s.compliant + s.non_compliant + s.unverified;
  assert.equal(total(result.dietary_summary), result.dietary_results.length);
  assert.equal(total(result.geographic_summary), result.geographic_results.length);
});

test('validateItinerary: attaches the day number to dietary results', () => {
  const result = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  assert.equal(result.dietary_results[0].day, 1);
});

test('validateItinerary: does not mutate its inputs', () => {
  const before = JSON.stringify(ITINERARY);
  validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  assert.equal(JSON.stringify(ITINERARY), before);
});

test('validateItinerary: is deterministic across repeated runs', () => {
  const a = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  const b = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  assert.deepEqual(a, b);
});

test('validateItinerary: an empty itinerary produces empty results, not a crash', () => {
  const result = validateItinerary({ days: [], transit_segments: [] }, DIETARY, TRAVEL, ['halal']);
  assert.deepEqual(result.summary, { compliant: 0, non_compliant: 0, unverified: 0 });
});

test('validateItinerary: rejects a non-object itinerary', () => {
  assert.throws(() => validateItinerary(null, DIETARY, TRAVEL, []), TypeError);
});

// ---------------------------------------------------------------------------
// Stage 7 failure logging
// ---------------------------------------------------------------------------

test('collectFailureLog: logs every non-compliant and unverified result, and no passes', () => {
  const itinerary = {
    days: [
      {
        day: 2,
        stops: [
          { name: 'Sushi Zanmai Asakusa', ward_or_city: 'Asakusa', start_time: '11:00', end_time: '12:00', is_dining: true },
          { name: 'Shibuya Crossing', ward_or_city: 'Shibuya', start_time: '12:20', end_time: '13:00', is_dining: false }
        ]
      }
    ],
    transit_segments: []
  };
  // Vegan traveller: the halal-only venue is a real violation, and the
  // 20-minute gap is short of the required 33.
  const validation = validateItinerary(itinerary, DIETARY, TRAVEL, ['vegan']);
  const log = collectFailureLog(validation);

  assert.equal(log.length, 2);

  const dietaryLine = log.find((l) => l.check === 'dietary');
  assert.equal(dietaryLine.status, NON_COMPLIANT);
  assert.equal(dietaryLine.day, 2);
  assert.match(dietaryLine.subject, /Sushi Zanmai Asakusa \(Asakusa\)/);
  assert.match(dietaryLine.expected, /vegan/);
  assert.match(dietaryLine.actual, /halal/);
  assert.equal(dietaryLine.source_id, 'test-fixture');
  assert.ok(dietaryLine.cause.length > 0);

  const geoLine = log.find((l) => l.check === 'geographic');
  assert.equal(geoLine.status, NON_COMPLIANT);
  assert.match(geoLine.subject, /Asakusa\) -> .*Shibuya\)/);
  assert.match(geoLine.expected, /at least 33 min/);
  assert.equal(geoLine.actual, '20 min');
});

test('collectFailureLog: passing results are omitted; only the uncovered pair remains', () => {
  const validation = validateItinerary(ITINERARY, DIETARY, TRAVEL, ['halal']);
  const log = collectFailureLog(validation);
  assert.ok(log.every((l) => l.status !== COMPLIANT));
  // Only the uncovered same-ward pair should appear.
  assert.equal(log.length, 1);
  assert.equal(log[0].status, UNVERIFIED);
});

test('collectFailureLog: unverified lines say what could not be matched', () => {
  const validation = validateItinerary(
    { days: [{ day: 1, stops: [{ name: 'Nowhere Cafe', ward_or_city: 'Nowhere', is_dining: true }] }], transit_segments: [] },
    DIETARY,
    TRAVEL,
    ['halal']
  );
  const [line] = collectFailureLog(validation);
  assert.equal(line.status, UNVERIFIED);
  assert.equal(line.actual, 'no matching table entry');
  assert.match(line.lookup_key, /nowhere cafe \| nowhere/);
});

// ---------------------------------------------------------------------------
// The locked rule, as an invariant
// ---------------------------------------------------------------------------

test('LOCKED RULE: no unmatched lookup ever returns compliant, in either check', () => {
  const unknownVenues = ['Nowhere Cafe', 'Sushi Zanmai, Asakusa Branch', '__proto__', ''];
  for (const name of unknownVenues) {
    for (const constraints of [[], ['halal'], ['vegan'], ['halal', 'vegan']]) {
      const [result] = checkDietaryCompliance([dining(name, 'Asakusa')], DIETARY, constraints);
      assert.equal(
        result.status,
        UNVERIFIED,
        `venue "${name}" with constraints [${constraints}] must be unverified`
      );
    }
  }

  const unknownWards = ['Ginza', 'Nowhere', 'Asakusa']; // 'Asakusa' -> same-ward pair
  for (const ward of unknownWards) {
    for (const gap of [0, 1, 500]) {
      const days = [
        {
          day: 1,
          stops: [
            { name: 'A', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11:00' },
            {
              name: 'B',
              ward_or_city: ward,
              start_time: `11:${String(gap % 60).padStart(2, '0')}`,
              end_time: '23:00'
            }
          ]
        }
      ];
      const [result] = checkGeographicFeasibility(days, [], TRAVEL);
      assert.equal(
        result.status,
        UNVERIFIED,
        `ward pair Asakusa <-> ${ward} must be unverified regardless of gap`
      );
    }
  }
});

test('LOCKED RULE: no extra argument can turn a miss into a pass', () => {
  // Architecture.md: the unverified outcome is "not configurable per call".
  // Try the shapes a future caller might reach for, and confirm none take.
  const overrides = [
    { assumeCompliantWhenUnmatched: true },
    { defaultStatus: 'compliant' },
    { strict: false },
    true
  ];

  for (const override of overrides) {
    const [dietary] = checkDietaryCompliance(
      [dining('Nowhere Cafe', 'Asakusa')],
      DIETARY,
      ['halal'],
      override
    );
    assert.equal(dietary.status, UNVERIFIED, `dietary miss survived ${JSON.stringify(override)}`);

    const days = [
      {
        day: 1,
        stops: [
          { name: 'A', ward_or_city: 'Asakusa', start_time: '10:00', end_time: '11:00' },
          { name: 'B', ward_or_city: 'Nowhere', start_time: '11:05', end_time: '12:00' }
        ]
      }
    ];
    const [geo] = checkGeographicFeasibility(days, [], TRAVEL, override);
    assert.equal(geo.status, UNVERIFIED, `geographic miss survived ${JSON.stringify(override)}`);
  }
});
