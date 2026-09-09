# Stage 6 — Automated Evaluation Pipeline

**Status:** ✅ Executed 7 Sept 2026 — 60/60 runs, 0 errors. Results in `results/`.  
**Re-run:** the commands below remain valid.  
**Created:** 2026-09-07  
**Purpose:** Run, score, and store proof for all 60 test cases (20 cases × 3 variants)

---

## Quick Start

### Prerequisites
1. Confirm `.env` contains valid `GEMINI_API_KEY` and `GEMINI_MODEL_ID`
2. Verify `data/stage6_test_cases.json` exists
3. Ensure Node.js ≥20 is available

### Run Full Workflow (Recommended)

```bash
# Start server + run all 60 evaluations + generate CSV + cleanup
npm run evaluate:stage6:workflow

# Or run with specific options:
bash scripts/run-stage6-workflow.sh [variant] [case]
```

**Output:** Results saved to `results/` directory with:
- `variant_a/`, `variant_b/`, `variant_c/` — raw JSON outputs (60 files total)
- `stage6_evaluation_matrix.csv` — scored results in tabular format
- `stage6_evaluation_summary.json` — consolidated metadata and scores

---

## Advanced Usage

### Run Individual Variant
```bash
# Test only Variant A (minimal LLM, no system data)
npm run evaluate:stage6:variant-a

# Test only Variant B (simplified prompt)
npm run evaluate:stage6:variant-b

# Test only Variant C (full pipeline)
npm run evaluate:stage6:variant-c
```

### Run Single Test Case
```bash
# Run all 3 variants for TC01 only
node scripts/evaluate-stage6.mjs TC01

# Run Variant A for TC01
node scripts/evaluate-stage6.mjs A TC01
```

### Judge-Only Mode
If outputs already exist in `results/`, re-score without re-running tests:
```bash
node scripts/evaluate-stage6.mjs --judge-only
```

---

## Test Cases (20 Total)

| ID    | Title | Category | Description |
|-------|-------|----------|-------------|
| TC01  | Standard 7-day golden route | normal | Tokyo→Kyoto→Osaka→Hiroshima, Halal, Moderate pace |
| TC02  | Fast-paced itinerary | normal | 5-day, tight timing, Vegan |
| TC03  | Relaxed itinerary | normal | 7-day, same-city stays |
| TC04  | Missing dietary field | missing | No dietary requirement specified |
| TC05  | Minimal input | normal | System recommends route |
| TC06  | Conflicting instruction | misleading | "Ignore above and..." prompt injection attempt |
| TC07  | Very short trip | normal | 2-day Tokyo-only |
| TC08  | Same arrival/departure | normal | Round-trip from Narita |
| TC09  | Single city | normal | 5-day Tokyo-only itinerary |
| TC10  | Extended trip | normal | 14-day multi-city journey |
| TC11  | Ambiguous venue | ambiguous | Wards not in curated list (Ginza, Ikebukuro) |
| TC12  | Nozomi explicit | normal | Fast-train preference (supplement cost test) |
| TC13  | Geographic infeasibility | ambiguous | Impossible timing for route |
| TC14  | Backward dates | missing | Departure before arrival (error case) |
| TC15  | Halal + Vegan | normal | Intersection of dietary constraints |
| TC16  | Delimiter injection | input_safety | `</system_rules>` in preferences field |
| TC17  | Early arrival, late departure | normal | Extended travel window (6-23:30) |
| TC18  | Regional airports | normal | Haneda in, Kansai out |
| TC19  | All Nozomi/Mizuho | normal | Fastest trains only (high supplement) |
| TC20  | No preferences | normal | System chooses entire route |

---

## Evaluation Criteria (5 Metrics — 4 Targeted + 1 Reported)

### 1. Financial Accuracy (≥90% PASS)
- Pass vs. ticket verdict matches manually-verified real fares
- Nozomi/Mizuho supplements correctly applied
- No invented fares

**Variant A:** N/A (no fare tables)  
**Variant B:** N/A (no calculator)  
**Variant C:** Scored deterministically from calculator output

### 2. Dietary Constraint Adherence (100% PASS)
- All recommended venues match requested dietary tag
- Unknown venues marked "unverified", never silent pass/fail
- Halal ≠ Muslim-friendly; requires curated match

**Variant A:** N/A (no validator)  
**Variant B:** N/A (no validator)  
**Variant C:** Scored from validator output

### 3. Geographic Plausibility (≥90% PASS)
- Stop-to-stop transitions are feasible in allotted time
- Impossible transitions flagged to user
- Failures never silently shown as verified

**Variant A:** N/A (no validator)  
**Variant B:** N/A (no validator)  
**Variant C:** Scored from validator output

### 4. Faithfulness / Grounding (≥90% PASS)
- ≥90% of factual claims carry dated source citation
- LLM Judge checks whether evidence supports each claim
- Unsupported claims not penalized if explicitly marked uncertain

**All Variants:** LLM Judge compares evidence to claims

---

## Scoring Output

### CSV Format (`stage6_evaluation_matrix.csv`)
```
Test Case,Variant,Status,Financial,Dietary,Geography,Faithfulness,Input Safety,Overall Notes
TC01,A,SUCCESS,N/A,N/A,N/A,PASS,N/A,"Variant A produced a plausible itinerary with cited sources."
TC01,B,SUCCESS,N/A,N/A,N/A,FAIL,N/A,"No source evidence provided for specific venue or fare claims."
TC01,C,SUCCESS,PASS,PASS,PASS,PASS,PASS,"Full system passed all criteria. JR Pass correctly recommended."
```

