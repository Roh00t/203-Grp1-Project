/**
 * calculator.js — deterministic fare arithmetic for Module 2 (Pass ROI Auditor).
 *
 * Architecture.md Stage 3: Module 2 is Program-of-Thoughts. The LLM parses the
 * itinerary into a computation request and narrates the result; THIS FILE does
 * every piece of arithmetic. Nothing here calls a model, reads the network, or
 * touches global state — pure functions of their arguments, same input to same
 * output, every time.
 *
 * Failure philosophy: this module throws rather than guessing. A silently wrong
 * yen figure produces a confident BUY / DO NOT BUY verdict that a user acts on
 * with real money. An exception stops the pipeline where a human can see it.
 * Success criterion 1 (Financial accuracy, >=90%) is about the calculator being
 * right, not about it being "roughly right".
 */

/** A segment references a station pair with no matching row in the fare table. */
export class MissingFareError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingFareError';
  }
}

/** More than one fare row matches a segment and the segment does not say which. */
export class AmbiguousFareError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AmbiguousFareError';
  }
}

/**
 * A Nozomi/Mizuho segment needs a pass supplement, but the fare table carries
 * no supplement figure for it.
 *
 * Architecture.md Stage 3 ("Known correctness requirement"): the JR Pass does
 * not cover Nozomi/Mizuho for free, so the pass-side cost cannot be a flat pass
 * price. Until Ulfa's fare table carries the real supplement schedule, an audit
 * touching those services is refused outright — it is not answerable yet.
 */
export class MissingSupplementDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingSupplementDataError';
  }
}

/**
 * Services the JR Pass does not cover without an extra per-segment supplement.
 * Architecture.md Stage 3 names exactly these two.
 */
export const SUPPLEMENT_REQUIRED_SERVICES = Object.freeze(['Nozomi', 'Mizuho']);

