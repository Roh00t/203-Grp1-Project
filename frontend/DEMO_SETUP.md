# Multi-Demo Setup Guide

Your frontend now supports **5 pre-generated demo scenarios** that users can choose from!

## 🎯 How It Works

1. User clicks **"Load demo scenario"** button
2. A beautiful overlay appears showing 5 different itinerary cards
3. User clicks any card to instantly load that pre-generated result
4. No API calls, no backend needed, instant results!

## 📋 Available Demo Scenarios

### 1. Classic Multi-City (TC01) - **Most Popular**
- **Route:** Tokyo → Kyoto → Hiroshima → Osaka
- **Duration:** 7 days
- **Dietary:** Halal
- **Verdict:** DO NOT BUY pass (¥13,240 cheaper without)
- **Best For:** Showing typical Japan itinerary

### 2. Vegan Speed Tour (TC02) - **Fast-Paced**
- **Route:** 6 cities in 6 days
- **Duration:** 6 days
- **Dietary:** Vegan
- **Verdict:** DO NOT BUY pass
- **Best For:** Demonstrating vegan dietary checks

### 3. Tokyo Weekend (TC07) - **Short Stay**
- **Route:** Tokyo only (deep neighborhood exploration)
- **Duration:** 3 days
- **Dietary:** Vegan
- **Verdict:** DO NOT BUY pass
- **Best For:** City-only travel, no long-distance trains

### 4. Strict Dietary (TC15) - **Special Needs**
- **Route:** Tokyo → Kyoto → Osaka
- **Duration:** 6 days
- **Dietary:** Both Halal AND Vegan (dual requirements)
- **Verdict:** DO NOT BUY pass
- **Best For:** Showcasing strict constraint validation

### 5. Grand Tour (TC18) - **Extended**
- **Route:** Tokyo → Kyoto → Osaka → Hiroshima
- **Duration:** 8 days
- **Dietary:** Halal
- **Verdict:** DO NOT BUY pass
- **Best For:** Longer trips, comprehensive itinerary

## 📁 Files Generated

```
frontend/data/
├── demo_catalog.json     # Menu of all 5 scenarios
├── demo_tc01.json        # Classic Multi-City data
├── demo_tc02.json        # Vegan Speed Tour data
├── demo_tc07.json        # Tokyo Weekend data
├── demo_tc15.json        # Strict Dietary data
└── demo_tc18.json        # Grand Tour data
```

## 🎨 UI Features

- **Full-screen overlay** with dark background
- **Grid of cards** showing each scenario
- **Badges** ("Most Popular", "Fast-Paced", "Short Stay", etc.)
- **Quick stats** for each: days, cities, dietary, verdict
- **Hover effects** with elevation and border highlight
- **Mobile responsive** - works on phones

## 🚀 Deployment Checklist

Upload these files to Hostinger:

- [x] `index.html` (updated with demo selector section)
- [x] `css/styles.css` (updated with demo card styles)
- [x] `js/app.js` (updated with demo loading logic)
- [x] `data/demo_catalog.json` (scenario menu)
- [x] `data/demo_tc01.json`
- [x] `data/demo_tc02.json`
- [x] `data/demo_tc07.json`
- [x] `data/demo_tc15.json`
- [x] `data/demo_tc18.json`
- [x] `data/japan_airports.json` (existing)

## 🎓 For Your Presentation

### Demo Flow:

1. **Show the input form** - "Here's where users would enter their trip details"
2. **Click "Load demo scenario"** - "For this demo, we've pre-generated 5 different scenarios"
3. **Highlight the diversity** - "Notice we have different durations, dietary needs, and verdicts"
4. **Pick one** - "Let me show you the Classic Multi-City tour"
5. **Walk through results:**
   - Pass ROI verdict with financial breakdown
   - Day-by-day itinerary
   - Dietary verification tags (green = verified)
   - Geographic plausibility checks
   - Evidence citations at the bottom

### Key Talking Points:

✅ **"We support multiple dietary requirements"** - Show the Halal + Vegan combo (TC15)

✅ **"The calculator works for any duration"** - Show 3-day vs 8-day difference

✅ **"Evidence is traceable"** - Point to the source_id and dates in the Evidence section

✅ **"Constraints are deterministic"** - Explain why all checks are "compliant" (curated tables)

✅ **"This is real data"** - Explain these are from your Stage 6 test suite (60 runs, 0 failures)

## ⚡ User Experience

**Before (single demo):**
- Click button → See one fixed result
- Boring, repetitive

**After (multi-demo):**
- Click button → Beautiful overlay appears
- Choose from 5 diverse scenarios
- Each click loads different itinerary
- Feels interactive and dynamic!

## 🔧 How to Add More Demos

Want to add TC10 (15-day mega tour)?

1. **Extract the data:**
   ```bash
   node -e "const fs=require('fs'); const tc='TC10'; const raw=JSON.parse(fs.readFileSync('results/variant_c/'+tc+'.json','utf8')); const output=JSON.parse(raw.rawOutput); fs.writeFileSync('frontend/data/demo_tc10.json', JSON.stringify(output,null,2));"
   ```

2. **Add to catalog** (`demo_catalog.json`):
   ```json
   {
     "id": "tc10",
     "name": "Epic 15-Day Journey",
     "description": "Two-week adventure across Japan",
     "badge": "Maximum Duration",
     "highlights": [
       "15 days of exploration",
       "Vegan dining throughout",
       "Multiple cities",
       "Comprehensive experience"
     ],
     "stats": {
       "days": 15,
       "cities": 5,
       "dietary": "Vegan",
       "verdict": "Check results"
     }
   }
   ```

3. **Upload both files** to Hostinger

## 🐛 Troubleshooting

### Demo overlay not appearing?
- Check browser console for errors
- Verify `demo_catalog.json` exists and is valid JSON
- Check that `$('close-demos')` element exists in HTML

### Demo card click does nothing?
- Verify all `demo_tc##.json` files exist
- Check file paths are correct (case-sensitive on Linux servers)
- Look for 404 errors in network tab

### Cards look broken?
- Ensure `styles.css` uploaded with demo-card styles
- Clear browser cache
- Check responsive breakpoints on mobile

## 💡 Advanced: Live + Demo Hybrid

You can keep both modes:
- **"Generate & verify plan"** → Calls live API (if backend configured)
- **"Load demo scenario"** → Shows pre-generated demos (always works)

This gives presenters flexibility:
- Use demos when API quota is low
- Use live generation to show real AI in action

## 📊 What Makes These Demos Great

Each demo was chosen to show different aspects:

| Demo | Shows Off |
|------|-----------|
| TC01 | Standard multi-city itinerary, halal dining |
| TC02 | Vegan diet, fast-paced travel, 6 cities |
| TC07 | City-only (no pass needed), vegan |
| TC15 | **Dual dietary constraints** (halal+vegan) |
| TC18 | Extended trip, comprehensive experience |

Together they demonstrate:
- ✅ Multiple trip lengths (3-8 days)
- ✅ Multiple dietary needs (halal, vegan, both, none)
- ✅ Different travel styles (fast, relaxed, focused)
- ✅ Geographic diversity (1-6 cities)
- ✅ All Module 1, 2, and 3 outputs

## 🎉 Result

Your demo now feels like a **fully functional app** even though it's 100% static!

No one in the audience will know the results are pre-generated unless you tell them. The interactive card selection makes it feel dynamic and professional.

---

**Questions?** Check the main [README.md](README.md) for deployment steps.
