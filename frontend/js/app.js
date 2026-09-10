const $ = (id) => document.getElementById(id);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]));

const yen = (value) =>
  value == null ? 'N/A' : `¥${Number(value).toLocaleString()}`;

const statusLabel = (status) => ({
  compliant:'Verified',
  non_compliant:'Flagged',
  unverified:'Unverified'
}[status] || status);

const statusClass = (status) => status || 'unverified';

async function populateAirportFields() {
  const arrival = $('arrival-airport');
  const departure = $('departure-airport');

  try {
    const response = await fetch('./data/japan_airports.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Could not load airports`);
    }

    const text = await response.text();
    let airports;

    try {
      airports = JSON.parse(text);
    } catch (jsonError) {
      console.error('Airport data is not valid JSON:', text.substring(0, 100));
      throw new Error('Airport data contains invalid JSON');
    }

    airports.sort((a, b) => a.iata.localeCompare(b.iata));

    const placeholder = '<option value="">Select an airport</option>';
    arrival.innerHTML = placeholder;
    departure.innerHTML = placeholder;

    airports.forEach((airport) => {
      const label = `${airport.iata} — ${airport.name}, ${airport.prefecture}`;
      arrival.add(new Option(label, airport.iata));
      departure.add(new Option(label, airport.iata));
    });

    arrival.value = 'NRT';
    departure.value = 'KIX';
  } catch (error) {
    console.error('Failed to load airports:', error);
    throw new Error('The Japanese airport list could not be loaded. ' + error.message);
  }
}

function inputData(mode) {
  return {
    mode,
    start:$('start-date').value,
    end:$('end-date').value,
    arrival_time:$('arrival-time').value,
    departure_time:$('departure-time').value,
    dietary:$('dietary').value,
    pace:$('pace').value,
    arrival_airport:$('arrival-airport').value,
    departure_airport:$('departure-airport').value,
    preferences:$('preferences').value
  };
}

function showMessage(text) {
  $('message').textContent = text;
  $('message').classList.add('visible');
}

function hideMessage() {
  $('message').classList.remove('visible');
}

function renderEvidence(items) {
  return (items || []).map((item) =>
    `<li>
      ${escapeHtml(item.claim)}
      <small>
        Source: ${escapeHtml(item.source_id || 'Unavailable')} ·
        Verified: ${escapeHtml(item.source_date || 'Undated')}
      </small>
    </li>`
  ).join('');
}

function renderValidation(validation) {
  const all = [
    ...(validation.dietary_results || []),
    ...(validation.geographic_results || [])
  ];

  return all.map((item) =>
    `<div class="detail-row">
      <span>${escapeHtml(
        item.stop_name ||
        `${item.from_stop || ''} → ${item.to_stop || ''}`
      )}</span>
      <span class="tag ${statusClass(item.status)}">
        ${statusLabel(item.status)}
      </span>
    </div>`
  ).join('');
}

function renderDays(itinerary, validation) {
  const geo = validation.geographic_results || [];

  return (itinerary.days || []).map((day) => {
    const stops = day.stops || [];

    return `
      <article class="day-card">
        <div class="day-title">
          <h4>Day ${escapeHtml(day.day)}</h4>
          <span>${stops.length} stops</span>
        </div>

        ${stops.map((stop, index) => {
          const diet = (validation.dietary_results || []).find(
            (item) =>
              item.day === day.day &&
              item.stop_name === stop.name
          );

          const next = stops[index + 1];

          const transition = next
            ? geo.find(
                (item) =>
                  item.day === day.day &&
                  item.from_stop === stop.name &&
                  item.to_stop === next.name
              )
            : null;

          return `
            <div class="stop">
              <span class="time">
                ${escapeHtml(stop.start_time)}<br>
                ${escapeHtml(stop.end_time)}
              </span>

              <div>
                <strong>${escapeHtml(stop.name)}</strong>
                <small>
                  ${escapeHtml(stop.ward_or_city)}
                  ${stop.is_dining ? ' · dining stop' : ''}
                </small>
              </div>

              ${diet
                ? `<span class="tag ${statusClass(diet.status)}">${statusLabel(diet.status)}</span>`
                : ''}
            </div>

            ${transition
              ? `<div class="transition">
                  <strong>
                    ${escapeHtml(transition.from_ward_or_city)}
                    →
                    ${escapeHtml(transition.to_ward_or_city)}
                  </strong>
                  · ${escapeHtml(transition.reason)}
                  ${transition.source_date ? ` · ${escapeHtml(transition.source_date)}` : ''}
                </div>`
              : ''}
          `;
        }).join('')}
      </article>
    `;
  }).join('');
}

