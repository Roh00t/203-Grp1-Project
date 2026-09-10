# Wayfinder Japan - Frontend Deployment Guide

This folder contains a production-ready frontend for deploying the Wayfinder Japan travel planner to Hostinger or any PHP-enabled web host.

## 📁 Folder Structure

```
frontend/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styling
├── js/
│   └── app.js          # Frontend JavaScript
├── data/
│   ├── japan_airports.json    # Airport data
│   └── demo_response.json     # Pre-generated demo response
├── api/
│   └── generate.php    # Backend proxy (protects API key)
└── README.md           # This file
```

## 🚀 Deployment Options

### Option 1: Static Demo (Recommended for Limited API Credits)

**Best for:** Presentations, demos, or when you have limited Gemini API credits.

This mode serves a pre-generated demo response without calling the live API.

1. **Upload to Hostinger:**
   - Upload all files in the `frontend/` folder to your domain's `public_html/` directory
   - Ensure PHP is enabled on your hosting plan

2. **Configure the PHP proxy:**
   - Open `api/generate.php`
   - Ensure `$USE_STATIC_DEMO = true;` (this is the default)
   - No API key needed!

3. **Test:**
   - Visit your domain: `https://yourdomain.com/`
   - Click "Generate & verify plan" or "Preview with sample"
   - Both buttons will show the same pre-generated demo (Tokyo → Kyoto → Hiroshima → Osaka)

**Limitations:**
- Only one fixed itinerary (the demo)
- Cannot generate custom itineraries
- Perfect for showcasing the UI and verification features

---

### Option 2: Live Mode with Backend Server

**Best for:** Full functionality with custom itineraries.

This requires a running Node.js backend server (locally or on a VPS).

#### A. If you have a VPS or cloud server:

1. **Deploy the Node.js backend:**
   ```bash
   # On your VPS
   cd /path/to/203-Grp1-Project
   npm install
   node server.mjs
   ```

2. **Configure the PHP proxy:**
   - Open `api/generate.php`
   - Set `$USE_STATIC_DEMO = false;`
   - Set `$BACKEND_URL = 'https://your-vps-domain.com:3000/api/generate';`

3. **Upload frontend to Hostinger:**
   - Upload the `frontend/` folder contents to `public_html/`

#### B. If you want to run the backend locally (for testing):

1. **Start the Node.js server on your local machine:**
   ```bash
   cd /path/to/203-Grp1-Project
   node server.mjs
   ```

2. **Use ngrok or similar tunnel service:**
   ```bash
   ngrok http 3000
   # Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
   ```

3. **Configure the PHP proxy:**
   - Open `api/generate.php`
   - Set `$USE_STATIC_DEMO = false;`
   - Set `$BACKEND_URL = 'https://abc123.ngrok.io/api/generate';`

4. **Upload frontend to Hostinger**

**Note:** The Gemini API key stays in the Node.js `.env` file and is never exposed to the frontend.

---

## 🔒 Security Features

### API Key Protection

The frontend **never** contains your Gemini API key. Two layers of protection:

1. **PHP Proxy (`api/generate.php`):**
   - Acts as a middleware between frontend and backend
   - Prevents direct exposure of backend URLs
   - Implements rate limiting (10 requests/hour by default)
   - Validates all requests before forwarding

2. **Node.js Backend (`server.mjs`):**
   - Holds the actual Gemini API key in `.env`
   - Never deployed to the frontend hosting
   - Can run on a separate, more secure server

### Rate Limiting

The PHP proxy includes simple file-based rate limiting:
- **Default:** 10 requests per hour per IP address
- **Customize:** Edit `$maxRequestsPerHour` in `api/generate.php`
- **For production:** Consider using Redis or a database for more robust rate limiting

---

## 📝 Hostinger Deployment Steps

### 1. Access File Manager
- Log in to Hostinger hPanel
- Navigate to **Files** → **File Manager**

