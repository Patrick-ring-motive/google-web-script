# Quick Start: Testing Client-Side Tests

## The Problem
Client-side tests in `test/client-tests.html` need a deployed Google Apps Script backend to test against.

## The Solution
Deploy the provided backend handler to Google Apps Script.

## Quick Setup (5 minutes)

### 1. Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"

### 2. Add Files
Copy these files into your Apps Script project:
- **web.js** → Copy entire contents to a new "web" script file
- **test/backend.js** → Copy entire contents to a new "backend" script file

### 3. Deploy
1. Click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone** ⚠️
4. Click **Deploy** and authorize
5. **Copy the web app URL**

### 4. Test
1. Open `test/client-tests.html` in browser
2. Paste your deployment URL
3. Click "Run All Tests"

## What test/backend.js Does

It sets up a `Web.addEventListener('fetch', ...)` handler that provides test endpoints:

```javascript
// Example: Testing JSON responses
fetch('YOUR_URL?path=json')

// Example: Testing POST
fetch('YOUR_URL?path=post', {
  method: 'POST',
  body: JSON.stringify({ test: 'data' })
})

// Example: Testing FormData
const fd = new FormData();
fd.append('field', 'value');
fetch('YOUR_URL?path=formdata', {
  method: 'POST',
  body: fd
})
```

## Available Endpoints

The backend automatically provides:
- `/` - API info
- `/echo` - Echo request back
- `/json` - JSON response
- `/post` - Handle POST requests
- `/formdata` - Parse multipart/form-data
- `/headers` - Return request headers
- `/status/404` - Return specific status codes

## Need More Details?

📖 See [BACKEND_SETUP.md](BACKEND_SETUP.md) for:
- Detailed deployment instructions
- Troubleshooting guide
- Security considerations
- How to update the backend

## Why Is This Needed?

The client tests need a real deployed backend because:
1. They test actual HTTP requests from browser to Google Apps Script
2. They verify CORS handling works correctly
3. They test FormData parsing with `request.formData()`
4. They validate the full request/response cycle
5. Browser can't run Google Apps Script code directly

The backend simulates a real-world Google Apps Script web app that your browser code would interact with.
