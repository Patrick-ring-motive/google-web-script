# Backend Deployment Guide

## Setting Up the Google Apps Script Backend

The client-side tests in `client-tests.html` need a deployed Google Apps Script web app to test against. Follow these steps:

### 1. Create Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Name it "Google Web Script Test Backend" or similar

### 2. Add Files

1. **web.js**
   - Click the "+" next to Files
   - Choose "Script"
   - Name it "web"
   - Copy the entire contents of `web.js` into this file

2. **backend.js**
   - Click the "+" next to Files
   - Choose "Script"
   - Name it "backend"
   - Copy the entire contents of `test/backend.js` into this file

### 3. Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure the deployment:
   - **Description**: "Test Backend for Google Web Script"
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
   
   > **Important**: Choose "Anyone" so the client tests can access it without authentication

5. Click **Deploy**
6. You may need to authorize the app:
   - Click "Authorize access"
   - Choose your Google account
   - Click "Advanced" → "Go to [Project Name] (unsafe)" if needed
   - Click "Allow"

7. **Copy the Web App URL** - it will look like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

### 4. Configure Client Tests

1. Open `test/client-tests.html` in a browser
2. Paste your Web App URL into the "API Endpoint" field
3. Click "Run All Tests"

### 5. Test the Backend

Before running client tests, verify the backend works:

1. In the Apps Script editor, select the `testBackend` function from the dropdown
2. Click the Run button ▶️
3. Check the logs (View → Logs) to see if it works

Or test directly in your browser:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

You should see a JSON response with API information.

## Available Test Endpoints

The backend provides these endpoints (use `?path=endpoint` parameter):

- **/** - API information and available endpoints
- **/echo** - Echoes back all request details
- **/json** - Returns a simple JSON response
- **/post** - Handles POST requests with JSON body
- **/formdata** - Handles multipart/form-data submissions
- **/headers** - Returns all request headers
- **/status/{code}** - Returns specified HTTP status code

### Example Requests

```javascript
// Basic GET request
fetch('YOUR_WEB_APP_URL')

// Echo endpoint
fetch('YOUR_WEB_APP_URL?path=echo')

// POST with JSON
fetch('YOUR_WEB_APP_URL?path=post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' })
})

// FormData
const formData = new FormData();
formData.append('name', 'John');
formData.append('file', fileBlob, 'document.txt');
fetch('YOUR_WEB_APP_URL?path=formdata', {
  method: 'POST',
  body: formData
})
```

## Troubleshooting

### CORS Errors
The backend includes CORS headers by default. If you still see CORS errors:
- Make sure "Who has access" is set to "Anyone"
- Try deploying a new version

### 404 Not Found
- Verify the deployment URL is correct
- Make sure you're using the `/exec` URL, not the `/dev` URL
- Try creating a new deployment

### Authorization Errors
- Set "Execute as" to "Me"
- Set "Who has access" to "Anyone"
- Re-authorize the app if needed

### Empty Responses
- Check the Apps Script logs: View → Logs or Execution log
- Verify web.js is loaded before backend.js
- Make sure `Web.addEventListener` is being called

## Updating the Backend

When you make changes:

1. Click **Deploy** → **Manage deployments**
2. Click the pencil icon ✏️ next to your deployment
3. Change "Version" to "New version"
4. Add a description of changes
5. Click **Deploy**

The Web App URL stays the same, but uses the new code.

## Development vs Production

For testing:
- Use the web app URL with `/exec` (production)

For debugging:
- Click "Test deployments" to get a `/dev` URL
- This runs the latest code without creating a new deployment
- Note: `/dev` URLs may have different permissions

## Security Notes

⚠️ **Important**: This backend is designed for testing only!

- "Anyone" access means no authentication
- All request data is echoed back in some endpoints
- Don't use this setup for production applications
- Don't store sensitive data in test requests

For production apps:
- Set "Who has access" to "Only myself" or specific users
- Implement proper authentication
- Validate all inputs
- Add rate limiting
