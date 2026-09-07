# CLAUDE.md — Project Context for AI Assistants

This file is for any AI tool (Claude Code, Gemini Canvas, or otherwise) implementing this project. Read `architecture.md` first for full detail — this file states what's locked and what you're allowed to touch.

## What this project is

A Japan travel itinerary planner for PE6203 Group Project 1 ("Design Your Own Generative AI Application"). Full design lives in `architecture.md`. The flagship feature is the Pass ROI Auditor — a real fare-calculator (Program-of-Thoughts pattern) that verifies whether a transit pass is worth it for a specific itinerary, using real prices rather than an LLM's guess, with every factual claim traceable to a dated source (Faithfulness).

## Hard rule from the assignment brief

AI tools may **implement** this design. They may **not** redesign the architecture, choose different modules, change the evaluation approach, or invent new success criteria. If something in this spec looks wrong once you're building it, flag it in conversation and ask — don't silently substitute your own judgment. The brief is graded on the team's design decisions, not the tool's.

## Locked decisions — do not change without asking Rohit

- **Two-module split.** Module 1 (Itinerary Generator) produces structured JSON only, after a short internal Zero-Shot CoT reasoning pass. Module 2 (Pass ROI Auditor) is Program-of-Thoughts: LLM parses to a structured computation request, a deterministic function does the arithmetic, the LLM only narrates the result.
- **The calculator must add the Nozomi/Mizuho supplement fee for any segment using those services when computing the "if you buy the pass" cost.** A flat pass price alone overstates the pass's value and will produce wrong BUY/DO NOT BUY verdicts on faster-train itineraries — this was caught during implementation planning, not in the original design, so don't assume the fare table already handles it without checking.
- **Constraint Validator is non-LLM.** Dietary and geographic checks are lookups against curated tables, not model judgment calls — this is what makes the 100% / 90% success-criteria claims defensible under direct questioning.
- **Every factual/numeric claim carries an `evidence` field** (source id + date). This is the Faithfulness mechanism — don't drop it to save tokens.
- **LLM-as-Judge is used in exactly one place:** checking whether quoted evidence semantically supports a claim, for the Faithfulness score. It does not score Financial Accuracy, Constraint Adherence, or Geographic Plausibility — those stay deterministic. Don't expand its scope without asking.
- **Both LLM modules run at temperature = 0.** Required for a fair, low-noise A/B/C comparison in Stage 6 — don't change this for "more natural" output.
- **Prompt structure uses explicit delimiters** (`<system_rules>`, `<constraints>`, `<itinerary_json>`) separating instructions from user input. This is the actual injection-resistance mechanism — don't collapse it into a single unstructured prompt string.
- **Fare data lives in a structured table** (CSV/JSON), separate from the prose RAG corpus. Don't fold fares into embeddings-retrieved documents — exact numeric lookup, not semantic search.
- **No vector database.** Retrieval over the 15–20 curated documents is rule-based keyword matching — deliberately chosen because the corpus is exact-match jargon (station names, pass names, regulation terms), not because of time pressure alone.
- **Build in a no-code / AI-assisted app builder**, not a hand-rolled LangChain orchestrator.
- **Only Ulfa edits `data/fare_table.json`, `data/dietary_table.json`, `data/travel_time_table.json`, and `rag_corpus/` directly in the shared GitHub repo.** Anyone building in Canvas pulls the latest copy at the start of each session and pastes it in fresh — never hand-edit these files inside Canvas and push changes back yourself. The repo is the single source of truth; Canvas holds a snapshot that goes stale the moment the repo updates.
- **Constraint Validator: unmatched venue or ward pair always resolves to `"unverified"`, never a silent pass or fail.** This is the rule that keeps the 100%/90% dietary and geographic claims honest given incomplete curated coverage. Do not let an unmatched lookup default to "compliant" for convenience.
- **Constraint Validator never uses itinerary-derived strings as anything but plain lookup keys** — no `eval`, no dynamic code construction from venue/ward names, regardless of what the upstream neutralizer catches or misses.
- **`is_dining` is a required field on every Module 1 stop**, not optional. A missing value is a schema error, not a silently-unverified dietary check. Any Stage 6 test output generated before this was added needs regenerating — tell Mutya.
- **Before starting any Claude Code session on this repo, confirm your local `architecture.md` and `CLAUDE.md` match the latest versions given to you — diff them if unsure.** A stale local copy, not a data or communication problem, is what caused the `ward` vs `ward_or_city` churn in the Constraint Validator build. This step is now mandatory before every session, not just this one.

## Explicitly rejected — do not add these mid-build even if they seem like an improvement

- **Tree of Thoughts** for Module 1. Considered and rejected as out of scope for the timeline; a single CoT pass is the substitute. Don't "upgrade" to branching/backtracking logic — it wasn't an oversight, it was a decision.
- **A full Self-RAG / Corrective RAG agentic loop.** The evidence-field + LLM-Judge check is a deliberate lightweight substitute. Don't add retry loops or reflection tokens.

## Things that change often — verify before hardcoding

- **Gemini model IDs.** Check Google's live deprecations page before wiring any API call. Gemini 1.5 Pro and Gemini 1.5 Flash were retired in September 2025 — don't copy a model string from an old doc or draft without confirming it's still live.
- **Gemini API endpoint.** Google's Interactions API (GA since June 2026) is now the primary interface; `generateContent` remains fully supported. Sources disagree on the exact path (`/v1beta/interactions` vs `/v1beta2/interactions`) — verify against the official SDK/docs directly, not a blog post, before hardcoding either. Supporting both behind an env var (as already implemented) is the safer default until this settles.
- **JR Pass and regional pass prices.** Every price entry needs a retrieval date attached. If a price looks like it hasn't been checked recently, flag it rather than trusting it.

## Resolved decisions

- **Model tier:** reasoning-tier model confirmed. Module 1's explicit CoT trigger is dropped by design — this is documented in `architecture.md` as a decision, not an omission.
- **Model ID:** `gemini-3.8-flash` confirmed live as of 4 Sept 2026 (released 2 Sept 2026). Still read from an environment variable, never hardcoded — no replacement is announced yet, but this space has moved roughly every 3-10 weeks this year.
- **Delimiter neutralizer implemented.** User input is sanitized to strip any `<system_rules>`, `<constraints>`, or `<itinerary_json>` sequence before insertion, with attempts logged as `injectionAttempted` for Stage 7. Verify it catches case variants, whitespace-split tags, and Unicode lookalikes before treating this as fully closed — an exact-string-only filter has a known bypass.

## Current status

- Presentation: **10 September 2026.** Report due: **18 September 2026.**
- **Stage 6 is complete.** Executed 7 Sept 2026 on `gemini-3.8-flash`: 60/60 runs (20 cases x 3 variants), 0 errors, 0 judge failures. Results in `results/`. Variant C met the Geographic Plausibility target (95%); Financial Accuracy (57.1%), Dietary Adherence (95%) and Faithfulness (15.8% of cases / 65.6% of claims) missed theirs, each with a documented cause carried into Stage 7. Headline A/B/C result: A and B carry **zero** evidence pointers across 1,166 factual claims; C backs 410 of 625.
- **Stage 7 is unblocked** and owned by Karthik — analysis only, no retests (API credits reserved for the demo).
- Architecture is decided as of this file (see `architecture.md`). Building starts now.
- Report needs a cover page (team names, emails, per-member contribution) — doesn't count toward the 10-page limit, but don't forget it late.

## When in doubt

Ask a clarifying question rather than guessing at a design decision. The rubric explicitly grades the team's design choices — a wrong guess costs more here than a question would.