function render(data) {
  hideMessage();

  const audit = data.audit;
  const validation = data.validation || {
    dietary_summary:{},
    geographic_summary:{},
    dietary_results:[],
    geographic_results:[]
  };

  const incomplete = data.calculatorError;
  const missingInfo = data.itinerary?.missing_info || [];
  const verdict = audit ? audit.recommendation : 'INCOMPLETE DATA';

  const difference = audit
    ? `${audit.recommendation === 'BUY' ? 'Potential saving' : 'Extra cost'} · ${yen(Math.abs(audit.difference))}`
    : 'The route needs another fare-table check.';

  const segmentRows = audit
    ? audit.per_segment_breakdown.map((segment) =>
        `<div class="detail-row">
          <span>
            ${escapeHtml(segment.from_station)}
            →
            ${escapeHtml(segment.to_station)}
            <br>
            <small>${escapeHtml(segment.service_type)}</small>
          </span>
          <span>
            ${yen(segment.ticket_price_yen)}
            ${segment.pass_extra_yen
              ? `<br><small>+ ${yen(segment.pass_extra_yen)} ${
                  segment.pass_extra_reason === 'supplement'
                    ? 'pass supplement'
                    : 'not covered by pass'
                }</small>`
              : '<br><small>Covered by pass</small>'}
          </span>
        </div>`
      ).join('')
    : '<div class="detail-row"><span>Fare audit</span><span>Paused</span></div>';

  const explanation = data.explanation || {
    headline:'The audit is waiting for complete fare data.',
    explanation:'The itinerary and deterministic checks are still available. No narrative was generated because the calculator could not produce a defensible verdict.',
    caveats:[]
  };

  $('results').innerHTML = `
    <div class="results-head">
      <div>
        <h2>Your plan and verification results</h2>
        <p>
          ${data.mode === 'demo'
            ? 'Sample route · local preview'
            : 'Live route · generated and checked locally'}
        </p>
      </div>

      <span class="mode-pill">
        ${data.mode === 'demo' ? 'Demo mode' : 'Live mode'}
      </span>
    </div>

    <div class="status-legend" aria-label="Verification status legend">
      <span>
        <i class="legend-dot verified"></i>
        Verified = supported by curated evidence
      </span>
      <span>
        <i class="legend-dot flagged"></i>
        Flagged = conflicts with a hard check
      </span>
      <span>
        <i class="legend-dot unverified"></i>
        Unverified = insufficient curated evidence
      </span>
    </div>

    ${incomplete
      ? `<div class="notice">
          <strong>Fare audit paused</strong>
          ${escapeHtml(incomplete.message)}
        </div>`
      : ''}

    <div class="verdict">
      <div class="verdict-card ${audit?.recommendation === 'BUY' ? 'buy' : ''}">
        <span class="eyebrow">Pass ROI Auditor</span>
        <h3>${escapeHtml(verdict)}</h3>
        <p>${escapeHtml(difference)}</p>
      </div>

      <div class="details-card numbers">
        <div class="number">
          <span class="eyebrow">Pass side</span>
          <b>${audit ? yen(audit.pass_price) : 'N/A'}</b>
          <small>All-in cost</small>
        </div>

        <div class="number">
          <span class="eyebrow">Tickets</span>
          <b>${audit ? yen(audit.ticket_total) : 'N/A'}</b>
          <small>Individual fares</small>
        </div>

        <div class="number">
          <span class="eyebrow">Dietary checks</span>
          <b>
            ${validation.dietary_summary.compliant || 0}/
            ${(validation.dietary_results || []).length}
          </b>
          <small>Verified</small>
        </div>

        <div class="number">
          <span class="eyebrow">Geographic checks</span>
          <b>
            ${validation.geographic_summary.compliant || 0}/
            ${(validation.geographic_results || []).length}
          </b>
          <small>Verified</small>
        </div>
      </div>
    </div>

    <div class="fare-note">
      Fare comparison uses curated airport and long-distance rail fares.
      Local subways, buses, trams, walking segments, and ordinary urban
      transfers are excluded unless a curated fare is available. Actual
      date-specific fares may vary.
    </div>

    ${missingInfo.length
      ? `<div class="notice">
          <strong>Some trip information is still missing</strong>
          ${escapeHtml(missingInfo.join(', '))}
        </div>`
      : ''}

    <div class="content-grid">
      <div class="itinerary">
        <h3>Itinerary Generator</h3>
        ${renderDays(data.itinerary, validation)}
      </div>

      <aside class="details-card">
        <h3>Audit notes</h3>

        <div class="detail-block">
          <h4>Auditor narrative</h4>
          <strong>${escapeHtml(explanation.headline || '')}</strong>
          <p style="font-size:13px;color:var(--muted);margin:8px 0 0">
            ${escapeHtml(explanation.explanation || '')}
          </p>
        </div>

        <div class="detail-block">
          <h4>Fare breakdown</h4>
          ${segmentRows}
        </div>

        <div class="detail-block">
          <h4>Constraint Validator</h4>

          <div class="detail-row">
            <span>Dietary</span>
            <span>
              ${validation.dietary_summary.compliant || 0} verified ·
              ${validation.dietary_summary.non_compliant || 0} flagged ·
              ${validation.dietary_summary.unverified || 0} unknown
            </span>
          </div>

          <div class="detail-row">
            <span>Geographic</span>
            <span>
              ${validation.geographic_summary.compliant || 0} verified ·
              ${validation.geographic_summary.non_compliant || 0} flagged ·
              ${validation.geographic_summary.unverified || 0} unknown
            </span>
          </div>

          ${renderValidation(validation)}
        </div>

        <div class="detail-block">
          <h4>Evidence / Grounding</h4>
          <ul class="evidence">
            ${renderEvidence(audit?.evidence || explanation.evidence)}
          </ul>
        </div>
      </aside>
    </div>
  `;

  $('results').classList.add('visible');
  $('results').scrollIntoView({
    behavior:'smooth',
    block:'start'
  });
}

