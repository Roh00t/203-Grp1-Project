# Stage 5-6-7 Completion Checklist

**Project:** Wayfinder Japan — PE6203 Group Project 1  
**Generated:** 2026-09-07  
**Status:** Stage 5 Complete ✅ | Stage 6 Complete ✅ | Stage 7 Ready to Start 🟡
**Stage 6 executed:** 7 Sept 2026 — 60/60 runs, 0 errors

---

## ✅ STAGE 5: UI & PROTOTYPE (Ulfa)

### Intake Form
- [x] Arrival date picker
- [x] Departure date picker  
- [x] Arrival time input
- [x] Departure time input
- [x] Arrival airport dropdown (loaded from `data/japan_airports.json`)
- [x] Departure airport dropdown
- [x] Dietary requirement select (Halal, Vegan, None)
- [x] Trip pace select (Relaxed, Moderate, Fast-paced)
- [x] Preferences textarea (optional)

### Result Display
- [x] Verdict card (BUY / DO NOT BUY)
- [x] Fare comparison (pass vs. tickets)
- [x] Day-by-day itinerary with stops
- [x] Constraint validation results (Verified/Flagged/Unverified badges)
- [x] Pass ROI audit narrative
- [x] Evidence/grounding citations
- [x] Loading spinner during API call
- [x] Error message display on failure
- [x] Responsive layout (mobile breakpoints)

### Integration Points
- [x] `/api/generate` endpoint connection
- [x] Airport list JSON loading
- [x] Demo mode (hardcoded sample)
- [x] Live mode (Gemini API)
- [x] Schema validation (itinerary JSON parsing)

### Status: **READY FOR STAGE 6**
No blockers. UI is fully functional. Quick smoke test completed ✓

---

## ✅ STAGE 6: EVALUATION (Mutya & Ulfa)

### Test Case Infrastructure
- [x] 20 test cases defined in `data/stage6_test_cases.json`
- [x] Test categories: normal, missing_information, ambiguous, misleading_instruction, input_safety
- [x] STAGE6_EVALUATION_GUIDE.md reviewed and understood

### Evaluation Runner Script
- [x] `scripts/evaluate-stage6.mjs` created (Node.js)
  - Loads test cases from JSON
  - Implements Variant A (minimal LLM)
  - Implements Variant B (simplified prompt)
  - Implements Variant C (full pipeline)
  - Calls LLM Judge on all outputs
  - Saves raw outputs to `results/variant_X/`
  - Generates CSV summary
  - Generates consolidated JSON summary

- [x] `scripts/run-stage6-workflow.sh` created
  - Loads .env
  - Starts server
  - Runs evaluator
  - Stops server
  - Outputs ready-to-review results

### NPM Scripts
- [x] `npm run evaluate:stage6:workflow` — Full automation
- [x] `npm run evaluate:stage6:variant-a` — Variant A only
- [x] `npm run evaluate:stage6:variant-b` — Variant B only
- [x] `npm run evaluate:stage6:variant-c` — Variant C only
- [x] `npm run evaluate:stage6:single` — Single case (args)

### Scoring Infrastructure
- [x] LLM Judge prompt from LLM_JUDGE_RUBRIC.md
- [x] Criteria: Financial, Dietary, Geography, Faithfulness, Input Safety
- [x] JSON output format defined
- [x] CSV export for Excel integration

### Output Structure
```
results/
├── variant_a/
│   ├── TC01.json
│   ├── TC02.json
│   └── ... (20 files)
├── variant_b/
│   ├── TC01.json
│   └── ... (20 files)
├── variant_c/
│   ├── TC01.json
│   └── ... (20 files)
├── stage6_evaluation_matrix.csv
└── stage6_evaluation_summary.json
```

### Documentation
- [x] EVALUATION_PIPELINE.md — Complete user guide
- [x] Quick-start commands
- [x] Troubleshooting section
- [x] Integration with report explained

