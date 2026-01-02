# Google Web Script - Testing Guide

This directory contains comprehensive tests for the Google Web Script library.

## Test Files

### 1. `server-tests.js` - Server-Side Tests
Tests that run entirely within Google Apps Script environment.

**How to use:**
1. Copy `server-tests.js` content into your Google Apps Script project
2. Make sure `web.js` is also in your project
3. In the Apps Script editor, select `runAllTests` function
4. Click Run
5. Check the Logs (View > Logs) for test results

**Functions available:**
- `runAllTests()` - Runs all tests including network requests (slower)
- `runQuickTests()` - Runs tests without network requests (faster)

**What it tests:**
- ✅ Web.Blob creation and methods
- ✅ Web.Headers case-insensitive operations
- ✅ Web.Response creation and parsing
- ✅ Web.Request creation and cloning
- ✅ Web.FormData form data construction and serialization
- ✅ Web.fetch() HTTP operations
- ✅ Web.RequestEvent from doGet/doPost events
- ✅ Web.ResponseEvent content type detection
- ✅ Web.addEventListener() setup
- ✅ Web.do() request handling

### 2. `client-tests.html` - Client-Side Integration Tests
HTML page that tests the deployed web app from the browser.

**How to use:**
1. Deploy your Google Apps Script as a web app:
   - In Apps Script editor: Deploy > New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Copy the deployment URL

2. Set up a simple fetch handler in your Apps Script:
   ```javascript
   Web.addEventListener('fetch', (request) => {
     return new Web.Response(JSON.stringify({
       method: request.method,
       url: request.url,
       headers: Object.fromEntries(request.headers.entries()),
       body: request.text()
     }), {
       status: 200,
       headers: { 'Content-Type': 'application/json' }
     });
   });
   ```

3. Open `client-tests.html` in a browser
4. Paste your deployment URL
5. Click "Run All Tests"

**What it tests:**
- ✅ Basic GET requests
- ✅ POST requests with JSON
- ✅ Custom headers
- ✅ Query parameters
- ✅ Form data
- ✅ Large payloads
- ✅ Content-Type detection
- ✅ Browser API compatibility

## Test Results

Both test files include their own simple test frameworks with:
- ✅ Pass/Fail status
- ❌ Error messages
- 📊 Test summaries
- 🎨 Colored output (in HTML version)

## No Dependencies

Both test files are **completely self-contained** with no external dependencies. They include:
- Custom assertion functions
- Test runner logic
- Result formatting
- Everything needed to run tests

## Quick Start

**For rapid testing during development:**

1. **Server-side (in Apps Script):**
   ```javascript
   runQuickTests(); // Fast, no network calls
   ```

2. **Client-side:**
   - Click "Run Quick Tests" button
   - Only runs browser API tests, no server requests

**For comprehensive testing:**

1. **Server-side:**
   ```javascript
   runAllTests(); // Includes HTTP requests to httpbin.org
   ```

2. **Client-side:**
   - Click "Run All Tests" button
   - Tests full integration with your deployed web app

## Example Output

### Server Tests (in Logger):
```
Starting Google Web Script Tests...

Running Blob tests...
✓ Web.Blob - Create empty blob
✓ Web.Blob - Create blob from string
✓ Web.Blob - Create blob with type

...

==================================================
Test Results: 48/50 passed, 2 failed
==================================================
```

### Client Tests (in Browser):
```
Test Results
─────────────
12 Passed
0  Failed
12 Total
```

## Troubleshooting

**Server tests fail with "Web is not defined":**
- Make sure `web.js` is loaded before `server-tests.js`
- Check that the IIFE in `web.js` has executed

**Client tests can't connect:**
- Verify your deployment URL is correct
- Check that the web app is deployed with "Anyone" access
- Make sure you have a fetch listener configured
- Try accessing the URL directly in a browser first

**Tests timeout:**
- Increase `config.timeout` in `client-tests.html`
- Check your network connection
- Verify the Google Apps Script service is responding

## Writing New Tests

### Server-side test:
```javascript
TestRunner.test('My new test', () => {
  const result = someFunction();
  TestRunner.assertEqual(result, expectedValue, 'Should match');
});
```

### Client-side test:
```javascript
runner.addTest('My new test', async () => {
  const response = await fetch(url);
  assert(response.ok, 'Should succeed');
}, 'integration'); // or 'browser' for local tests
```
