# Japan Travel Itinerary Planner

**PE6203 (Generative AI and Agentic AI) — Group Project 1**
Presentation: 10 Sept 2026 · Report due: 18 Sept 2026

## What this is

A Japan travel planning tool built around one verifiable claim a general-purpose chatbot can't make: whether a transit pass is worth it for *your specific route*, calculated against real fares — not a guess. Full design and rationale: [`Architecture.md`](./Architecture.md).

## Why this isn't just an AI wrapper

ChatGPT can suggest a Japan itinerary in one message. It has no mechanism to guarantee its fare numbers are current, and no way to show which of its claims are actually sourced. This app can do both:

- Every factual claim carries a citation to a dated source (**Faithfulness**).
- The pass-vs-tickets verdict is computed by a deterministic calculator and only narrated by the LLM, never guessed by it (**Program-of-Thoughts**).

## Core modules

| Module | Type | Job |
|---|---|---|
| Itinerary Generator | LLM | Turns trip constraints into a structured day-by-day plan (JSON) |
| Constraint Validator | Non-LLM | Dietary and geographic/time feasibility checks against curated lookup tables |
| **Pass ROI Auditor** (flagship) | LLM + calculator | Sums real per-segment fares and verdicts on transit passes, math shown |

Full specs, prompts, and design rationale: [`Architecture.md`](./Architecture.md)
Rules for any AI tool building against this repo: [`CLAUDE.md`](./CLAUDE.md)

## Tech stack

- **App builder:** Gemini Canvas (no-code/AI-assisted) — implements the UI and wiring; does not decide architecture, prompts, or evaluation, per the assignment's core rule.
- **LLM:** current Gemini flash-tier model, temperature = 0. Verify the live model ID before building — see `CLAUDE.md`; Gemini 1.5 Pro/Flash are already retired.
- **Retrieval:** rule-based keyword matching over ~15–20 curated documents. No vector database.
- **Data:** `data/fare_table.json`, `data/dietary_table.json`, `data/travel_time_table.json` (all dated, sourced) and `rag_corpus/` (entry rules, pass terms, dietary notes) — plain structured files, not a database.
- **Calculator/validator logic:** deterministic functions inside the app — never delegated to the LLM.

## Repo contents

```
architecture.md      — full system design, Stages 1-7 of the assignment brief
CLAUDE.md             — locked decisions for any AI coding/building tool
README.md             — this file
fare_table.json        — curated fare data (Ulfa)
rag_corpus/            — 15-20 dated source documents (Ulfa)
test_cases.json        — 20 evaluation cases across A/B/C variants (Mutya)
```

Everything in `data/` needs to be manually pasted/uploaded into the Canvas build session — Canvas does not pull live from this repo. **This repo is the single source of truth.** Only Ulfa edits these files directly; everyone else pulls the latest copy before pasting into Canvas rather than hand-editing a local version.

## Team

| Member | Owns |
|---|---|
| Rohit Panda | Module 1 + Module 2 prompts, calculator logic |
| Ulfa Herdyani | Fare table + RAG corpus curation — every entry dated and sourced |
| Mutya Sai Surya S. K. | 20 test cases; 4-criteria scoring across Variants A/B/C |
| Shi Shuyi | Constraint Validator logic; failure-analysis logging |
| Chan Hio Weng | Canvas UI; wiring the modules together |
| Chanchai Chan | Report + slides; cover page (names, emails, contributions) |

## Status

Architecture locked (see `Architecture.md`). Build in progress.

## Run locally

1. Copy `.env.example` to `.env` and add `GEMINI_API_KEY`.
2. Confirm `GEMINI_MODEL_ID` is set to the currently verified model.
3. Run `npm start` and open `http://localhost:3000`.

The browser never receives the API key. Use the prototype's demo mode to review
the interface without making a Gemini request; live mode runs Module 1,
deterministic validation and fare calculation, then Module 2 narration through
the local server.

**Live app link:** *add here once deployed — the brief requires the link to work on submission, so test it externally (not just from a logged-in Canvas session) before the report goes in.*

## Assignment compliance note

Per the brief's core rule: AI tools implement this design; they do not replace the team's design decisions. `CLAUDE.md` exists specifically to keep any AI building tool inside that boundary.