/** Yen amounts are whole numbers. Reject anything that would round or drift. */
function assertYen(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer yen amount, got ${JSON.stringify(value)}`);
  }
  return value;
}

function segmentLabel(segment) {
  return `${segment?.from_station ?? '?'} -> ${segment?.to_station ?? '?'}`;
}

/**
 * Resolve one transit segment to its fare-table row.
 *
 * Lookup key is (from_station, to_station). Architecture.md puts `service_type`
 * on the fare table, not on the segment, so the row is what tells us which
 * service a segment uses. If a station pair has several rows (a Nozomi row and
 * a Hikari row, say) the segment must carry an optional `service_type` to pick
 * one; otherwise the choice would be arbitrary and we refuse instead of guessing.
 *
 * @returns {{from: string, to: string, service_type: string, price_yen: number}}
 */
export function findFare(segment, fareTable) {
  if (!Array.isArray(fareTable)) {
    throw new TypeError('fareTable must be an array of {from, to, service_type, price_yen} rows');
  }

  const matches = fareTable.filter(
    (row) => row.from === segment.from_station && row.to === segment.to_station
  );

  if (matches.length === 0) {
    throw new MissingFareError(
      `No fare-table row for segment ${segmentLabel(segment)}. ` +
        'Every segment passed to the calculator must be priced in the fare table; ' +
        'filter out non-fare modes (walking, included local transfers) before calling.'
    );
  }

  if (matches.length === 1) return matches[0];

  if (!segment.service_type) {
    throw new AmbiguousFareError(
      `${matches.length} fare rows match segment ${segmentLabel(segment)} ` +
        `(${matches.map((m) => m.service_type).join(', ')}) and the segment does not ` +
        'specify service_type. Refusing to pick one arbitrarily.'
    );
  }

  const disambiguated = matches.find((row) => row.service_type === segment.service_type);
  if (!disambiguated) {
    throw new MissingFareError(
      `Segment ${segmentLabel(segment)} requests service_type "${segment.service_type}" ` +
        `but the fare table only has ${matches.map((m) => m.service_type).join(', ')}.`
    );
  }
  return disambiguated;
}

/**
 * Sum the point-to-point ticket fares for a list of segments.
 *
 * This is the "buy individual tickets" side of the comparison. It never
 * includes pass supplements — those only exist on the pass side.
 *
 * @param {Array<{from_station: string, to_station: string}>} transitSegments
 * @param {Array<{from: string, to: string, service_type: string, price_yen: number}>} fareTable
 * @returns {number} total yen
 */
export function sumFares(transitSegments, fareTable) {
  if (!Array.isArray(transitSegments)) {
    throw new TypeError('transitSegments must be an array');
  }

  return transitSegments.reduce((total, segment) => {
    const fare = findFare(segment, fareTable);
    return total + assertYen(fare.price_yen, `price_yen for ${segmentLabel(segment)}`);
  }, 0);
}

/**
 * Compute the pass supplements owed across an itinerary.
 *
 * THE BUG THIS EXISTS TO PREVENT: comparing sum(ticket fares) against a flat
 * pass price. A JR Pass holder riding a Nozomi still pays a supplement per
 * segment, so the flat price understates the true cost of travelling this
 * itinerary on the pass — which biases the verdict toward BUY on exactly the
 * fast-train routes where travellers most want a trustworthy answer.
 *
 * The supplement is read from the matched fare row's `supplement_yen`. It is
 * per-segment because the real fee varies by distance; it is not a flat fee and
 * must not be modelled as one. If a Nozomi/Mizuho segment has no supplement
 * figure, this throws — see MissingSupplementDataError.
 *
 * @param {Array<object>} transitSegments
 * @param {Array<object>} fareTable
 * @param {{name: string, covers_nozomi?: boolean}} passType
 *   The pass option object. It must be the object rather than a bare name
 *   string, because `covers_nozomi` is what decides whether supplements apply.
 * @returns {{total_supplement_yen: number, per_segment: Array<object>}}
 */
export function applyPassSupplements(transitSegments, fareTable, passType) {
  if (!Array.isArray(transitSegments)) {
    throw new TypeError('transitSegments must be an array');
  }
  if (!passType || typeof passType !== 'object') {
    throw new TypeError(
      'passType must be a pass option object such as ' +
        '{name, price_yen, covers_nozomi}; a bare pass name cannot say whether ' +
        'the pass covers Nozomi/Mizuho.'
    );
  }

  const passCoversNozomi = passType.covers_nozomi === true;

  const per_segment = transitSegments.map((segment) => {
    const fare = findFare(segment, fareTable);
    const needsSupplement =
      !passCoversNozomi && SUPPLEMENT_REQUIRED_SERVICES.includes(fare.service_type);

    if (!needsSupplement) {
      return {
        from_station: segment.from_station,
        to_station: segment.to_station,
        service_type: fare.service_type,
        supplement_yen: 0
      };
    }

    if (fare.supplement_yen === undefined || fare.supplement_yen === null) {
      throw new MissingSupplementDataError(
        `Segment ${segmentLabel(segment)} uses ${fare.service_type}, which pass ` +
          `"${passType.name}" does not cover, but the fare table has no ` +
          '`supplement_yen` for that row. Cannot produce a pass verdict without it. ' +
          'Ulfa: Nozomi/Mizuho fare rows need a sourced, dated supplement figure.'
      );
    }

    return {
      from_station: segment.from_station,
      to_station: segment.to_station,
      service_type: fare.service_type,
      supplement_yen: assertYen(
        fare.supplement_yen,
        `supplement_yen for ${segmentLabel(segment)}`
      )
    };
  });

  const total_supplement_yen = per_segment.reduce((sum, s) => sum + s.supplement_yen, 0);
  return { total_supplement_yen, per_segment };
}

/**
 * Build the Stage 6 evidence trail for a verdict.
 *
 * Faithfulness (Architecture.md Stage 6) is measured as the share of factual /
 * numeric claims carrying a verifiable pointer to a dated source. So every
 * number this calculator emits gets an entry here.
 *
 * When a fare row carries no `source_id` / `source_date`, the pointer fields are
 * emitted as null rather than omitted or invented. That is deliberate: a null
 * pointer is counted by the Faithfulness metric as a claim WITHOUT a verifiable
 * source, which is exactly what it is. Hiding the gap would inflate the score.
 */
function buildEvidence({ ticketTotal, chosenPass, supplements, fareRows }) {
  const evidence = [
    {
      claim: `Point-to-point ticket total for this itinerary is ${ticketTotal} yen.`,
      source_id: 'calculator:sumFares',
      source_date: null
    },
    {
      claim: `Base price of "${chosenPass.name}" is ${chosenPass.price_yen} yen.`,
      source_id: chosenPass.source_id ?? null,
      source_date: chosenPass.source_date ?? null
    }
  ];

  for (const row of fareRows) {
    evidence.push({
      claim: `${row.from} to ${row.to} by ${row.service_type} costs ${row.price_yen} yen.`,
      source_id: row.source_id ?? null,
      source_date: row.source_date ?? null
    });
  }

  for (const seg of supplements.per_segment) {
    if (seg.supplement_yen === 0) continue;
    const row = fareRows.find(
      (r) => r.from === seg.from_station && r.to === seg.to_station
    );
    evidence.push({
      claim:
        `${seg.from_station} to ${seg.to_station} by ${seg.service_type} requires a ` +
        `${seg.supplement_yen} yen supplement on top of "${chosenPass.name}".`,
      source_id: row?.supplement_source_id ?? row?.source_id ?? null,
      source_date: row?.supplement_source_date ?? row?.source_date ?? null
    });
  }

  return evidence;
}

/**
 * Audit whether a transit pass is worth buying for one specific itinerary.
 *
 * This is the flagship claim of the whole system, so read the two conventions
 * carefully:
 *
 *   pass_price  = the ALL-IN pass-side cost: base pass price + every per-segment
 *                 Nozomi/Mizuho supplement. It is what the traveller actually
 *                 pays to ride this itinerary on the pass, NOT the sticker price.
 *                 The sticker price and each supplement stay individually
 *                 visible in per_segment_breakdown, so nothing is hidden.
 *
 *   difference  = pass_price - ticket_total.
 *                 POSITIVE means the pass costs more than tickets -> DO NOT BUY.
 *                 NEGATIVE means the pass saves money            -> BUY.
 *
 * When several passes are supplied, the cheapest all-in pass is the one audited
 * and reported — the output schema names a single pass_price, and "cheapest
 * all-in" is the only tie-break that is not arbitrary. A pass whose supplement
 * data is missing is not silently skipped; the error propagates.
 *
 * @param {Array<object>} transitSegments  Module 1's `transit_segments` list.
 * @param {Array<object>} fareTable        Ulfa's structured fare table.
 * @param {Array<object>|object} passOptions  Pass option object(s).
 * @returns {{recommendation: 'BUY'|'DO NOT BUY', pass_price: number,
 *            ticket_total: number, difference: number,
 *            per_segment_breakdown: Array<object>, evidence: Array<object>}}
 */
export function auditPassDecision(transitSegments, fareTable, passOptions) {
  const passes = Array.isArray(passOptions) ? passOptions : [passOptions];
  if (passes.length === 0 || passes.some((p) => !p || typeof p !== 'object')) {
    throw new TypeError('passOptions must be a pass option object or a non-empty array of them');
  }

  const ticket_total = sumFares(transitSegments, fareTable);
  const fareRows = transitSegments.map((segment) => findFare(segment, fareTable));

  // Price every candidate pass all-in, then take the cheapest.
  const priced = passes.map((pass) => {
    const supplements = applyPassSupplements(transitSegments, fareTable, pass);
    const basePrice = assertYen(pass.price_yen, `price_yen for pass "${pass.name}"`);
    return {
      pass,
      supplements,
      all_in: basePrice + supplements.total_supplement_yen
    };
  });

  const best = priced.reduce((cheapest, candidate) =>
    candidate.all_in < cheapest.all_in ? candidate : cheapest
  );

  const pass_price = best.all_in;
  const difference = pass_price - ticket_total;

  // Strictly cheaper wins. An exact tie is DO NOT BUY: no saving, so there is no
  // reason to pay up front and take on the pass's date/route restrictions.
  const recommendation = pass_price < ticket_total ? 'BUY' : 'DO NOT BUY';

  const per_segment_breakdown = transitSegments.map((segment, i) => ({
    from_station: segment.from_station,
    to_station: segment.to_station,
    service_type: fareRows[i].service_type,
    day: segment.day ?? null,
    order: segment.order ?? null,
    ticket_price_yen: fareRows[i].price_yen,
    pass_supplement_yen: best.supplements.per_segment[i].supplement_yen
  }));

  return {
    recommendation,
    pass_price,
    ticket_total,
    difference,
    per_segment_breakdown,
    evidence: buildEvidence({
      ticketTotal: ticket_total,
      chosenPass: best.pass,
      supplements: best.supplements,
      fareRows
    })
  };
}
