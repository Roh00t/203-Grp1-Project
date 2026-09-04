/**
 * validator.js — Constraint Validator (non-LLM, deterministic).
 *
 * Architecture.md, "Constraint Validator" section. Two checks, both pure
 * lookups against curated tables:
 *   1. Dietary hard-filter    -> success criterion 2 (100% of venues pass)
 *   2. Geographic/time filter -> success criterion 3 (>=90%, failures flagged)
 *
 * There is no LLM call anywhere in this file, and there never should be. The
 * 100% and 90% claims are defensible precisely because this is arithmetic and
 * table lookup, not model judgment that might fail on the case a grader tests
 * live.
 *
 * THE LOCKED RULE, which everything here is built around:
 *   Any venue or ward pair not found after normalization resolves to
 *   "unverified" — never a silent pass or fail. Not configurable per call.
 * Curated coverage will be incomplete this week. "unverified" is how the system
 * stays honest about that instead of quietly scoring itself a pass.
 *
 * SECURITY (Architecture.md, and CLAUDE.md locked decision): itinerary-derived
 * strings are used only as plain lookup keys. No eval, no dynamic code
 * construction, no string concatenation into anything executable. Lookups go
 * through Map, never a plain object, so a venue named "__proto__" or
 * "constructor" is an ordinary miss rather than a prototype-chain hit.
 *
 * KEY NAMING, confirmed with Rohit 2026-09-04: the curated tables use the
 * locked Architecture.md keys `ward` / `ward_a` / `ward_b`. Module 1 stops
 * carry `ward_or_city`. The translation happens here, at lookup time, and
 * nowhere else.
 */

/** Statuses. Exactly three; "unverified" is never collapsed into the others. */
export const COMPLIANT = 'compliant';
export const NON_COMPLIANT = 'non_compliant';
export const UNVERIFIED = 'unverified';

/**
 * Separator for composite lookup keys.
 *
 * normalizeKey output contains only letters, digits and single spaces — every
 * other character becomes a space — so a pipe can never appear inside a
 * normalized component. That makes ("ab", "c") and ("a", "bc") impossible to
 * confuse. A space would NOT be safe here, since normalized components can
 * contain spaces.
 */
const KEY_SEP = '|';

/** Human-readable form of a composite key, for failure logs. */
const readableKey = (key) => key.split(KEY_SEP).join(' | ');

/**
 * Normalize a lookup key: lowercase, strip punctuation, collapse whitespace, trim.
 * Applied to BOTH sides of every lookup, no exceptions (Architecture.md).
 *
 * Punctuation becomes a space rather than being deleted, so "Shin-Osaka"
 * normalizes to "shin osaka" rather than "shinosaka" — deleting a separator
 * would invent a token that appears in neither string. Both sides get identical
 * treatment either way, so this changes no match that would otherwise succeed.
 *
 * \p{L} covers Japanese, so a name written in kanji survives normalization.
 *
 * This is exact match after normalization. It is deliberately NOT fuzzy: no
 * Levenshtein, no substring, no token-overlap scoring. A near-miss resolves to
 * "unverified", which is the honest answer — see the locked rule above.
 */
