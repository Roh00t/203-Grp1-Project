## Comprehensive Project Status Assessment

### **Stage 5: UI & Prototype (Ulfa) — ~95% COMPLETE ✅**

The HTML UI prototype at `japan_travel_planner_prototype.html` is fully functional:

**What's implemented:**
- ✅ Complete intake form with all fields: dates, times, airports (Narita/Kansai dropdowns), dietary (Halal/Vegan), pace, preferences
- ✅ Styled results display: verdict card (BUY/DO NOT BUY), fare breakdown, constraint validation results, evidence citations
- ✅ Frontend JavaScript logic connects to `/api/generate` endpoint and renders:
  - Day-by-day itinerary with stops, times, dining flags
  - Constraint validation results (dietary & geographic checks with status badges: "Verified"/"Flagged"/"Unverified")
  - Pass ROI audit verdict with pass price vs. ticket total comparison
  - Evidence/grounding for every claim
- ✅ Demo mode (hardcoded itinerary for preview) and live mode (calls Gemini API)
- ✅ Error handling and validation (date order check, required fields)
- ✅ Responsive design (mobile breakpoints included)

**What remains:** UI is feature-complete. Only potential items:
- UX polish/minor design refinements (non-blocking for Stage 6)
- Airport list may need to be served from data/japan_airports.json — the code fetches it but I didn't verify the file exists

---

### **Stage 6: Test Cases & A/B/C Evaluation — COMPLETE ✅**

**Executed 7 Sept 2026** on `gemini-3.8-flash`. **60/60 runs (20 cases x 3 variants), 0 errors,
0 judge parse failures, 0 judge call failures.**

**Artefacts:**
- `results/stage6_evaluation_matrix.csv` — score + scoring lens per criterion per run
- `results/stage6_evaluation_summary.json` — full results, scores, reasons, metadata
- `results/variant_{a,b,c}/TC01-TC20.json` — raw per-run output (Variant C includes
  `validation`, `failures`, `audit`)

**Variant C against the Stage 1 targets:**

| Criterion | Target | Actual | Met? |
|---|---|---|---|
| Financial accuracy | >=90% | 57.1% (8/14 scored) | No |
| Dietary adherence | 100% | 95.0% (19/20) | No |
| Geographic plausibility | >=90% | 95.0% (19/20) | **Yes** |
| Faithfulness | >=90% | 15.8% of cases (65.6% of claims) | No |

**Headline A/B/C result — Faithfulness:** Variants A and B make 525 and 641 factual claims
respectively with **zero** evidence pointers (0.0%); Variant C backs 410 of 625 (65.6%).
This is the measured form of the "ChatGPT can suggest a trip, it can't show you which
claims are backed by a source" argument.

**Scoring note for the report:** Variant C's Financial/Dietary/Geographic scores come from
`calculator.js` and `validator.js` (deterministic), while A and B emit prose and can only
be scored by the LLM judge. The `Method` column in the CSV records which lens produced each
cell. This is a property of the variants, not an inconsistent yardstick — state it explicitly.

---

### **Stage 7: Failure Analysis — READY TO START 🟡 (Karthik)**

**Unblocked.** Stage 6 results are available in `results/`.

**Scope decision:** analysis only, no retests — Gemini credits are reserved for the demo.
Karthik completes input -> expected -> actual -> likely cause -> proposed fix in full, and
hands back a prioritised retest queue. The `retest result` column reads
`NOT RETESTED - see retest queue`. Document this as a deliberate scoping decision.

**Four findings already identified from the run:**

1. **All 6 financial FAILs are ground-truth errors, not calculator errors.** Every one is
   "DO NOT BUY but expected BUY", and the arithmetic is not close (TC04: tickets 17,640 yen
   vs pass 53,990 yen). Mutya's six `BUY` expectations need revisiting.
2. **TC15's dietary FAIL is a harness bug.** `"Halal AND Vegan"` is wrapped as a single
   constraint that no venue tag can match (`server.mjs:259`). All 9 dining stops "violate".
   Fixing that one line takes dietary to 20/20 = 100%.
