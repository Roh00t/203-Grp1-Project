# 🎤 Presentation Demo Script

## 🎬 Opening (30 seconds)

**What to say:**
> "Welcome to Wayfinder Japan - an evidence-led travel planner that helps travelers make informed decisions about Japan's transit pass system."

**What to show:**
- Load your homepage
- Highlight the hero headline: "A better route through Japan"
- Point to the badge: "Evidence-led planning"

---

## 📝 The Problem (30 seconds)

**What to say:**
> "The JR Pass costs ¥50,000+ for a 7-day ordinary pass. But is it actually worth it for your specific itinerary? Most planners just guess. We calculate the exact cost with real fares from dated sources."

**What to show:**
- Scroll to the input form
- Mention the fields (dates, airports, dietary needs)

---

## 🎯 The Demo - Pick Your Scenario (2 minutes)

**What to say:**
> "For this demo, we've pre-generated 5 different itineraries showing various trip types. Let me show you our multi-city halal-friendly tour."

**What to do:**
1. Click **"Load demo scenario"**
2. **Pause on the overlay** - "Notice we support different durations, dietary needs, and travel styles"
3. Click the **"Classic Multi-City"** card
4. Wait for results to load (instant)

---

## 💰 Module 2: Pass ROI Auditor (1.5 minutes)

**What to say:**
> "Here's the key finding: DO NOT BUY the pass. Individual tickets cost ¥40,750, while the pass plus required supplements totals ¥53,990 - that's ¥13,240 more expensive."

**What to show:**
- Point to the verdict card (top-left, says "DO NOT BUY")
- Highlight the 4 numbers:
  - Pass side: ¥53,990
  - Tickets: ¥40,750
  - Dietary checks: 10/10 verified
  - Geographic checks: 18/18 verified

**Scroll down to fare breakdown:**
> "Notice the Keisei Skyliner and Nankai Rapi:t are marked 'not covered by pass' - these are non-JR services that add ¥3,990 in unavoidable out-of-pocket costs."

---

## 📅 Module 1: Itinerary Generator (1 minute)

**What to say:**
> "Our itinerary module generated a 7-day route across Tokyo, Kyoto, Hiroshima, and Osaka with 26 stops. Every stop includes timing, ward/city location, and whether it's a dining venue."

**What to show:**
- Scroll through Day 1, Day 2, Day 3
- Point to **green "Verified" tags** on dining stops
- Highlight **transition blocks** between stops (shows travel time and mode)

**Example callout:**
> "See this green tag on 'Sankyu Halal Japanese Food Asakusa'? That means our Constraint Validator confirmed this venue is in our curated halal dining table with a dated source."

---

## ✅ Module 3: Constraint Validator (1.5 minutes)

**What to say:**
> "This is where we separate ourselves from other AI planners. Every dietary claim and geographic transition is checked against curated tables - not LLM judgment."

**What to show:**

### Dietary Checks:
- Scroll to the **Audit notes** sidebar (right side)
- Under "Constraint Validator" section:
  - "10 verified · 0 flagged · 0 unknown"
- Expand the dietary results list
> "Every halal restaurant was matched to our curated table compiled from tokyo-muslim-guide-2026 and other dated sources."

### Geographic Checks:
- Point to transition blocks in the itinerary
- Example: "Asakusa → Sumida: 5 min required, 45 min scheduled - compliant"
> "We verify that the scheduled gap between stops is physically realistic based on curated travel times, not guesswork."

---

## 📚 Evidence & Faithfulness (1 minute)

**What to say:**
> "Every factual claim - fares, dietary tags, travel times - carries an evidence field with a source_id and retrieval date. This is our Faithfulness mechanism."

**What to show:**
- Scroll to **"Evidence / Grounding"** section at the bottom
- Read one example:
  - "Tokyo to Kyoto by Hikari costs 13650 yen"
  - Source: smartex-reserved-fares-2025
  - Date: 2026-09-06

**Key point:**
> "In our Stage 6 evaluation, Variant C (with evidence) provided 410 source citations across 20 test cases. Variants A and B provided zero. This is the difference between a fluent guess and a traceable answer."