### Prerequisites for Execution
- [x] `.env` file contains `GEMINI_API_KEY`
- [x] `GEMINI_MODEL_ID` confirmed live (`gemini-3.8-flash`)
- [x] Node.js ≥20 available
- [x] Internet connection for Gemini API calls

### Execution
- [x] `npm run evaluate:stage6:workflow` run to completion
- [x] Outputs collected in `results/`
- [x] CSV summary reviewed for pass/fail distribution
- [x] Results ready to hand to Karthik for Stage 7

### Status: **COMPLETE ✅**

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

---

## 🟡 STAGE 7: FAILURE ANALYSIS (Karthik)

### Logging Infrastructure
- [x] `calculator.js`: Throws specific errors (MissingFareError, AmbiguousFareError, MissingSupplementDataError)
- [x] `validator.js`: `collectFailureLog()` function captures every validation result
- [x] `server.mjs`: Logs injection attempts, narration mismatches
- [x] Guardrails.md documents failure categories

### Failure Categories Defined
- Unsupported authority (missing source)
- Delimiter injection (blocked)
- Hallucination (unsupported claims)
- Temporal infeasibility (impossible transitions)
- Dietary mismatches (wrong venue)
- Fare calculation errors
- Schema validation failures

### Analysis Template
Defined in Guardrails.md. Ready for Karthik to populate with Stage 6 data.

### Status: **READY TO START 🟡**
Stage 6 results are available in `results/`. No remaining blockers.

**Scope decision:** analysis only, no retests — API credits are reserved for the demo.
Karthik fills in `proposed fix` fully and hands back a prioritised retest queue; the
`retest result` column reads `NOT RETESTED — see retest queue`.

**Next Steps (Day 1 of Stage 7):**
1. Review Stage 6 results in CSV
2. Extract FAIL cases
3. Categorize root causes
4. Map failures to architecture decisions
5. Document recommendations for production version

---

## ❌ REPORT + SLIDES (Leo, Kyle, Harry)

### Status: **NOT STARTED**
`slides_notes.md` contains lecture notes, not project slides.

### What's Needed (Due Sept 18)
- [ ] Title page (names, emails, contributions)
- [ ] Executive summary (1–2 pages)
- [ ] Architecture overview (design rationale)
- [ ] Methodology section
- [ ] Stage 6 evaluation results (60 test case summary)
- [ ] Stage 7 failure analysis
- [ ] Lessons learned / production recommendations
- [ ] Appendix: raw evaluation outputs

### Deliverables
- [ ] Report PDF (~10 pages + cover)
- [ ] Presentation slides (6–8 slides, ~2min per slide for 10-min presentation)
- [x] Working deployment link (tested externally) — https://hellobird.io/PE6203/index.html, verified 10 Sept 2026; demo mode functional, live generation requires the local server

### Recommended Timeline
- **Today (Sept 7):** Draft architecture + methodology sections
- **Sept 8-9:** Wait for Stage 6 results, add evaluation summary
- **Sept 9-10:** Add Stage 7 failure analysis, refine report
- **Sept 10 (Presentation):** Finalize slides, rehearse
- **Sept 18 (Report Due):** Polish and submit

---

## 🔄 INTEGRATION POINTS

### Stage 5 → Stage 6
- UI fully renders Module 1 & Module 2 outputs ✅
- `/api/generate` endpoint properly wired ✅
- Demo mode works for manual testing ✅
- Live mode ready for Variant C execution ✅

### Stage 6 → Stage 7
- Raw outputs preserved in `results/variant_*/` for audit trail ✅
- CSV summary provides easy filtering for failures ✅
- JSON summary includes full metadata ✅
- LLM Judge scores aligned with rubric criteria ✅

### Stage 6 → Report
- CSV exportable to Excel
- JSON easily parsed into report figures
- Variant A/B/C comparison built into summary
- Evidence citations traceable to sources

---

