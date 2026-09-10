# Upload Checklist for hellobird.io/PE6203

## 📁 Your Site Structure

Your website is at: `https://hellobird.io/PE6203/index.html`

This means all files should be uploaded to the **PE6203** folder on your server.

## ✅ Files to Upload

Upload these files to `public_html/PE6203/` (or wherever PE6203 is located):

### Core Files (Required)
- [ ] `index.html` (main page)
- [ ] `css/styles.css` (all styling)
- [ ] `js/app.js` (updated with error handling)

### Data Files (Required for Demos)
- [ ] `data/demo_catalog.json` (menu of 5 scenarios)
- [ ] `data/demo_tc01.json` (Classic Multi-City)
- [ ] `data/demo_tc02.json` (Vegan Speed Tour)
- [ ] `data/demo_tc07.json` (Tokyo Weekend)
- [ ] `data/demo_tc15.json` (Strict Dietary)
- [ ] `data/demo_tc18.json` (Grand Tour)
- [ ] `data/japan_airports.json` (airport dropdown data)

### Optional Files
- [ ] `api/generate.php` (not needed for demos, but keep for future)
- [ ] `.htaccess` (for optimization, optional)
- [ ] Documentation files (for your reference only)

---

## 🚀 Step-by-Step Upload Guide

### Option 1: File Manager (Easiest)

1. **Login to your hosting panel**
   - Go to your hosting provider's control panel
   - Find "File Manager" or "Files"

2. **Navigate to PE6203 folder**
   - Open `public_html/` or `www/`
   - Find the `PE6203/` folder
   - If it doesn't exist, create it

3. **Upload files maintaining structure:**
   ```
   PE6203/
   ├── index.html
   ├── css/
   │   └── styles.css
   ├── js/
   │   └── app.js
   └── data/
       ├── demo_catalog.json
       ├── demo_tc01.json
       ├── demo_tc02.json
       ├── demo_tc07.json
       ├── demo_tc15.json
       ├── demo_tc18.json
       └── japan_airports.json
   ```

4. **Upload folders:**
   - Upload the `css/` folder (will create `PE6203/css/`)
   - Upload the `js/` folder (will create `PE6203/js/`)
   - Upload the `data/` folder (will create `PE6203/data/`)

### Option 2: FTP (For Advanced Users)

```bash
# Connect via FTP client (FileZilla, WinSCP, etc.)
# Navigate to public_html/PE6203/
# Upload all files maintaining folder structure
```

---

## 🧪 Testing Checklist

After uploading, test these in order:

### 1. Check Files Are Accessible
- [ ] Visit: `https://hellobird.io/PE6203/index.html` ✅ Should show the page
- [ ] Open browser console (F12) → Network tab
- [ ] Refresh the page
- [ ] Check for 404 errors:
  - `css/styles.css` should be 200 OK
  - `js/app.js` should be 200 OK
  - `data/japan_airports.json` should be 200 OK
  - `data/demo_catalog.json` should be 200 OK

### 2. Check Airport Dropdown
- [ ] Page loads without errors
- [ ] Airport dropdowns show "Select an airport"
- [ ] Click arrival airport → Should show list of airports
- [ ] Default values: NRT (arrival), KIX (departure)

**If dropdowns don't work:**
- Check console for: "Failed to load airports"
- Verify `data/japan_airports.json` uploaded correctly
- Check file path is `PE6203/data/japan_airports.json`

### 3. Check Demo Selector
- [ ] Click "Load demo scenario" button
- [ ] Overlay appears with 5 demo cards
- [ ] Cards show:
  - Badges (Most Popular, Fast-Paced, etc.)
  - Trip names
  - Stats (days, cities, dietary, verdict)

**If overlay is empty:**
- Check console for: "Demo catalog load failed"
- Verify `data/demo_catalog.json` uploaded correctly
- Check it's valid JSON (no syntax errors)

### 4. Test Demo Loading
- [ ] Click "Classic Multi-City" card
- [ ] Overlay closes
- [ ] Loading message appears briefly
- [ ] Results appear showing:
  - Verdict card (DO NOT BUY)
  - 4 number boxes
  - Day-by-day itinerary
  - Dietary tags (green "Verified")
  - Evidence citations at bottom

**If results don't load:**
- Check console for: "Demo scenario could not be loaded"
- Verify `data/demo_tc01.json` exists
- Check file is valid JSON

### 5. Test All 5 Demos
- [ ] TC01 - Classic Multi-City ✅
- [ ] TC02 - Vegan Speed Tour ✅
- [ ] TC07 - Tokyo Weekend ✅
- [ ] TC15 - Strict Dietary ✅
- [ ] TC18 - Grand Tour ✅