---

## 🎲 Show Variety - Pick Another Demo (1 minute)

**What to say:**
> "Let me show you a completely different scenario - a strict dietary requirement case."

**What to do:**
1. Scroll to top
2. Click **"Load demo scenario"** again
3. Select **"Strict Dietary: Halal + Vegan Combined"** (TC15)
4. Wait for results

**What to highlight:**
- 6 days, 3 cities
- **Both** halal AND vegan requirements
- All dining stops verified
- Shows the system handles complex constraints

---

## 🏗️ Architecture Overview (1 minute)

**What to say:**
> "Our architecture uses a two-module LLM design plus a deterministic validator:
> - **Module 1** generates the structured itinerary using Chain-of-Thought reasoning
> - **Module 2** is Program-of-Thoughts: the LLM parses the request, but a deterministic function calculates fares
> - **Constraint Validator** checks every claim against curated tables - zero LLM involvement"

**Optional slide/diagram:**
- Show the flow: User Input → Module 1 (LLM) → Module 2 (PoT) → Validator (deterministic) → Output

---

## 📊 Evaluation Results (45 seconds)

**What to say:**
> "We ran 60 test cases - 20 scenarios across 3 prompt variants - with zero errors and zero judge failures. Our key findings:
> - **Financial Accuracy:** 57.1% (missed due to itinerary routing, not calculator errors)
> - **Dietary Adherence:** 95% (high compliance with curated tables)
> - **Geographic Plausibility:** 95% (realistic travel times)
> - **Faithfulness:** 65.6% of claims backed by evidence in Variant C"

**Optional:**
- Show `results/stage6_evaluation_summary.json` on screen briefly

---

## 🎯 Closing (30 seconds)

**What to say:**
> "The key innovation: we don't trust the LLM for arithmetic or factual verification. It excels at itinerary generation and natural language narration, but our deterministic layers ensure every number and constraint check is defensible.
>
> This is deployed at [your domain] and ready for real-world use."

**Final screen:**
- Your domain URL on screen
- GitHub repo link (optional)
- Thank you slide

---

## ⏱️ Total Time: ~10 minutes

### If You Have Less Time:

**5-minute version:**
- Skip the second demo (TC15)
- Reduce evidence walkthrough
- Skip evaluation details

**3-minute version:**
- Show one demo only (TC01)
- Highlight verdict + dietary tags only
- Close with architecture slide

---

## 🎤 Pro Tips

1. **Practice the demo path** - Know exactly which cards to click
2. **Have a backup** - Screenshot the TC01 results in case of wifi issues
3. **Disable browser autofill** - Prevents form fields from jumping around
4. **Use incognito mode** - Ensures clean state, no cached errors
5. **Zoom to 110%** - Makes text readable from the back of the room

---

## 🐛 Emergency Backup Plan

If the website fails to load:

1. Open `frontend/data/demo_tc01.json` in browser
2. Show the raw JSON: "This is the full structured output"
3. Show the rendered HTML prototype locally

---

## 🗣️ Q&A Preparation

**Expected questions:**

### "Why not use RAG for the fare calculator?"
> "Fares are exact numbers - we need structured lookup, not semantic search. Embedding '13650 yen' and retrieving it is less reliable than a CSV lookup."

### "What if a restaurant isn't in your curated table?"
> "It returns 'unverified' status - we never silently pass or fail unknown venues. This is how we maintain the 100%/90% accuracy claims."

### "Why are all verdicts 'DO NOT BUY'?"
> "Our test cases were designed for comprehensive constraint coverage, not pass profitability. In real usage, long-distance Nozomi-heavy itineraries would show 'BUY' verdicts."

### "How do you handle prompt injection?"
> "We use explicit delimiters (`<system_rules>`, `<constraints>`) and a neutralizer that strips these sequences from user input. Any attempt is logged as `injectionAttempted`."

### "What's your API cost?"
> "Gemini 3.8 Flash is ~$0.10 per request. 60 test runs = ~$6 total. Production at scale would need rate limiting and caching."

---

Good luck! 🎉