export function normalizeKey(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Composite key for a dietary venue: (venue name, ward). */
function dietaryKey(venueName, ward) {
  return normalizeKey(venueName) + KEY_SEP + normalizeKey(ward);
}

/**
 * Composite key for a ward pair. Sorted, because Architecture.md declares the
 * geographic table symmetric by design: one row covers both directions.
 */
function wardPairKey(wardA, wardB) {
  return [normalizeKey(wardA), normalizeKey(wardB)].sort().join(KEY_SEP);
}

/** "HH:MM" 24-hour -> minutes since midnight, or null if unparseable. */
function parseTimeToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Index the dietary table by normalized (venue_name, ward).
 *
 * A duplicate key throws. Two rows for one venue would let whichever loaded
 * last silently shadow the other, and if their tags disagree the 100% dietary
 * claim becomes load-order-dependent. That is a data error worth stopping for.
 */
export function buildDietaryIndex(dietaryTable) {
  if (!Array.isArray(dietaryTable)) {
    throw new TypeError(
      'dietaryTable must be an array of {venue_name, ward, tags, source_id, source_date} rows'
    );
  }
  const index = new Map();
  for (const row of dietaryTable) {
    const key = dietaryKey(row.venue_name, row.ward);
    if (index.has(key)) {
      throw new Error(
        `Duplicate dietary table entry for "${row.venue_name}" in "${row.ward}" ` +
          '(identical after normalization). Resolve the duplicate — a shadowed row ' +
          'makes the dietary result depend on table order.'
      );
    }
    index.set(key, row);
  }
  return index;
}

/** Index the travel-time table by sorted normalized ward pair. Duplicates throw. */
export function buildTravelTimeIndex(travelTimeTable) {
  if (!Array.isArray(travelTimeTable)) {
    throw new TypeError(
      'travelTimeTable must be an array of {ward_a, ward_b, estimated_transit_minutes, mode, source_id, source_date} rows'
    );
  }
  const index = new Map();
  for (const row of travelTimeTable) {
    const key = wardPairKey(row.ward_a, row.ward_b);
    if (index.has(key)) {
      throw new Error(
        `Duplicate travel-time entry for "${row.ward_a}" <-> "${row.ward_b}" ` +
          '(identical after normalization; rows are symmetric, so A-B and B-A are the ' +
          'same row). Resolve the duplicate.'
      );
    }
    index.set(key, row);
  }
  return index;
}

/**
 * Dietary hard-filter over the dining-tagged stops of an itinerary.
 *
 * A stop is checked when `is_dining === true`. A stop that does not declare
 * `is_dining` at all resolves to "unverified": we cannot confirm it is not a
 * meal stop, and guessing "not dining" would be exactly the silent pass the
 * locked rule forbids. Module 1's prompt emits the flag on every stop, so this
 * case only arises for output generated before that change.
 *
 * A venue is compliant when its curated tags satisfy EVERY user constraint —
 * a traveller who is both vegan and halal needs both tags present, not either.
 *
 * @param {Array<object>} stops Module 1 stops ({name, ward_or_city, is_dining}).
 * @param {Array<object>} dietaryTable Curated rows, keyed on `ward`.
 * @param {string[]} userDietaryConstraints e.g. ["halal"].
 * @returns {Array<object>} one result per checked stop.
 */
export function checkDietaryCompliance(stops, dietaryTable, userDietaryConstraints = []) {
  if (!Array.isArray(stops)) throw new TypeError('stops must be an array');
  if (!Array.isArray(userDietaryConstraints)) {
    throw new TypeError('userDietaryConstraints must be an array of strings');
  }

  const index = buildDietaryIndex(dietaryTable);
  const required = userDietaryConstraints.map(normalizeKey).filter(Boolean);
  const results = [];

  for (const stop of stops) {
    if (stop?.is_dining === false) continue; // explicitly not a meal stop

    const base = {
      stop_name: stop?.name ?? null,
      ward_or_city: stop?.ward_or_city ?? null,
      day: stop?.day ?? null,
      required_tags: [...required]
    };

    if (stop?.is_dining !== true) {
      results.push({
        ...base,
        status: UNVERIFIED,
        lookup_key: null,
        venue_tags: null,
        missing_tags: [],
        source_id: null,
        source_date: null,
        reason:
          'Stop does not declare is_dining, so it cannot be confirmed as a non-meal ' +
          'stop. Regenerate the itinerary with a Module 1 prompt that emits is_dining.'
      });
      continue;
    }

    // Translation point: Module 1's `ward_or_city` -> the table's locked `ward`.
    const key = dietaryKey(stop.name, stop.ward_or_city);
    const row = index.get(key);

    if (!row) {
      results.push({
        ...base,
        status: UNVERIFIED,
        lookup_key: readableKey(key),
        venue_tags: null,
        missing_tags: [],
        source_id: null,
        source_date: null,
        reason:
          `No dietary table entry matches venue "${stop.name}" in "${stop.ward_or_city}" ` +
          'after normalization. Not treated as a pass or a fail — the curated table ' +
          'simply does not cover this venue yet.'
      });
      continue;
    }

    const venueTags = (row.tags ?? []).map(normalizeKey);
    const missing = required.filter((tag) => !venueTags.includes(tag));

    results.push({
      ...base,
      status: missing.length === 0 ? COMPLIANT : NON_COMPLIANT,
      lookup_key: readableKey(key),
      venue_tags: [...venueTags],
      missing_tags: missing,
      source_id: row.source_id ?? null,
      source_date: row.source_date ?? null,
      reason:
        missing.length === 0
          ? required.length === 0
            ? 'Venue found in the curated table; no dietary constraints were specified.'
            : `Venue tags [${venueTags.join(', ')}] satisfy all required tags [${required.join(', ')}].`
          : `Venue tags [${venueTags.join(', ')}] do not satisfy required tag(s) [${missing.join(', ')}].`
    });
  }

  return results;
}

/**
 * Geographic/time feasibility over consecutive stops.
 *
 * Architecture.md: "Any two consecutive stops whose scheduled gap is shorter
 * than the looked-up travel time gets flagged." The comparison is `>=`, so a
 * gap that exactly equals the required travel time PASSES — it is achievable,
 * if tight, and flagging it would understate criterion 3 with a false positive.
 *
 * SAME-DAY ONLY (Architecture.md, locked). A pair is compared only when both
 * stops carry the same `day`. Subtracting a Day-2 clock time from a Day-1 one
 * is meaningless — Day 1 ending 18:00 and Day 2 starting 09:00 would compute a
 * -540 minute "gap" and flag a perfectly ordinary overnight as infeasible.
 *
 * A cross-day pair is SKIPPED, not reported: it is not compliant, and it is not
 * unverified either. "unverified" means the tables could not confirm something
 * they should cover; a day boundary is simply not a transit window, so no
 * result is emitted at all. This keeps overnights out of the Geographic
 * Plausibility denominator instead of quietly depressing the score.
 *
 * `transitSegments` is consulted solely to report the itinerary's declared
 * `mode` alongside the table row's `mode`. It cannot drive the verdict: the
 * travel-time table is keyed by ward pair alone, so `mode` has nothing to
 * disambiguate. A mismatch is surfaced in `reason` for Stage 7 rather than
 * silently changing a pass to a fail.
 *
 * @param {Array<object>} days Module 1 `days` (each {day, stops: [...]}).
 * @param {Array<object>} transitSegments Module 1 `transit_segments`.
 * @param {Array<object>} travelTimeTable Curated rows, keyed on ward_a/ward_b.
 * @returns {Array<object>} one result per consecutive stop pair.
 */
export function checkGeographicFeasibility(days, transitSegments, travelTimeTable) {
  if (!Array.isArray(days)) throw new TypeError('days must be an array');
  if (transitSegments != null && !Array.isArray(transitSegments)) {
    throw new TypeError('transitSegments must be an array or null');
  }

  const index = buildTravelTimeIndex(travelTimeTable);

  // Declared mode per (day, order). Plain Map, so itinerary-derived values are
  // never object keys.
  const modeByPosition = new Map();
  for (const segment of transitSegments ?? []) {
    modeByPosition.set(`${segment?.day}${KEY_SEP}${segment?.order}`, segment?.mode ?? null);
  }

  const results = [];

  for (const dayEntry of days) {
    const stops = Array.isArray(dayEntry?.stops) ? dayEntry.stops : [];

    for (let i = 0; i + 1 < stops.length; i += 1) {
      const from = stops[i];
      const to = stops[i + 1];

      // Iterating per day entry already keeps pairs within a day, but a stop
      // may carry its own `day` (validateItinerary attaches one, and a caller
      // can pass stops directly). Compare the effective day values so a day
      // boundary is skipped even when it sits inside a single stops array.
      const fromDay = from?.day ?? dayEntry?.day ?? null;
      const toDay = to?.day ?? dayEntry?.day ?? null;
      if (fromDay !== toDay) continue; // not applicable — emit no result

      const itineraryMode = modeByPosition.get(`${dayEntry?.day}${KEY_SEP}${i + 1}`) ?? null;

      const key = wardPairKey(from?.ward_or_city, to?.ward_or_city);
      const row = index.get(key);

      const base = {
        day: dayEntry?.day ?? null,
        from_stop: from?.name ?? null,
        to_stop: to?.name ?? null,
        from_ward_or_city: from?.ward_or_city ?? null,
        to_ward_or_city: to?.ward_or_city ?? null,
        itinerary_mode: itineraryMode
      };

      if (!row) {
        results.push({
          ...base,
          status: UNVERIFIED,
          scheduled_gap_minutes: null,
          required_minutes: null,
          lookup_key: readableKey(key),
          table_mode: null,
          source_id: null,
          source_date: null,
          reason:
            `No travel-time entry for the ward pair "${from?.ward_or_city}" <-> ` +
            `"${to?.ward_or_city}" after normalization. Not treated as feasible — ` +
            'the curated table does not cover this pair yet.'
        });
        continue;
      }

      const departure = parseTimeToMinutes(from?.end_time);
      const arrival = parseTimeToMinutes(to?.start_time);

      if (departure === null || arrival === null) {
        results.push({
          ...base,
          status: UNVERIFIED,
          scheduled_gap_minutes: null,
          required_minutes: row.estimated_transit_minutes ?? null,
          lookup_key: readableKey(key),
          table_mode: row.mode ?? null,
          source_id: row.source_id ?? null,
          source_date: row.source_date ?? null,
          reason:
            `Ward pair is in the table (${row.estimated_transit_minutes} min), but the ` +
            `scheduled gap could not be computed from end_time "${from?.end_time}" and ` +
            `start_time "${to?.start_time}". Expected 24-hour HH:MM.`
        });
        continue;
      }

      const gap = arrival - departure;
      const required = row.estimated_transit_minutes;

      if (!Number.isFinite(required)) {
        results.push({
          ...base,
          status: UNVERIFIED,
          scheduled_gap_minutes: gap,
          required_minutes: null,
          lookup_key: readableKey(key),
          table_mode: row.mode ?? null,
          source_id: row.source_id ?? null,
          source_date: row.source_date ?? null,
          reason:
            `Travel-time row for "${row.ward_a}" <-> "${row.ward_b}" has a ` +
            `non-numeric estimated_transit_minutes (${JSON.stringify(required)}).`
        });
        continue;
      }

      const feasible = gap >= required; // >= not >: an exact fit is achievable.
      const modeNote =
        itineraryMode && row.mode && normalizeKey(itineraryMode) !== normalizeKey(row.mode)
          ? ` Itinerary declares mode "${itineraryMode}" but the table row is "${row.mode}"; ` +
            'the table is keyed by ward pair only, so this did not affect the verdict.'
          : '';

      results.push({
        ...base,
        status: feasible ? COMPLIANT : NON_COMPLIANT,
        scheduled_gap_minutes: gap,
        required_minutes: required,
        lookup_key: readableKey(key),
        table_mode: row.mode ?? null,
        source_id: row.source_id ?? null,
        source_date: row.source_date ?? null,
        reason:
          (feasible
            ? `Scheduled gap ${gap} min meets the required ${required} min.`
            : `Scheduled gap ${gap} min is short of the required ${required} min ` +
              `by ${required - gap} min.`) + modeNote
      });
    }
  }

  return results;
}

/** Count results by status. Shared by the combined and per-check summaries. */
function tally(results) {
  const counts = { compliant: 0, non_compliant: 0, unverified: 0 };
  for (const result of results) {
    if (result.status === COMPLIANT) counts.compliant += 1;
    else if (result.status === NON_COMPLIANT) counts.non_compliant += 1;
    else counts.unverified += 1;
  }
  return counts;
}

/**
 * Run both checks over a Module 1 itinerary.
 *
 * @param {{days: Array<object>, transit_segments: Array<object>}} itineraryJson
 * @param {Array<object>} dietaryTable
 * @param {Array<object>} travelTimeTable
 * @param {string[]} userDietaryConstraints
 * `summary` is the combined count across both checks. `dietary_summary` and
 * `geographic_summary` break the same results out per check, because the two
 * criteria have different targets — Constraint Adherence is claimed at 100%
 * (a curated lookup) and Geographic Plausibility at >=90% (Architecture.md
 * Stage 1). A combined figure cannot be scored against either, so Mutya needs
 * both halves separately. The combined `summary` stays for callers already
 * reading it.
 *
 * @returns {{dietary_results: object[], geographic_results: object[],
 *            summary: {compliant: number, non_compliant: number, unverified: number},
 *            dietary_summary: {compliant: number, non_compliant: number, unverified: number},
 *            geographic_summary: {compliant: number, non_compliant: number, unverified: number}}}
 */
export function validateItinerary(
  itineraryJson,
  dietaryTable,
  travelTimeTable,
  userDietaryConstraints = []
) {
  if (!itineraryJson || typeof itineraryJson !== 'object') {
    throw new TypeError('itineraryJson must be the parsed Module 1 output object');
  }

  const days = Array.isArray(itineraryJson.days) ? itineraryJson.days : [];

  // Carry the day number onto each stop so a dietary failure can be located in
  // the itinerary. Shallow copies — the caller's itinerary is never mutated.
  const stops = days.flatMap((dayEntry) =>
    (Array.isArray(dayEntry?.stops) ? dayEntry.stops : []).map((stop) => ({
      ...stop,
      day: stop?.day ?? dayEntry?.day ?? null
    }))
  );

  const dietary_results = checkDietaryCompliance(stops, dietaryTable, userDietaryConstraints);
  const geographic_results = checkGeographicFeasibility(
    days,
    itineraryJson.transit_segments ?? [],
    travelTimeTable
  );

  const dietary_summary = tally(dietary_results);
  const geographic_summary = tally(geographic_results);
  const summary = tally([...dietary_results, ...geographic_results]);

  return {
    dietary_results,
    geographic_results,
    summary,
    dietary_summary,
    geographic_summary
  };
}

/**
 * Stage 7 failure-analysis log lines for everything that did not pass.
 *
 * Architecture.md Stage 7 logs input -> expected -> actual -> cause. Each line
 * carries the stop or segment, the normalized key that was looked up, what the
 * table said, and why the result landed where it did — enough for Shi Shuyi to
 * work a failure without re-running the itinerary.
 *
 * Returns data; it does not write to the console, so tests and the UI can each
 * render it their own way.
 *
 * @param {{dietary_results: object[], geographic_results: object[]}} validation
 * @returns {Array<object>} one entry per non_compliant or unverified result.
 */
export function collectFailureLog(validation) {
  const lines = [];

  for (const result of validation.dietary_results ?? []) {
    if (result.status === COMPLIANT) continue;
    lines.push({
      check: 'dietary',
      status: result.status,
      day: result.day,
      subject: `${result.stop_name} (${result.ward_or_city})`,
      lookup_key: result.lookup_key,
      expected: result.required_tags.length
        ? `tags including [${result.required_tags.join(', ')}]`
        : 'a matching entry in the curated dietary table',
      actual:
        result.venue_tags === null
          ? 'no matching table entry'
          : `tags [${result.venue_tags.join(', ')}]`,
      source_id: result.source_id,
      source_date: result.source_date,
      cause: result.reason
    });
  }

  for (const result of validation.geographic_results ?? []) {
    if (result.status === COMPLIANT) continue;
    lines.push({
      check: 'geographic',
      status: result.status,
      day: result.day,
      subject:
        `${result.from_stop} (${result.from_ward_or_city}) -> ` +
        `${result.to_stop} (${result.to_ward_or_city})`,
      lookup_key: result.lookup_key,
      expected:
        result.required_minutes === null
          ? 'a matching ward pair in the curated travel-time table'
          : `a scheduled gap of at least ${result.required_minutes} min`,
      actual:
        result.scheduled_gap_minutes === null
          ? 'gap not computable'
          : `${result.scheduled_gap_minutes} min`,
      source_id: result.source_id,
      source_date: result.source_date,
      cause: result.reason
    });
  }

  return lines;
}
