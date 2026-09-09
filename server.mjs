import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditPassDecision, AmbiguousFareError, MissingFareError, MissingSupplementDataError } from './calculator.js';
import { validate as validateSchema } from './schema/validate.js';
import itinerarySchema from './schema/itinerary_schema.json' with { type: 'json' };
import { validateItinerary, collectFailureLog } from './validator.js';
import {
  buildModule1Prompt,
  parseItineraryResponseDetailed,
  MODULE1_GENERATION_CONFIG,
  MODULE1_RESPONSE_SCHEMA
} from './prompts/module1_itinerary.js';
import {
  buildModule2Prompt,
  parseAuditorResponse,
  verifyNarrationMatchesCalculator,
  MODULE2_GENERATION_CONFIG
} from './prompts/module2_auditor.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function loadEnv() {
  try {
    const contents = requireEnvFile();
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function requireEnvFile() {
  return readFileSync(join(ROOT, '.env'), 'utf8');
}

loadEnv();

const [{ fares, passes }, dietaryData, travelTimeData, areaVocabulary] = await Promise.all([
  readFile(join(ROOT, 'data/fare_table.json'), 'utf8').then(JSON.parse),
  readFile(join(ROOT, 'data/dietary_table.json'), 'utf8').then(JSON.parse),
  readFile(join(ROOT, 'data/travel_time_table.json'), 'utf8').then(JSON.parse),
  readFile(join(ROOT, 'data/area_vocabulary.json'), 'utf8').then(JSON.parse)
]);
const data = { fares, passes, dietary: dietaryData.dietary, travelTimes: travelTimeData.travel_times };

/**
 * Prompt-injected lists, derived from the live tables at startup.
 *
 * Deriving them here rather than hardcoding them in the template is what keeps
 * Module 1's vocabulary and the Constraint Validator's lookup keys in sync: add
 * a venue or an area to the data files and the prompt picks it up on restart,
 * with no second place to edit.
 */
const CANONICAL_AREAS = Object.values(areaVocabulary.cities ?? {}).flat();
const APPROVED_DINING_VENUES = data.dietary.map(
  (row) => `${row.venue_name} (${row.ward}) - ${(row.tags ?? []).join(', ')}`
);

/**
 * Bounded at 1 by design. A second Module 1 call is the entire cost exposure of
 * the repair path, so it is capped rather than looped: a model that fails twice
 * on a temperature-0 prompt will not succeed on a third try, and an unbounded
 * loop against a metered API is how a class project burns its quota.
 */
const MAX_RETRIES = 1;

const DEMO_ITINERARY = {
  days: [
    {
      day: 1,
      stops: [
        {
          name: 'Sankyu Halal Japanese Food Asakusa',
          ward_or_city: 'Asakusa',
          start_time: '12:00',
          end_time: '13:00',
          is_dining: true
        },
        {
          name: 'Senso-ji Temple',
          ward_or_city: 'Asakusa',
          start_time: '13:20',
          end_time: '15:00',
          is_dining: false
        },
        {
          name: 'Shibuya Crossing',
          ward_or_city: 'Shibuya',
          start_time: '16:00',
          end_time: '18:00',
          is_dining: false
        }
      ]
    },
    {
      day: 2,
      stops: [
        {
          name: 'CafÃƒÆ’Ã‚Â© Restaurant Le Temps, Hotel Granvia Kyoto',
          ward_or_city: 'Kyoto Station',
          start_time: '11:30',
          end_time: '12:30',
          is_dining: true
        },
        {
          name: 'Gion',
          ward_or_city: 'Gion',
          start_time: '13:00',
          end_time: '15:00',
          is_dining: false
        }
      ]
    },
    {
      day: 3,
      stops: [
        {
          name: 'PHO ME HALAL RESTAURANT',
          ward_or_city: 'Dotonbori',
          start_time: '11:00',
          end_time: '12:00',
          is_dining: true
        },
        {
          name: 'Shin-Osaka Station',
          ward_or_city: 'Shin-Osaka',
          start_time: '12:45',
          end_time: '13:15',
          is_dining: false
        }
      ]
    },
    {
      day: 4,
      stops: [
        {
          name: 'OKOSTA',
          ward_or_city: 'Hiroshima Station',
          start_time: '11:30',
          end_time: '12:30',
          is_dining: true
        },
        {
          name: 'Peace Memorial Park',
          ward_or_city: 'Peace Memorial Park',
          start_time: '13:00',
          end_time: '15:00',
          is_dining: false
        }
      ]
    }
  ],
  transit_segments: [
    {
      from_station: 'Tokyo',
      to_station: 'Kyoto',
      mode: 'shinkansen',
      day: 2,
      order: 1
    },
    {
      from_station: 'Shin-Osaka',
      to_station: 'Hiroshima',
      mode: 'shinkansen',
      day: 3,
      order: 1
    }
  ],
  missing_info: []
};

function jsonResponse(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) reject(new Error('Request is too large.'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function callGemini(prompt, generationConfig) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL_ID;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Add it to .env or use demo mode.');
  if (!model) throw new Error('GEMINI_MODEL_ID is missing from .env.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'text/plain', ...generationConfig }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Gemini request failed.');
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text content.');
  return text;
}

/**
 * Split a free-text dietary requirement into individual constraints.
 *
 * The intake field is free text, and both the UI and the Stage 6 scenarios
 * express a compound requirement as "Halal AND Vegan". Passing that string
 * through as a SINGLE constraint made it a token no venue tag could ever
 * match, so every dining stop was reported non_compliant for a parsing reason
 * rather than a real one (Stage 6 TC15: required_tags was ["halal and vegan"]
 * and 9 of 9 verified stops were rejected).
 *
 * Each requirement must reach the validator separately, because
 * checkDietaryCompliance applies intersection semantics: a venue is compliant
 * only when its curated tags satisfy EVERY required tag. Splitting restores
 * that intended behaviour rather than weakening it.
 *
 * @param {string} value e.g. "Halal AND Vegan", "Halal, Vegan", "Vegan"
 * @returns {string[]} e.g. ["Halal", "Vegan"]
 */
function parseDietaryConstraints(value) {
  return String(value ?? '')
    .split(/\s+and\s+|\s*[,+&/]\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildConstraints(input) {
  return [
    `Arrival date: ${input.start || 'not specified'}`,
    `Arrival time: ${input.arrival_time || 'not specified'}`,
    `Arrival airport: ${input.arrival_airport || 'not specified'}`,
    `Departure date: ${input.end || 'not specified'}`,
    `Departure time: ${input.departure_time || 'not specified'}`,
    `Departure airport: ${input.departure_airport || 'not specified'}`,
    `Dietary requirement: ${input.dietary || 'None'}`,
    `Trip pace: ${input.pace || 'moderate'}`,
    `Optional cities and preferences: ${String(input.preferences || '').trim() || 'No additional preferences; recommend a suitable route.'}`
  ].join('\n');
}

function isExcludedLocalSegment(segment) {
  const mode = String(segment?.mode || '').trim();

  return /^(walking|walk)$/i.test(mode) ||
    /^local (subway|train|bus|tram)\b/i.test(mode) ||
    /^subway\b/i.test(mode) ||
    /^metro\b/i.test(mode) ||
    /^tram\b/i.test(mode) ||
    /^streetcar\b/i.test(mode);
}

function runPipeline(itinerary, input, metadata = {}) {
  const schemaResult = validateSchema(itinerary, itinerarySchema);
  if (!schemaResult.valid) {
    return { ok: false, stage: 'schema', error: 'Module 1 output failed schema validation.', details: schemaResult.errors, metadata };
  }

  const validation = validateItinerary(
    itinerary,
    data.dietary,
    data.travelTimes,
    parseDietaryConstraints(input.dietary)
  );
  const failures = collectFailureLog(validation);
  const segments = itinerary.transit_segments
    .filter((segment) => !isExcludedLocalSegment(segment))
    .map((segment) => {
      if (!metadata.demo || segment.service_type) return segment;
      const match = data.fares.find((fare) => fare.from === segment.from_station && fare.to === segment.to_station);
      return match ? { ...segment, service_type: match.service_type } : segment;
    });
  let audit = null;
  let calculatorError = null;

  try {
  if (segments.length === 0) {
    throw new MissingFareError(
      'No fare-bearing transit segments were generated for this itinerary.'
    );
  }

  const eligiblePasses = data.passes.filter(
    (pass) => pass.name === 'JR Pass 7-day Ordinary'
  );

  if (eligiblePasses.length === 0) {
    throw new Error('JR Pass 7-day Ordinary is missing from the pass table.');
  }

  audit = auditPassDecision(
    segments,
    data.fares,
    eligiblePasses
  );
  } 
  catch (error) {
  if (
    error instanceof MissingFareError ||
    error instanceof AmbiguousFareError ||
    error instanceof MissingSupplementDataError
  ) {
    calculatorError = {
      name: error.name,
      message: error.message
    };
  } else {
    throw error;
  }
  }

  let explanation = null;
  let module2Error = null;
  if (audit) {
    try {
      if (metadata.demo) {
        explanation = {
          verdict: audit.recommendation,
          headline: `${audit.recommendation}: the all-in pass comparison is complete.`,
          explanation: `The deterministic calculator compared individual fares with the selected pass for this sample route. The figures below are illustrative demo data and should be checked against current fares before travel.`,
          caveats: ['Demo output; no live Gemini narration was requested.'],
          evidence: audit.evidence
        };
      } else {
        explanation = parseAuditorResponse(metadata.module2Text);
      }
      const narrationCheck = verifyNarrationMatchesCalculator(explanation, audit);
      if (!narrationCheck.ok) module2Error = narrationCheck.problems;
    } catch (error) {
      module2Error = [error.message];
    }
  }

  return {
    ok: true,
    mode: metadata.demo ? 'demo' : 'live',
    itinerary,
    validation,
    failures,
    audit,
    calculatorError,
    explanation,
    module2Error,
    metadata: { ...metadata, model: metadata.demo ? null : process.env.GEMINI_MODEL_ID }
  };
}

/**
 * Generation config for Module 1: temperature 0 plus API-level JSON mode.
 *
 * responseMimeType puts the model in JSON mode so it cannot emit a markdown
 * fence or conversational preamble; responseSchema additionally pins the object
 * shape, so is_dining and the transit fields cannot go missing. Together these
 * are what fixed the 9-of-20 "Module 1 returned invalid or untagged JSON"
 * failures - the old call hardcoded responseMimeType: 'text/plain'.
 */
const MODULE1_JSON_CONFIG = {
  ...MODULE1_GENERATION_CONFIG,
  responseMimeType: 'application/json',
  responseSchema: MODULE1_RESPONSE_SCHEMA
};

/**
 * Call Module 1, repairing at most one bad response.
 *
 * Two failure kinds are treated the same way, matching the two exception types
 * a typed client would raise: the response is not parseable JSON at all, or it
 * parses but violates schema/itinerary_schema.json (which enforces the HH:MM
 * patterns that Gemini's responseSchema cannot express).
 *
 * On the single permitted retry the original prompt is resent with the concrete
 * failure appended, so the model is correcting a named defect rather than
 * guessing. After that the caller gets a null itinerary and the pipeline stops -
 * there is no third call.
 *
 * @returns {{itinerary: object|null, attempts: number, error: string|null}}
 */
async function runModule1WithRetry(builtPrompt) {
  let prompt = builtPrompt.prompt;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const raw = await callGemini(prompt, MODULE1_JSON_CONFIG);
    const { itinerary, error } = parseItineraryResponseDetailed(raw);

    if (itinerary) {
      const { valid, errors } = validateSchema(itinerary, itinerarySchema);
      if (valid) return { itinerary, attempts: attempt + 1, error: null };
      lastError = `Schema validation failed: ${errors.slice(0, 4).join('; ')}`;
    } else {
      lastError = error;
    }

    if (attempt === MAX_RETRIES) break;

    console.warn(`WARN  Module 1 attempt ${attempt + 1} rejected (${lastError}); retrying once.`);
    prompt =
      `${builtPrompt.prompt}\n\n` +
      `Error: Your output was invalid JSON. ${lastError}. ` +
      'Rewrite your exact response as valid JSON.';
  }

  return { itinerary: null, attempts: MAX_RETRIES + 1, error: lastError };
}

async function generate(input, demo = false) {
  if (demo) return runPipeline(DEMO_ITINERARY, input, { demo: true, injectionAttempted: false });

  const builtPrompt = buildModule1Prompt(buildConstraints(input), {
    approvedDiningVenues: APPROVED_DINING_VENUES,
    canonicalAreas: CANONICAL_AREAS
  });

  const module1 = await runModule1WithRetry(builtPrompt);
  const itinerary = module1.itinerary;
  if (!itinerary) {
    return {
      ok: false,
      stage: 'module1',
      error: `Module 1 returned invalid JSON after ${module1.attempts} attempt(s): ${module1.error}`,
      metadata: {
        injectionAttempted: builtPrompt.injectionAttempted,
        removed: builtPrompt.removed,
        module1Attempts: module1.attempts
      }
    };
  }

  const validation = runPipeline(itinerary, input, { injectionAttempted: builtPrompt.injectionAttempted, removed: builtPrompt.removed });
  if (!validation.audit) return validation;

  const module2Text = await callGemini(buildModule2Prompt(validation.audit), MODULE2_GENERATION_CONFIG);
  return runPipeline(itinerary, input, { injectionAttempted: builtPrompt.injectionAttempted, removed: builtPrompt.removed, module2Text });
}

async function serveStatic(request, response) {
  const requestPath = request.url === '/' ? '/japan_travel_planner_prototype.html' : new URL(request.url, 'http://localhost').pathname;
  const safePath = normalize(requestPath).replace(/^[/\\]+/, '').replace(/^([.][.][\\/])+/, '');
  const filePath = join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) return jsonResponse(response, 403, { error: 'Forbidden.' });
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
    response.end(contents);
  } catch (error) {
    jsonResponse(response, error.code === 'ENOENT' ? 404 : 500, { error: 'Not found.' });
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/generate') {
      const input = JSON.parse(await readBody(request));
      return jsonResponse(response, 200, await generate(input, input.mode === 'demo'));
    }
    if (request.method === 'GET' && request.url === '/api/health') {
      return jsonResponse(response, 200, { ok: true, configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL_ID) });
    }
    if (request.method === 'GET') return serveStatic(request, response);
    return jsonResponse(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    return jsonResponse(response, 500, { ok: false, stage: 'server', error: error.message || 'Unexpected server error.' });
  }
});

server.listen(PORT, () => console.log(`Japan planner running at http://localhost:${PORT}`));
