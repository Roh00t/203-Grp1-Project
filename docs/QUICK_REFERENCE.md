# Quick Reference — Stage 5/6/7 Status & Commands

**Generated:** 2026-09-07 | **Presentation:** Sept 10 | **Report Due:** Sept 18

---

## 🟢 STAGE 5 (Ulfa) — COMPLETE ✅

**What:** UI prototype fully functional  
**Proof:** `japan_travel_planner_prototype.html` + live `/api/generate` endpoint  
**Action:** None remaining

---

## ✅ STAGE 6 (Mutya) — COMPLETE

Executed 7 Sept 2026: 60/60 runs, 0 errors, model `gemini-3.8-flash`.
Results in `results/`. Variant C met the Geographic Plausibility target (95%);
Financial, Dietary and Faithfulness missed with documented causes — see
`STAGE_COMPLETION_CHECKLIST.md` for the full table.

Commands below are retained for re-runs.

### (reference) Quick Start

### Quick Start
```bash
# Load .env, start server, run all 60 tests, collect scores
npm run evaluate:stage6:workflow
```

**Output:** `results/` folder with CSV summary + 60 raw JSON files

### Variants Tested
- **A:** Minimal LLM (plain language, no system data)
- **B:** Simplified prompt (generic itinerary instructions)
- **C:** Full pipeline (calculator, validator, RAG)

### Timeline
- 20 test cases × 3 variants = **60 total runs**
- Est. 2–4 hours with LLM Judge scoring
- Results ready for: Stage 7 analysis + Report writing

### Key Metrics (Target)
- Financial Accuracy (Variant C): ≥90%
- Dietary Adherence (Variant C): 100%
- Geographic Plausibility (Variant C): ≥90%
- Faithfulness (All Variants): ≥90%

### Files
- Test cases: `data/stage6_test_cases.json`
- Runner: `scripts/evaluate-stage6.mjs`
- Docs: `EVALUATION_PIPELINE.md`

---

## 🟡 STAGE 7 (Karthik) — READY TO START

**What:** Categorise failures, document root causes  
**Blocker:** None — Stage 6 results are in `results/`  
**Scope:** Analysis only, no retests (credits reserved for the demo). Fill in
`proposed fix` fully; hand back a prioritised retest queue.  
**Start here:** `results/stage6_evaluation_matrix.csv`, then `o.failures` inside
`results/variant_c/TCxx.json` (produced by `collectFailureLog()` in `validator.js`).  
**Prep:** Review `Guardrails.md` §3 and §7 for failure categories and the coverage gap.

### Next Steps
1. Wait for Mutya's Stage 6 results (~Sept 8–9)
2. Review CSV failures
3. Map to Architecture.md design decisions
4. Document recommendations

---

## 📄 REPORT + SLIDES (Leo, Kyle, Harry) — NOT STARTED ❌

**Deadline:** Sept 10 (slides) + Sept 18 (report)

### Immediate Actions
1. **Today:** Draft architecture + methodology sections (copy from Architecture.md)
2. **Tomorrow:** Await Stage 6 results
3. **Sept 9:** Add evaluation summary + Stage 7 analysis
4. **Sept 10:** Finalize slides, rehearse
5. **Sept 18:** Submit report (10 pages + cover)

### Files to Create
- `report_draft.md` or `.docx` (sections: overview, arch, methodology, results, analysis)
- `slides.pptx` or Google Slides (6–8 slides, 2 min/slide for 10-min slot)

---

## 📋 ALL COMMANDS

### Run Evaluation (Stage 6)
```bash
npm run evaluate:stage6:workflow     # Full automation (recommended)
npm run evaluate:stage6:variant-c    # Variant C only (fastest for dev)
npm run evaluate:stage6:variant-a    # Variant A only
npm run evaluate:stage6:variant-b    # Variant B only
node scripts/evaluate-stage6.mjs TC01 # Single test case
```

### Verify Setup
```bash
npm test                             # Run all unit tests
npm run test:live                    # Test Variant C with sample data
curl http://localhost:3000/api/health # Check server health
```

### Start Server (Manual)
```bash
npm start                            # Default (port 3000) — required for live generation
# Deployed (demo mode only): https://hellobird.io/PE6203/index.html
PORT=4000 npm start                  # Custom port
```

---

## 📂 KEY FILES

### Architecture & Design
- `Architecture.md` — Full system design (locked)
- `CLAUDE.md` — Rules for AI tools (locked)
- `Guardrails.md` — Failure handling (production checklist)

### Stage 6 Infrastructure
- `data/stage6_test_cases.json` — 20 test cases
- `scripts/evaluate-stage6.mjs` — Test runner
- `scripts/run-stage6-workflow.sh` — Automation wrapper
- `EVALUATION_PIPELINE.md` — Complete guide
- `STAGE_COMPLETION_CHECKLIST.md` — This checklist

