# Japan Travel Itinerary Planner — System Architecture
### PE6203 (Generative AI and Agentic AI) — Group Project 1

**Status:** Locked. Implement this design — do not redesign it mid-build. If a test case exposes a real flaw, bring it back for a decision rather than quietly changing the architecture.

This document is structured to match the assignment brief's own stage numbering (Stages 1–7), so grading evidence is easy to locate.

---

## Stage 1 — Problem & Success Criteria

**Problem statement:** International travelers can get a plausible-sounding Japan itinerary from any general-purpose chatbot in seconds. What they can't get from that chat is a *verified* answer to the question that actually costs or saves them money and time: is a transit pass worth it for *this specific route*, and is this schedule actually walkable/rideable as laid out? Generic chat answers both with fluent, confident guesses built on stale training data — not on this week's fares or real geography.

**Target user:** First-time and returning international travelers planning a multi-city Japan trip, with dietary constraints, deciding between regional transit passes and point-to-point tickets.

**Success criteria — the 4 fixed evaluation criteria (applied identically to Variants A, B, and C in Stage 6):**

| # | Criterion | Target | Why this target, not a different one |
|---|---|---|---|
| 1 | Financial accuracy | Pass/ticket verdict matches manually-verified real fares on ≥90% of test itineraries | Arithmetic, not judgment — 90% leaves room for fare-table coverage gaps, not for a calculator being "roughly right" |
| 2 | Constraint adherence (dietary) | 100% of recommended venues pass the dietary hard-filter | Honest 100% because it's a lookup against a curated list, not an LLM asked to remember dietary rules |
| 3 | Geographic plausibility | ≥90% of stop-to-stop transitions pass the feasibility check; failures are flagged to the user, never silently shown as fine | We claim high accuracy plus honest flagging — defensible under direct questioning, unlike a zero-failure claim |
| 4 | Faithfulness (grounding) | ≥90% of factual/numeric claims carry a verifiable evidence pointer to a dated source | See Stage 6 — this is the course's own Faithfulness metric, not an invented one |

**Why this beats "just ask ChatGPT":** A chat session can suggest a trip and *estimate* whether a pass is worth it. It has no mechanism to guarantee that estimate reflects this week's real fares — it's pattern-matching on training data. This system's flagship claim, and the line to open the demo with: **"ChatGPT can suggest a trip. It can't audit it — and it can't show you which of its claims are actually backed by a source."** Both halves of that claim (verified math, verified sourcing) come from mechanisms below, not from a bigger model.

---

## Stage 2 — System Architecture

```
User intake form
      │
      ▼
Module 1 — Itinerary Generator (LLM, PoT-adjacent reasoning)
      │
      ├──────────────┐
      ▼              ▼
Constraint       Module 2 — Pass ROI Auditor
Validator        (Program-of-Thoughts: calculator + LLM explainer)
(non-LLM)             │
      │                │
      └───────┬────────┘
              ▼
        Output UI
  (itinerary + verdicts + flags + evidence + sources)
```

**Module boundaries:**
- **Module 1 (LLM):** translates free-text constraints into a structured itinerary. Never judges feasibility or cost.
- **Constraint Validator (non-LLM):** deterministic dietary and geographic/time checks against curated lookup tables.
- **Module 2 (LLM + deterministic calculator, Program-of-Thoughts pattern):** computes and explains the pass-vs-tickets verdict. The LLM never performs the arithmetic itself.
- **Output UI:** renders itinerary, verdicts, flags, and evidence citations together — nothing is shown without its supporting source or calculation visible.