3. **TC16's geographic FAIL is genuine.** Module 1 scheduled back-to-back stops with a
   0-minute gap where the table requires 10 minutes of walking. Best real Stage 7 case.
4. **TC05/TC08/TC10/TC12 produced no audit**, logging `calculatorError: [object Object]` —
   the error object is not serialised so the cause is unreadable. TC12 is a Nozomi
   supplement test, so that flagship check is still unexercised.

**Known coverage gap (Guardrails.md §7):** only 1 of 4 required adversarial categories is
implemented. Missing: system-prompt extraction, payment/card processing, and the
visa/legal in-scope + out-of-scope pair. Flag to Mutya; record as a documented limitation.

**Infrastructure already in place:**
- `calculator.js`: typed errors (`MissingFareError`, `AmbiguousFareError`, `MissingSupplementDataError`)
- `validator.js`: `collectFailureLog()` emits Stage 7-shaped records (check, status, day,
  subject, lookup_key, expected, actual, source_id, source_date, cause)
- `server.mjs`: logs `injectionAttempted`, `removed`, `module2Error`

---

### **Report + Slides — NOT STARTED ❌**

**Current state:**
- `slides_notes.md` exists but contains **lecture notes from PE6203 course materials** (Generative AI fundamentals, MoE architecture, etc.) — **not project deliverables**
- No project report drafted
- No presentation slides prepared
- **Deadline pressure:** Presentation 10 Sept (3 days), Report due 18 Sept (11 days)

**What's needed (per README):**
- Report: ~10 pages + cover page (names, emails, per-member contributions)
- Slides: Presentation on Sept 10
- Must include deployment link that works externally (not just local)

**Current team assignments:**
- Leo, Kyle, Harry: Report + slides (status unknown)

---

## Timeline & Blockers

| Stage | Owner | Status | Blocker | Action |
|-------|-------|--------|---------|--------|
| **Stage 5** | Ulfa | 95% ✅ | None | Final smoke test (optional), ready for Stage 6 |
| **Stage 6** | Mutya/Ulfa | Complete ✅ | None | Executed 7 Sept: 60/60 runs, 0 errors. Results in `results/` |
| **Stage 7** | Karthik | Ready to start 🟡 | None | Analyse failures; analysis only, no retests |
| **Report** | Leo/Kyle/Harry | Not started ❌ | Test results (for examples) | Start immediately (11 days left) — can begin while Stage 6 runs |
| **Slides** | Leo/Kyle/Harry | Not started ❌ | Report draft | Draft report first, build slides from it |

---

## Recommendations

1. **For Ulfa (Stage 5):** Quick verification that data/japan_airports.json exists and loads correctly in the UI. Otherwise, Stage 5 is complete.

2. **For Mutya (Stage 6):** Can start running test cases immediately. The framework and 20 test cases are frozen and ready. Suggests:
   - Run Variant A & B (Gemini chats) in parallel to save time
   - Run Variant C through the live UI as each case completes
   - Score all 60 outputs with the LLM Judge rubric

3. **For Karthik (Stage 7):** Results are ready in `results/`. Start from `stage6_evaluation_matrix.csv`, then read `o.failures` inside `results/variant_c/TCxx.json`. Four findings are already catalogued in the Stage 7 section above. Analysis only — no retests.

4. **For Leo/Kyle/Harry (Report + Slides):** Start now. Don't wait for Stage 6. You can:
   - Draft the system architecture section (copy from `Architecture.md`)
   - Write methodology and design rationale
   - Placeholder test results / conclusions
   - Build slides from the draft report structure
   - Fill in actual test results when Stage 6 finishes

5. **Deployment link:** Confirm `server.mjs` is ready for deployment. The `.env` pattern (GEMINI_API_KEY, GEMINI_MODEL_ID) is set up, and the app runs on `localhost:3000` via `npm start`. Verify the live model ID is current (CLAUDE.md warns Gemini 1.5 Pro/Flash are already retired).