### 2. Upload Files
- Navigate to `public_html/` (or your domain's root folder)
- Upload all contents from the `frontend/` folder:
  ```
  public_html/
  ├── index.html
  ├── css/
  ├── js/
  ├── data/
  ├── api/
  └── README.md (optional)
  ```

### 3. Set Permissions
- Ensure `api/generate.php` has execute permissions (755)
- Check that `/tmp/` is writable (needed for rate limiting)

### 4. Test PHP Support
Create a test file `test.php`:
```php
<?php
phpinfo();
?>
```
- Visit `https://yourdomain.com/test.php`
- Confirm PHP is running (version 7.4+ recommended)
- Delete the test file after confirmation

### 5. Configure the Proxy
- Edit `api/generate.php` using Hostinger's File Manager editor
- Choose demo mode or live mode (see options above)

### 6. Test the Application
- Visit `https://yourdomain.com/`
- Try both buttons:
  - **"Generate & verify plan"** - In demo mode, shows the pre-generated itinerary
  - **"Preview with sample"** - Same as above in demo mode

---

## 🛠️ How to Switch from Demo to Live Mode

When you're ready to enable live AI generation:

1. **Set up a backend server** (see Option 2 above)
2. **Edit `frontend/api/generate.php`:**
   ```php
   // Change this:
   $USE_STATIC_DEMO = true;

   // To this:
   $USE_STATIC_DEMO = false;
   $BACKEND_URL = 'https://your-backend-server.com:3000/api/generate';
   ```
3. **Re-upload `api/generate.php`** to Hostinger

---

## ⚠️ Demo Mode Limitations

When `$USE_STATIC_DEMO = true`:
- ✅ Shows the full UI and all verification features
- ✅ Demonstrates Pass ROI Auditor, Constraint Validator, and Evidence Grounding
- ✅ Works without any backend server or API key
- ❌ Cannot generate custom itineraries
- ❌ User input (dates, airports, preferences) is ignored
- ❌ Always shows the same Tokyo → Kyoto → Hiroshima → Osaka itinerary

**Best for:**
- Class presentations
- Showcasing the UI design
- Testing without using API credits
- Demonstrations when you don't have internet/VPS access

---

## 🧪 Testing Checklist

Before your presentation:

- [ ] Upload all files to Hostinger
- [ ] Verify PHP is enabled
- [ ] Test the homepage loads: `https://yourdomain.com/`
- [ ] Click "Generate & verify plan" - should show results within 2 seconds (demo mode)
- [ ] Check that all sections render:
  - [ ] Pass ROI verdict card
  - [ ] Financial breakdown
  - [ ] Day-by-day itinerary
  - [ ] Dietary verification tags
  - [ ] Geographic plausibility checks
  - [ ] Evidence/source citations
- [ ] Test on mobile - responsive design should work
- [ ] Clear browser cache and test again

---

## 🔧 Troubleshooting

### "The local planner could not complete this request"
- **Demo mode:** Check that `frontend/data/demo_response.json` exists
- **Live mode:** Verify `$BACKEND_URL` is correct and the backend is running

### Rate Limit Errors
- Default limit is 10 requests/hour per IP
- Edit `$maxRequestsPerHour` in `api/generate.php` to increase
- Delete `/tmp/wayfinder_rate_limit.json` to reset counters

### PHP Errors
- Enable PHP error reporting temporarily:
  ```php
  error_reporting(E_ALL);
  ini_set('display_errors', 1);
  ```
- Check Hostinger's error logs in hPanel

### Airport Dropdown Not Loading
- Verify `data/japan_airports.json` was uploaded
- Check browser console for fetch errors
- Ensure the file path is correct relative to `index.html`

---

## 📊 What the Demo Shows

The pre-generated demo itinerary:
- **Trip:** 7 days (Oct 1-7, 2026)
- **Route:** Tokyo (Asakusa, Shibuya) → Kyoto (Gion) → Hiroshima → Osaka (Dotonbori)
- **Dietary:** Halal (10 dining stops, all verified)
- **Pass Verdict:** DO NOT BUY (¥13,240 more expensive than individual tickets)
- **Financial:** ¥40,750 (tickets) vs ¥53,990 (pass + supplements)
- **Constraints:** 28/28 checks passed (10 dietary, 18 geographic)

This demonstrates all three modules:
1. ✅ **Itinerary Generator** - Structured day-by-day plan
2. ✅ **Pass ROI Auditor** - Real fare calculator with evidence
3. ✅ **Constraint Validator** - Dietary and geographic checks

---

## 💡 Tips for Presentation

1. **Pre-test everything** the night before
2. **Have a backup:** Screenshot the demo results in case of connectivity issues
3. **Explain the demo limitation** upfront if using static mode
4. **Highlight the evidence citations** - this is your Faithfulness feature
5. **Show the verified vs. flagged tags** - demonstrate the Constraint Validator
6. **Walk through the fare breakdown** - explain how the calculator works

---

## 📞 Support

- **GitHub Issues:** Report problems in the repository
- **Documentation:** See `docs/Architecture.md` for the full system design
- **API Quota:** Monitor your Gemini API usage in Google Cloud Console

---

## License

PE6203 Group Project 1 - Educational Use Only