## 📋 TEAM ACTION ITEMS

### Ulfa (Stage 5 Owner)
- [x] Created airport JSON ✅
- [ ] Verify airport dropdown loads without console errors (5 min)
- [x] Stage 5 complete

### Mutya (Stage 6 Owner)
- [x] Reviewed 20 test cases ✅
- [ ] Execute: `npm run evaluate:stage6:workflow` (2–4 hours)
- [ ] Review `results/stage6_evaluation_matrix.csv` for pass/fail breakdown
- [ ] Notify Karthik and report team when results ready

### Karthik (Stage 7 Owner)
- [x] Reviewed failure logging infrastructure ✅
- [ ] Wait for Stage 6 results
- [ ] Outline failure analysis structure (can do now)
- [ ] Execute: Categorize failures, document root causes

### Leo, Kyle, Harry (Report & Slides)
- [ ] Draft architecture section today (copy from Architecture.md)
- [ ] Draft methodology section
- [ ] Placeholder for Stage 6 results (fill in Sept 8–9)
- [ ] Placeholder for Stage 7 analysis (fill in Sept 9)
- [ ] Build presentation from report structure

### Rohit (Project Lead)
- [x] Confirmed current status ✅
- [x] Verified airport schema integration ✅
- [x] Built evaluation pipeline ✅
- [ ] Monitor execution and provide support

---

## ✅ VERIFICATION CHECKLIST

Before running Stage 6, verify:

```bash
# 1. Test cases exist
test -f data/stage6_test_cases.json && echo "✓ Test cases JSON exists" || echo "✗ MISSING"

# 2. Evaluation script exists
test -f scripts/evaluate-stage6.mjs && echo "✓ Evaluator script exists" || echo "✗ MISSING"

# 3. Workflow script exists
test -f scripts/run-stage6-workflow.sh && echo "✓ Workflow script exists" || echo "✗ MISSING"

# 4. NPM scripts registered
grep -q "evaluate:stage6" package.json && echo "✓ NPM scripts configured" || echo "✗ MISSING"

# 5. Documentation complete
test -f EVALUATION_PIPELINE.md && echo "✓ Pipeline documentation exists" || echo "✗ MISSING"

# 6. .env present (user responsibility)
test -f .env && echo "✓ .env file exists" || echo "✗ MISSING"

# 7. GEMINI_API_KEY set
grep -q "GEMINI_API_KEY" .env && echo "✓ API key configured" || echo "✗ MISSING"

# 8. All tests pass
npm test 2>&1 | grep -q "test suites passed" && echo "✓ All unit tests pass" || echo "⚠ Check test output"
```

---

## 🎯 SUCCESS CRITERIA

### Stage 5 ✅
- [x] UI loads without console errors
- [x] All form fields functional
- [x] Results display correctly with validation badges
- [x] Responsive layout works

### Stage 6 ⏳
- [ ] All 60 runs execute successfully (Mutya)
- [ ] CSV summary generates
- [ ] JSON proof saved for audit
- [ ] Scoring completed with LLM Judge

### Stage 7 ⏳
- [ ] Failures categorized
- [ ] Root causes documented
- [ ] Recommendations proposed

### Report ⏳
- [ ] 10 pages + cover submitted by Sept 18
- [ ] Slides ready for Sept 10 presentation
- [x] Deployment link working externally — https://hellobird.io/PE6203/index.html (HTTP 200, verified 10 Sept 2026)

---

## 📞 SUPPORT

**Questions about Stage 6 execution?**
See: EVALUATION_PIPELINE.md

**Questions about architecture?**
See: Architecture.md, CLAUDE.md

**Questions about locked decisions?**
See: CLAUDE.md "Hard rule from the assignment brief"

**Blocking issues?**
Contact: Rohit Panda

---

**Last Updated:** 2026-09-07 09:43 UTC  
**Next Review:** After Stage 6 execution (Mutya)
