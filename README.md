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
- **Retrieval:** rule-based keyword matching over 17 curated documents. No vector database.
- **Data:** `data/fare_table.json`, `data/dietary_table.json`, `data/travel_time_table.json` (all dated, sourced) and `rag_corpus/` (entry rules, pass terms, dietary notes) — plain structured files, not a database.
- **Calculator/validator logic:** deterministic functions inside the app — never delegated to the LLM.

## Repo contents

```
architecture.md      — full system design, Stages 1-7 of the assignment brief
CLAUDE.md             — locked decisions for any AI coding/building tool
README.md             — this file
fare_table.json        — curated fare data (Ulfa)
rag_corpus/            — 17 dated source documents (Ulfa)
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

**Presentation:** 10 Sept 2026 · **Report due:** 18 Sept 2026

| Stage | Owner | Status | Last Updated |
|-------|-------|--------|--------------|
| **Stage 5 (UI)** | Ulfa | ✅ Complete | 7 Sept |
| **Stage 6 (Testing)** | Ulfa/Rohit | ✅ Complete — 60/60 runs | 7 Sept |
| **Stage 7 (Analysis)** | Karthik | 🟡 Ready to Start — results available | 7 Sept |
| **Report + Slides** | Leo/Kyle/Harry | ❌ Not Started | — |

### Stage 6 results

**Executed:** 7 Sept 2026 · **Model:** `gemini-3.8-flash` · **60/60 runs, 0 errors, 0 judge failures**

Artefacts: `results/stage6_evaluation_matrix.csv`, `results/stage6_evaluation_summary.json`,
`results/variant_{a,b,c}/TC01-TC20.json`

**Variant C against the Stage 1 targets:**

| Criterion | Target | Actual | Met? | Scoring lens |
|---|---|---|---|---|
| Financial accuracy | >=90% | 57.1% (8/14 scored) | No | deterministic-calculator |
| Dietary adherence | 100% | 95.0% (19/20) | No | deterministic-validator |
| Geographic plausibility | >=90% | 95.0% (19/20) | **Yes** | deterministic-validator |
| Faithfulness | >=90% | 15.8% of cases (65.6% of claims) | No | llm-judge |

**Headline A/B/C result — Faithfulness (claims carrying a verifiable evidence pointer):**

| Variant | Factual claims | Supported | Ratio |
|---|---|---|---|
| A (minimal LLM) | 525 | 0 | 0.0% |
| B (prompt only) | 641 | 0 | 0.0% |
| C (full system) | 625 | 410 | **65.6%** |

**Four findings handed to Stage 7** (see `STAGE7_FAILURE_ANALYSIS.md` when written):
1. All 6 financial FAILs are "DO NOT BUY but expected BUY" — the ground-truth `BUY`
   expectations are wrong, not the calculator (e.g. TC04: tickets 17,640 yen vs pass 53,990 yen).
2. TC15's dietary FAIL is a harness bug — `"Halal AND Vegan"` is passed as one
   unmatched constraint (`server.mjs:259`). Fixing it takes dietary to 20/20 = 100%.
3. TC16's geographic FAIL is genuine — Module 1 scheduled back-to-back stops with a
   0-minute gap where 10 minutes of walking is required.
4. TC05/TC08/TC10/TC12 produced no audit and log `calculatorError: [object Object]` —
   the error is not serialised, so the cause is unreadable. TC12 is a Nozomi supplement
   test, so that flagship check remains unexercised.

**Latest:** See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for team action items.

## Stage 6 Evaluation

Complete automated pipeline for testing all 20 cases across 3 variants (60 total runs):

```bash
# Start evaluation (loads .env, starts server, runs tests, scores with LLM Judge)
npm run evaluate:stage6:workflow

# Or run specific variant
npm run evaluate:stage6:variant-c    # Full pipeline only
npm run evaluate:stage6:variant-a    # Minimal LLM only
```

**Documentation:**
- [EVALUATION_PIPELINE.md](./EVALUATION_PIPELINE.md) — Full guide (20 test cases, scoring criteria, integration)
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Quick commands & status
- [STAGE_COMPLETION_CHECKLIST.md](./STAGE_COMPLETION_CHECKLIST.md) — Team checklist & blockers

**Output:** `results/` folder with raw proof (60 JSON files) + CSV summary ready for report integration.

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

## End of project speech

## 日本語 (Japanese)
「限界を決めるのは、いつも自分だ」
皆さん、今日という日は二度と戻ってきません。今、目の前にある壁から逃げ出そうとしていませんか？「無理だ」「自分には才能がない」そうやって諦める理由を探すのは、もう終わりにしましょう。
限界を決めているのは、環境でも他人でもありません。あなた自身の心です。
失敗することは恥ずかしいことではありません。本当に恐れるべきなのは、失敗を恐れて一歩も動かないことです。どんなに小さくてもいい。今日、前へ進むための行動を起こしてください。
あなたの未来を変えられるのは、他の誰でもない、今この瞬間を生きているあなただけです。泥臭くてもいい、何度倒れてもいい。立ち上がり、自分の可能性を信じ抜いてください。さあ、一歩踏み出しましょう！
------------------------------
## English Translation
"You Are the One Who Sets Your Limits"
Everyone, today will never come back again. Are you trying to run away from the wall in front of you right now? Stop looking for reasons to give up by saying "It's impossible" or "I don't have the talent."
It is not your environment or other people that decide your limits. It is your own mind.
Failure is nothing to be ashamed of. What you should truly fear is standing completely still out of fear of failing. It doesn't matter how small it is—take action to move forward today.
The only person who can change your future is not anyone else, but you, living in this very moment. It's okay to be messy, and it's okay to fall down many times. Stand back up and believe in your own potential until the very end. Now, take that step forward!
------------------------------
## Romaji (Pronunciation Guide)
"Genkai o kimeru no wa, itsumo jibun da"
Minasan, kyō to iu hi wa nido to modotte kimasen. Ima, me no mae ni aru kabe kara nigedasō to shite imasen ka? "Muri da" "Jibun ni wa sainō ga nai" sō yatte akirameru riyū o sagasu no wa, mō owari ni shimashō.
Genkai o kimete iru no wa, kankyō demo tanin demo arimasen. Anata jishin no kokoro desu.
Shippai suru koto wa hazukashii koto dewa arimasen. Hontō ni osoreru beki na no wa, shippai o osorete ippo mo ugokanai koto desu. Donna ni chiisakute mo ii. Kyō, mae e susumu tame no kōdō o okoshite kudasai.
Anata no mirai o kaerareru no wa, hoka no dare demo nai, ima kono shunkan o ikite iru anata dake desu. Dorokusakute mo ii, nando taarete mo ii. Tachiagari, jibun no kanōsei o shinjinuite kudasai. Sā, ippo fumidashimashō!
------------------------------


