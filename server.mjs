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
  parseItineraryResponse,
  MODULE1_GENERATION_CONFIG
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

const [{ fares, passes }, dietaryData, travelTimeData] = await Promise.all([
  readFile(join(ROOT, 'data/fare_table.json'), 'utf8').then(JSON.parse),
  readFile(join(ROOT, 'data/dietary_table.json'), 'utf8').then(JSON.parse),
  readFile(join(ROOT, 'data/travel_time_table.json'), 'utf8').then(JSON.parse)
]);
const data = { fares, passes, dietary: dietaryData.dietary, travelTimes: travelTimeData.travel_times };

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
      generationConfig: { ...generationConfig, responseMimeType: 'text/plain' }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Gemini request failed.');
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text content.');
  return text;
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

  const validation = validateItinerary(itinerary, data.dietary, data.travelTimes, input.dietary ? [input.dietary] : []);
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

async function generate(input, demo = false) {
  if (demo) return runPipeline(DEMO_ITINERARY, input, { demo: true, injectionAttempted: false });

  const builtPrompt = buildModule1Prompt(buildConstraints(input));
  const rawModule1 = await callGemini(builtPrompt.prompt, MODULE1_GENERATION_CONFIG);
  const itinerary = parseItineraryResponse(rawModule1);
  if (!itinerary) return { ok: false, stage: 'module1', error: 'Module 1 returned invalid or untagged JSON.', metadata: { injectionAttempted: builtPrompt.injectionAttempted, removed: builtPrompt.removed } };

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