**Technique-selection rationale (ties to the course's 5-step order of implementation):** this system deliberately stays within Steps 1–4 of that framework — clear instruction, few-shot examples, light reasoning guidance (CoT), and decomposition/tools (PoT, RAG). It explicitly does **not** reach for Step 5 (sampling/search techniques like Self-Consistency or Tree of Thoughts) — see the rejected-techniques note in Stage 7. That's a cost/benefit call, documented on purpose, not an oversight.

---

## Stage 3 — AI Modules & Prompts

### Module 1 — Itinerary Generator (LLM)

- **Purpose:** turn free-text trip constraints into a structured, machine-checkable itinerary. Feasibility and cost are deliberately out of scope for this module.
- **Input:** trip dates, cities/regions of interest, dietary constraints, pace preference, arrival/departure airports.
- **Reasoning step (Zero-Shot CoT):** before emitting JSON, the model writes a short internal reasoning pass — "first group requested destinations into geographic clusters by ward/city, then sequence clusters into days, then assign time windows." This reasoning is logged for failure-analysis but not shown to the user or passed to Module 2 — only the final JSON block is parsed downstream.
  - **Model-tier decision (resolved):** the team is using a reasoning-tier model, so the explicit "let's think step by step" trigger is deliberately dropped from the prompt below — the course material notes it's redundant and can distort output on models that already reason internally. Report this as a decision, not an omission: "reasoning-tier model, trigger dropped by design."
- **Output format (strict, nothing else emitted):**
  - `days`: list of days → each day has `stops`: list of `{name, ward_or_city, start_time, end_time, is_dining}` — `is_dining` is **required**, not optional: a missing value must be a schema error the model has to fix, not a silently-unverified dietary check downstream.
  - `transit_segments`: list of `{from_station, to_station, mode, day, order}`
  - `missing_info`: list of any fields the model couldn't fill from the input — never guess a field, list it here instead
- **Prompt anatomy (System Brief / Delimiters / Variable Slot / Assistant Marker):** the output schema above lives *inside* `<system_rules>`, not just described in this document — the model has no field spec to follow otherwise. User-supplied text is sanitized before insertion: any `<system_rules>`, `<constraints>`, or `<itinerary_json>` sequence a user tries to inject is stripped, and the attempt is logged (`injectionAttempted`) for Stage 7 failure analysis. This is what turns the injection-resistance claim in `guardrails.md` §2 into an actual mechanism instead of a structural convention. **Verify the neutralizer catches case variants, whitespace-split tags, and Unicode lookalikes, not just the exact literal string** — an exact-match-only filter is a filter with a known bypass.
  ```xml
  <system_rules>
  You are a Japan itinerary structuring assistant. Never invent a station name.
  Never guess a value you cannot support from the user's input — put it in
  missing_info instead. Output ONLY valid JSON, matching this schema, inside
  <itinerary_json> tags. Nothing outside that tag is read by downstream systems.

  Schema: { days: [...], transit_segments: [...], missing_info: [...] }
  </system_rules>
  <constraints>
  {{user_trip_constraints, sanitized}}
  </constraints>
  <itinerary_json>
  ```
- **Decoding parameters:** temperature = 0. This isn't a style choice — Stage 6 requires a *controlled* comparison across Variants A/B/C, and temperature noise would make that comparison unfair.

### Constraint Validator (non-LLM, deterministic)

- **Dietary filter:** every stop tagged as dining is checked against the curated halal/vegan list (a structured lookup table, not a prose RAG document). Failing stops are rejected/flagged; log which requirement rejected which stop, for the failure-analysis stage.
- **Geographic/time filter:** a small hardcoded lookup of approximate inter-ward travel times for the major wards/cities in scope. Any two consecutive stops whose scheduled gap is shorter than the looked-up travel time gets flagged.
- **Matching rule (locked):** both checks normalize keys before matching — lowercase, trim, strip punctuation, **and Unicode-normalize (NFKC) with diacritics stripped** (e.g., "Tōkyō" and "Tokyo" must match) — every place name in this system is a romanized Japanese term, so macron variance is the expected case, not an edge case. Exact string equality on raw LLM-generated text will misfire on real formatting and romanization variance. **Any venue or ward pair not found after normalization resolves to `"unverified"` — never a silent pass or fail.** This is the single most important rule in this module; it's what keeps the 100%/90% claims honest when curated coverage is incomplete, which it will be this week.
- **Geographic check compares consecutive stops within the same day only.** Time-of-day subtraction across a day boundary (last stop of Day 1 vs. first stop of Day 2) is meaningless and must not be computed as a raw gap — skip the check across day boundaries entirely rather than producing a negative or nonsensical value.
- **Table schemas (locked, matches what's actually built and tested):**
  - Dietary table row: `{venue_name, ward, tags: [...], source_id, source_date}`
  - Geographic table row: `{ward_a, ward_b, estimated_transit_minutes, mode, source_id, source_date}` — symmetric by design (same time both directions); this is a stated simplification, not an oversight. **`mode` is recorded and reported but does not currently affect the pass/fail verdict** — the table holds one travel-time value per ward pair, not a value per mode, so there's nothing yet to disambiguate against. Documented as a simplification, not an oversight.
  - **Same-location rows are required, not optional.** Two consecutive stops in the same area (e.g., both in Asakusa) produce a ward pair with no cross-location row — under the locked unverified-state rule, that resolves to `"unverified"`, not an automatic pass. Ulfa's table must include same-ward rows (e.g., Asakusa↔Asakusa, ~10 min walking) or the Geographic Plausibility criterion will read as mostly-unverified on any itinerary with realistic within-area hops.
  - **Naming note:** despite the name, `ward`/`ward_a`/`ward_b` should be populated with tourist-recognizable place names (Asakusa, Shibuya, Ginza, Gion, Dotonbori), not strict administrative ward names — a real administrative ward (e.g., Taito Ward, which contains both Asakusa and Ueno) is too coarse a unit for a walking-time feasibility check. Module 1's stop objects use `ward_or_city` as the field name; the Validator translates this to `ward` at exactly one point in its lookup code — the two names don't match, but the values they hold do.
  - **Duplicate rows in either table throw an error rather than silently shadowing.** A shadowed row would make the 100% dietary claim depend on file load order — this is correct, locked behavior.
- **Validator output includes a per-check breakdown**, not just a combined `summary` — Financial-style criteria (100% dietary, 90% geographic) have different targets and must be scorable independently.
- **Known limitation, worth naming in the report rather than hiding:** the technically stronger design has Module 1 emit a `venue_id` referencing the curated table directly, eliminating name-matching entirely. Not implemented this week — it would require giving Module 1 retrieval access it was deliberately never given, and reopening an already-tested module isn't worth it five days out. Documented here as a known, considered trade-off.
- **Security:** itinerary-derived strings (venue names, wards) are used only as plain lookup keys in this module — never `eval`, never dynamic code construction, never string concatenation into anything executable, regardless of what survives upstream sanitization.
- **Why non-LLM:** this is what makes the 100% dietary claim and the 90%-plus-honest-flagging geographic claim defensible in front of a skeptical grader — the check is arithmetic and lookup, not model judgment that might fail on the exact case someone tests live.

- **Purpose:** answer the one question a generic chatbot can't verify — is the JR Pass (or a relevant regional pass) worth it for *this* itinerary, at *this week's* prices.
- **Input:** the `transit_segments` list from Module 1.
- **Why this is Program-of-Thoughts, not just "an LLM call":** the LLM's role is limited to translating the segment list into a structured computation request (which fares to look up, which pass(es) to compare). A deterministic function executes the actual sum and comparison. The LLM only touches numbers again to *narrate* a result it did not compute — this is the course material's own stated remedy for arithmetic slips, applied to the highest-stakes claim in the app.
- **Known correctness requirement (verify before building):** the JR Pass does not cover Nozomi/Mizuho services for free — using the pass on these trains requires an extra supplement fee on top of the base pass price. The calculator's pass-price comparison must add this supplement for every Nozomi/Mizuho segment in the itinerary; it cannot simply compare `sum(ticket fares)` against a flat pass price. Ulfa's fare table needs a `service_type` field (Nozomi / Hikari / Kodama / Sakura) per segment so the calculator can apply this correctly.
- **Output format:** `{recommendation: "BUY"|"DO NOT BUY", pass_price, ticket_total, difference, per_segment_breakdown, evidence: [{claim, source_id, source_date}]}`
- **Prompt anatomy:** same System Brief / Delimiters / Variable Slot structure as Module 1, with the calculator's output injected into the Variable Slot and the LLM instructed only to explain, never recompute.
- **Decoding parameters:** temperature = 0, for the same controlled-comparison reason as Module 1.

---

## Stage 4 — RAG / In-Context Learning

- **Fare data:** a structured table (CSV/JSON) — station-pair → yen amount, dated, sourced from official JR fare pages. Looked up directly by the calculator, not retrieved via embeddings. **Required fields per row, confirmed during implementation:** `service_type` (Nozomi/Hikari/Kodama/Sakura — needed for the pass-supplement rule), `supplement_yen` (Nozomi/Mizuho rows only — the fee varies by distance, so this can't be a single constant), `source_id`, `source_date`. A missing `supplement_yen` on a Nozomi/Mizuho row is a hard error (`MissingSupplementDataError`), not a silent guess — the calculator refuses to produce a verdict on incomplete data rather than invent a number. This is the correct behavior; do not change it to a fallback default.
- **Initial dataset delivered** (`data/fare_table.json`, `data/dietary_table.json`, `data/travel_time_table.json`, `data/rag_corpus/`): covers the Tokyo–Kyoto–Osaka–Hiroshima golden route, 9 real halal/vegan venues, 6 sourced RAG documents. Stated gaps, not hidden ones: Shin-Osaka↔Hiroshima's Nozomi supplement is left `null` on purpose (throws rather than guesses); dietary coverage is Asakusa/Shibuya/Shinjuku only (Shin-Okubo named as a gap); same-ward travel times are reasonable defaults, not researched facts.
- **Prose RAG (15–20 documents):** Visit Japan Web / entry procedures, regional pass terms, dietary venue lists.
- **Retrieval method: rule-based keyword matching, not a vector database.** This is a reasoned choice, not just a time-saver: the course material frames lexical/TF-IDF-style retrieval as the correct tool specifically for "exact-string matching for unique identifiers... and specialized jargon" — station names, pass names, and terms like "Visit Japan Web" are exactly that category of exact-match jargon. A dense/embedding retriever would add latency and infrastructure risk to solve a matching problem lexical search already solves well at this corpus size (15–20 docs).
- **Every document carries a retrieval date.** Numeric claims from a stale document trigger a "verify before travel" flag rather than being stated as current fact — e.g., the JR Pass price hike applies to overseas-agency purchases only, not the official online site; that caveat lives in the snippet, not lost in generation.

---

## Stage 5 — Build Tooling

- Prototype in a no-code / AI-assisted app builder (e.g., Gemini Canvas), per the brief's own Stage 5 guidance. Do not hand-roll a custom orchestrator in LangChain this week — no rubric credit over a no-code equivalent, and it costs days the team doesn't have.
- Fare table and dietary list ship as plain structured files the builder can read directly, kept outside the LLM's prompt context where possible, so a price update doesn't require re-tuning a prompt.
- **Verify the exact Gemini model ID against Google's live deprecations page before wiring any API call.** Gemini 1.5 Pro and Gemini 1.5 Flash were already retired (Sept 2025) — don't copy a model string from an old draft without checking it's still live.

---

## Stage 6 — Evaluation

**20 test cases**, covering: normal (golden-route itineraries), ambiguous ("snow and beaches in 4 days"), missing-information (no departure airport), conflicting-constraint (vegan diet + a request for authentic Kobe beef), adversarial (a request to process an actual payment or a fake credit-card string).

**3 variants, same 20 cases, same 4 criteria — never a different evaluation lens per variant:**
- **A** — bare LLM: no system prompt, no RAG, no validator.
- **B** — structured prompts only: no RAG, no validator.
- **C** — full system as specified in this document.

**Faithfulness — formalized:**
```
Faithfulness = |generated claims with a verifiable evidence pointer| / |total generated factual claims|
```
Every numeric/factual claim from Module 2 (and any RAG-grounded narrative text) carries an `evidence` field pointing to a specific source document and date. A bounded LLM-as-Judge pass checks whether the quoted evidence *actually semantically supports* the claim — not just that a pointer exists. This is a deliberately narrow use of LLM-as-Judge, appropriate because claim-evidence entailment is genuinely a judgment call. Financial Accuracy, Constraint Adherence, and Geographic Plausibility stay fully deterministic — they don't need a judge, and using one there would just add noise.

---

## Stage 7 — Failure Analysis

For every failing test case, log: **input → expected → actual → cause → fix → retest.** Prioritize by rubric weight: Financial Accuracy and Constraint Adherence failures first (these carry the 90–100% claims), then Geographic Plausibility and Faithfulness failures. Note explicitly whether each fix came from a better prompt, a better few-shot example, better RAG curation, or a workflow change — the brief asks for this breakdown directly.

### Techniques considered and explicitly not used

- **Tree of Thoughts.** Theoretically the better fit for itinerary planning — a bad Day-1 geographic cluster cascades through the whole week, which is exactly ToT's use case (a single early mistake ruins the outcome). Full ToT branching, scoring, and backtracking is out of scope for a 6-day build; a single Zero-Shot CoT pass in Module 1 is the substitute. Documenting this trade-off in the report demonstrates informed judgment rather than an oversight.
- **Full Self-RAG / Corrective RAG loop.** The Faithfulness evidence-field-plus-LLM-Judge check above is a lightweight, manual analog of Self-RAG's `[IsSup]` reflection token, without the overhead of a full agentic reflection/retry loop. Chosen for build-time reasons, not because the technique was unknown.

---

## Optional Stretch Feature (build only if the core system is stable early — do not let this compete for time)

**VLM menu-photo dietary check:** upload a photo of a Japanese restaurant menu; a vision-language model flags dishes matching the user's dietary restrictions. Being honest about this: a general-purpose chatbot can already do a version of this today, so it is a UX nicety, **not** a differentiator. It must never take priority over the Pass ROI Auditor or the 20-test-case evaluation — those are what the rubric and the "why not ChatGPT" argument actually rest on.

---

## Team Ownership (mapped to this architecture)

| Member | Owns |
|---|---|
| Rohit Panda | Module 1 + Module 2 prompts, calculator logic |
| Ulfa Herdyani | Fare table + RAG corpus curation — every entry dated and sourced |
| Mutya Sai Surya S. K. | 20 test cases; 4-criteria scoring across Variants A/B/C |
| Shi Shuyi | Constraint Validator logic; failure-analysis logging |
| Chan Hio Weng | Builder UI; wiring the modules together |
| Chanchai Chan | Report + slides, mapped to the 6/2/2-minute presentation structure; owns the cover page (team names, emails, per-member contribution breakdown — required, doesn't count toward the 10-page limit) |