### Curated Data (Ulfa owns)
- `data/fare_table.json` — Real fares + supplements
- `data/dietary_table.json` — Halal/Vegan venues
- `data/travel_time_table.json` — Transit feasibility
- `rag_corpus/` — 17 JSON source documents (retrieval path) + 6 markdown research notes

### Code (Rohit owns)
- `prompts/module1_itinerary.js` — LLM prompt
- `prompts/module2_auditor.js` — Narration prompt
- `calculator.js` — Deterministic fare calculation
- `validator.js` — Constraint checking
- `server.mjs` — API endpoint

### UI (Chan owns)
- `japan_travel_planner_prototype.html` — Frontend
- `data/japan_airports.json` — Airport list

---

## ⚠️ PREREQUISITES FOR STAGE 6

Before running `npm run evaluate:stage6:workflow`, ensure:

```bash
# 1. .env file exists with API key
cat .env | grep GEMINI_API_KEY

# 2. Model ID is live (check https://ai.google.dev/gemini-api/docs/deprecations)
cat .env | grep GEMINI_MODEL_ID
# Should be: gemini-3.8-flash (or newer if available)

# 3. Node.js ≥20
node --version

# 4. Dependencies installed
npm list | head
```

---

## 📊 EXPECTED STAGE 6 OUTPUT

After running evaluation, you'll have:

```
results/
├── variant_a/
│   ├── TC01.json          ← Gemini minimal LLM output
│   ├── TC02.json
│   └── ... (20 files)
├── variant_b/
│   ├── TC01.json          ← Gemini simplified prompt output
│   └── ... (20 files)
├── variant_c/
│   ├── TC01.json          ← Full pipeline server output
│   └── ... (20 files)
├── stage6_evaluation_matrix.csv      ← Excel-ready summary
└── stage6_evaluation_summary.json    ← Detailed scores + metadata
```

**CSV preview:**
```
Test Case,Variant,Status,Financial,Dietary,Geography,Faithfulness,Input Safety
TC01,A,SUCCESS,N/A,N/A,N/A,PASS,N/A
TC01,B,SUCCESS,N/A,N/A,N/A,FAIL,N/A
TC01,C,SUCCESS,PASS,PASS,PASS,PASS,PASS
```

---

## 🎯 SUCCESS CRITERIA (Grading)

| Criterion | Target | Variant | Owner | Status |
|-----------|--------|---------|-------|--------|
| Architectural soundness | Design justified | All | Rohit | ✅ |
| Financial Accuracy | ≥90% | C | Ulfa | ⏳ |
| Dietary Adherence | 100% | C | Ulfa | ⏳ |
| Geographic Plausibility | ≥90% | C | Ulfa | ⏳ |
| Faithfulness | ≥90% | All | Mutya | ⏳ |
| Failure Analysis | Root causes categorized | Report | Karthik | ⏳ |
| Report Quality | 10 pages + cover | Report | Leo/Kyle/Harry | ⏳ |
| Presentation | 6–8 slides, 10 min | Slides | Leo/Kyle/Harry | ⏳ |

---

## 🚀 NEXT STEPS (TODAY)

**Ulfa:**
```bash
# Live build (interface + demo mode only):  https://hellobird.io/PE6203/index.html
# Live generation needs the local server:
npm start
# Open http://localhost:3000 in browser
# Check console for errors (should be none)
```

**Mutya:**
```bash
# Prepare Stage 6 execution
npm run evaluate:stage6:workflow
# Review results/stage6_evaluation_matrix.csv
```

**Karthik:**
- Review `Guardrails.md` failure categories
- Sketch outline for Stage 7 report

**Leo/Kyle/Harry:**
- Draft report structure
- Create presentation template
- Plan content sections

---

## ❓ FAQ

**Q: Can I run Stage 6 without a server?**  
A: Variant A & B don't need a server. Variant C does. Use workflow script to manage both.

**Q: How long does Stage 6 take?**  
A: ~2–4 hours depending on Gemini API latency. Run overnight if preferred.

**Q: Can I run tests in parallel?**  
A: Yes. Split by variant: run A & B in parallel, then C separately (requires server).

**Q: What if a test fails?**  
A: Error logged to `results/TC##.json` with message. Continue to next test. See Troubleshooting in EVALUATION_PIPELINE.md.

**Q: Do I need to modify test cases?**  
A: No. Test cases are frozen per STAGE6_EVALUATION_GUIDE.md. Report any issues to Rohit.

**Q: Where do I put report results?**  
A: Filter `results/stage6_evaluation_matrix.csv` for failures. Include summary in report with CSV as appendix.

---

**Last Updated:** 2026-09-07  
**Status:** Stage 6 complete ✅ — Stage 7 ready to start  
**Questions?** See EVALUATION_PIPELINE.md or contact Rohit