### 6. Mobile Test
- [ ] Open on phone: `https://hellobird.io/PE6203/index.html`
- [ ] Layout is responsive
- [ ] Demo selector works on mobile
- [ ] Demo cards stack vertically

---

## 🐛 Common Issues & Fixes

### Issue 1: "Unexpected token '<'" Error

**Cause:** Fetching JSON files returns HTML (404 page) instead of JSON

**Fix:**
1. Check that `data/` folder exists in `PE6203/`
2. Verify all JSON files uploaded successfully
3. Check file names are **exactly** correct:
   - `demo_tc01.json` (not `demo_TC01.json` or `Demo_tc01.json`)
   - Case-sensitive on some servers!

**Test:**
- Visit directly: `https://hellobird.io/PE6203/data/demo_catalog.json`
- Should show JSON, not a 404 error page

---

### Issue 2: Airport Dropdown Shows "Loading..."

**Cause:** `japan_airports.json` not loaded

**Fix:**
1. Check `data/japan_airports.json` uploaded
2. Visit: `https://hellobird.io/PE6203/data/japan_airports.json`
3. Should show JSON array starting with `[{"iata":"CTS",...`

---

### Issue 3: Demo Overlay is Empty

**Cause:** `demo_catalog.json` failed to load

**Fix:**
1. Open browser console (F12)
2. Look for error message
3. Visit: `https://hellobird.io/PE6203/data/demo_catalog.json`
4. Verify it's valid JSON (5 demo objects)

---

### Issue 4: CSS Not Loading (Page Looks Broken)

**Cause:** CSS file path incorrect

**Fix:**
1. Check `css/styles.css` uploaded to `PE6203/css/`
2. Visit: `https://hellobird.io/PE6203/css/styles.css`
3. Should show CSS code, not 404

---

### Issue 5: JavaScript Not Running

**Cause:** JS file not loaded or syntax error

**Fix:**
1. Check `js/app.js` uploaded to `PE6203/js/`
2. Open browser console for errors
3. Visit: `https://hellobird.io/PE6203/js/app.js`
4. Should show JavaScript code

---

## 🔍 Debugging Checklist

If something doesn't work:

1. **Open Browser Console (F12)**
   - Look for red error messages
   - Note which file failed to load

2. **Check Network Tab**
   - Refresh page
   - Look for files with status 404 (not found)
   - Click on failed requests to see details

3. **Verify File Paths**
   ```
   ✅ CORRECT:
   https://hellobird.io/PE6203/index.html
   https://hellobird.io/PE6203/css/styles.css
   https://hellobird.io/PE6203/data/demo_catalog.json

   ❌ WRONG:
   https://hellobird.io/index.html (missing PE6203/)
   https://hellobird.io/PE6203/demo_catalog.json (missing data/)
   ```

4. **Test JSON Files Directly**
   - Visit each JSON URL in browser
   - Should see JSON, not HTML error page
   - Copy-paste into JSONLint to validate

5. **Check Console Logs**
   - Updated `app.js` now logs:
     - `"✓ Loaded X demo scenarios"`
     - `"✓ Loaded demo: tc01"`
   - If you see these, files loaded successfully!

---

## 📝 Quick Verification Script

Open browser console on your page and run:

```javascript
// Check if files loaded
fetch('./data/demo_catalog.json')
  .then(r => r.ok ? '✓ Catalog found' : '✗ Catalog 404')
  .then(console.log);

fetch('./data/demo_tc01.json')
  .then(r => r.ok ? '✓ TC01 found' : '✗ TC01 404')
  .then(console.log);

fetch('./data/japan_airports.json')
  .then(r => r.ok ? '✓ Airports found' : '✗ Airports 404')
  .then(console.log);
```

All should show ✓ (checkmark).

---

## ✅ Final Pre-Presentation Check

**24 hours before presentation:**

- [ ] Visit `https://hellobird.io/PE6203/index.html`
- [ ] Click "Load demo scenario"
- [ ] Test all 5 demos load correctly
- [ ] Take screenshots as backup
- [ ] Test on mobile device
- [ ] Test on different browser (Chrome, Firefox, Safari)
- [ ] Share link with teammate to verify

**If everything works → You're ready! 🎉**

**If something fails → Check the debugging section above**

---

## 📞 Need Help?

1. Check browser console for specific error message
2. Verify file uploaded to correct folder (`PE6203/data/` not just `data/`)
3. Test JSON files directly in browser
4. Check this document's debugging section
5. Ask your team member to test from their device

---

Good luck! 🚀