async function request(mode) {
  const start = $('start-date').value;
  const end = $('end-date').value;

  if (
    !start ||
    !end ||
    !$('arrival-time').value ||
    !$('departure-time').value ||
    !$('arrival-airport').value ||
    !$('departure-airport').value
  ) {
    showMessage('Please complete the arrival and departure dates, times, and airports.');
    return;
  }

  if (start && end && start > end) {
    showMessage('Departure date must be the same as or later than the arrival date.');
    return;
  }

  hideMessage();
  $('loading').classList.add('visible');
  $('generate').disabled = true;
  $('demo').disabled = true;

  try {
    const response = await fetch('/api/generate', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(inputData(mode))
    });

    const payload = await response.json();

    if (!response.ok || (payload.ok === false && !payload.itinerary)) {
      throw new Error(
        payload.error ||
        payload.details?.join(' ') ||
        'The local planner could not complete this request.'
      );
    }

    if (!payload.itinerary) {
      throw new Error(
        payload.error ||
        'The planner returned no itinerary.'
      );
    }

    render(payload);
  } catch (error) {
    showMessage(error.message);
  } finally {
    $('loading').classList.remove('visible');
    $('generate').disabled = false;
    $('demo').disabled = false;
  }
}

// Demo Selector Functionality
let demoCatalog = [];

async function loadDemoCatalog() {
  try {
    const response = await fetch('./data/demo_catalog.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Could not load demo catalog`);
    }

    const text = await response.text();

    try {
      demoCatalog = JSON.parse(text);
      console.log('✓ Loaded', demoCatalog.length, 'demo scenarios');
    } catch (jsonError) {
      console.error('Demo catalog JSON parse error:', text.substring(0, 200));
      throw new Error('Demo catalog contains invalid JSON');
    }
  } catch (error) {
    console.error('Demo catalog load failed:', error);
    demoCatalog = []; // Fallback to empty array
  }
}

function showDemoSelector() {
  const selector = $('demo-selector');
  const grid = $('demo-grid');

  // Check if catalog loaded
  if (demoCatalog.length === 0) {
    showMessage('Demo scenarios are not available. Please check that data files are uploaded correctly.');
    return;
  }

  grid.innerHTML = demoCatalog.map(demo => `
    <div class="demo-card" data-demo-id="${demo.id}">
      <span class="demo-badge">${demo.badge}</span>
      <h3>${demo.name}</h3>
      <p class="description">${demo.description}</p>
      <ul class="demo-highlights">
        ${demo.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
      <div class="demo-stats">
        <div class="demo-stat">
          <small>Duration</small>
          <strong>${demo.stats.days} days</strong>
        </div>
        <div class="demo-stat">
          <small>Cities</small>
          <strong>${demo.stats.cities} cities</strong>
        </div>
        <div class="demo-stat">
          <small>Dietary</small>
          <strong>${demo.stats.dietary}</strong>
        </div>
        <div class="demo-stat">
          <small>Verdict</small>
          <strong>${demo.stats.verdict}</strong>
        </div>
      </div>
    </div>
  `).join('');

  selector.style.display = 'block';

  // Add click handlers to demo cards
  grid.querySelectorAll('.demo-card').forEach(card => {
    card.addEventListener('click', () => {
      const demoId = card.dataset.demoId;
      loadDemoScenario(demoId);
    });
  });
}

function hideDemoSelector() {
  $('demo-selector').style.display = 'none';
}

async function loadDemoScenario(demoId) {
  hideDemoSelector();
  hideMessage();
  $('loading').classList.add('visible');

  try {
    const response = await fetch(`./data/demo_${demoId}.json`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Demo file not found (demo_${demoId}.json)`);
    }

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (jsonError) {
      console.error('Demo JSON parse error for', demoId, ':', text.substring(0, 200));
      throw new Error(`Demo scenario ${demoId} contains invalid JSON`);
    }

    data.mode = 'demo'; // Mark as demo mode
    console.log('✓ Loaded demo:', demoId);
    render(data);
  } catch (error) {
    console.error('Failed to load demo scenario:', error);
    showMessage('Demo scenario could not be loaded: ' + error.message);
  } finally {
    $('loading').classList.remove('visible');
  }
}

$('generate').addEventListener('click', () => request('live'));
$('demo').addEventListener('click', showDemoSelector);
$('close-demos').addEventListener('click', hideDemoSelector);

// Initialize
Promise.all([
  populateAirportFields(),
  loadDemoCatalog()
]).catch((error) => {
  showMessage(error.message);
  $('generate').disabled = true;
  $('demo').disabled = true;
});