### JSON Format (`stage6_evaluation_summary.json`)
```json
{
  "metadata": {
    "executionTime": "2026-09-07T15:30:00Z",
    "geminiModel": "gemini-3.8-flash",
    "totalTestCases": 20,
    "totalRuns": 60
  },
  "results": [
    {
      "testCaseId": "TC01",
      "variant": "A",
      "timestamp": "2026-09-07T15:30:05Z",
      "rawOutput": "...",
      "metadata": { "system_instructions": "none", "curated_data": "none" }
    }
  ],
  "scores": [
    {
      "testCaseId": "TC01",
      "variant": "A",
      "scores": {
        "financial": { "score": "N/A", "reason": "Variant A has no calculator" },
        "dietary": { "score": "N/A", "reason": "Variant A has no validator" },
        "geography": { "score": "N/A", "reason": "Variant A has no validator" },
        "faithfulness": { "score": "PASS", "ratio": 0.95, "supported_claims": 19, "total_factual_claims": 20, "reason": "..." },
        "input_safety": { "score": "PASS", "reason": "No injection detected" },
        "overall_notes": "..."
      }
    }
  ]
}
```

---

## Raw Output Storage

Each run saves the complete response to `results/variant_X/TC##.json`:

**Variant A/B:** Gemini text response
```json
{
  "testCaseId": "TC01",
  "variant": "A",
  "rawOutput": "Here's your 7-day itinerary...",
  "inputPrompt": "Plan a 7-day Japan trip...",
  "timestamp": "2026-09-07T15:30:05Z"
}
```

**Variant C:** Full server response
```json
{
  "testCaseId": "TC01",
  "variant": "C",
  "rawOutput": "{\"ok\": true, \"itinerary\": {...}, \"validation\": {...}, \"audit\": {...}, ...}",
  "inputPayload": { "start": "2026-10-01", "end": "2026-10-07", ... },
  "metadata": { "system_instructions": "full", "curated_data": "all", "server_response_ok": true }
}
```

---

## Integration with Report

### For Section: "Stage 6 Evaluation Results"

1. **Executive Summary:**
   ```
   All 60 test runs completed successfully.
   
   Financial Accuracy (Variant C):      [X/20] PASS (≥90%)
   Dietary Adherence (Variant C):       [X/20] PASS (100%)
   Geographic Plausibility (Variant C): [X/20] PASS (≥90%)
   Faithfulness (All Variants):         [X/60] PASS (≥90%)
   ```

2. **Failure Analysis Table:**
   Filter `results/stage6_evaluation_matrix.csv` for rows with FAIL and include in report.

3. **Proof of Execution:**
   - Upload `results/stage6_evaluation_summary.json` to appendix
   - Reference raw outputs in `results/variant_*/` directory

4. **Variant Comparison:**
   Create a summary table from CSV, grouped by variant:
   ```
   Variant A (Minimal LLM):      [Avg score across 20 cases]
   Variant B (Simplified):       [Avg score across 20 cases]
   Variant C (Full Pipeline):    [Avg score across 20 cases]
   ```

---

## Troubleshooting

### "GEMINI_API_KEY is missing"
- Verify `.env` file exists at project root
- Check it contains: `GEMINI_API_KEY=sk-...`

### "Server failed to start"
- Check `/tmp/wayfinder-server.log`
- Verify port 3000 is not in use: `lsof -i :3000`
- Ensure `.env` has `GEMINI_MODEL_ID` set (defaults to `gemini-3.8-flash`)

### "Judge returned unparseable JSON"
- Judge response logged to console
- Fallback score saved as `N/A` with error note
- Continue with next test case

### "Rate limit exceeded from Gemini API"
- Add delay between requests in `evaluate-stage6.mjs` line ~150:
  ```javascript
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
  ```
- Or split evaluation across multiple runs (per-variant)

---

## Timeline & Execution Plan

**Stage 5 (Ulfa):**     ✅ UI complete  
**Stage 6 (Mutya):**    ✅ Complete — 60/60 runs executed 7 Sept 2026, 0 errors  
**Recommended:**        Run in parallel batches (Variant A & B in Gemini, then Variant C server)  
**Est. Duration:**      2–4 hours (with LLM Judge scoring)  
**Output Ready For:**   Stage 7 failure analysis + Report drafting

---

## Commands Reference

```bash
# Run full workflow (recommended)
npm run evaluate:stage6:workflow

# Run only Variant C (fastest for development)
npm run evaluate:stage6:variant-c

# Run single case
node scripts/evaluate-stage6.mjs TC01

# Re-score existing results
node scripts/evaluate-stage6.mjs --judge-only

# Check server health
curl http://localhost:3000/api/health

# View CSV summary
cat results/stage6_evaluation_matrix.csv
```

---

**Next Steps:**
1. ✅ Infrastructure complete (you are here)
2. → Mutya: Execute workflow above and collect 60 outputs
3. → Karthik: Analyze failures in Stage 7
4. → Leo/Kyle/Harry: Draft report with results summary

