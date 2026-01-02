/**
 * Backend Handler for Google Apps Script Web App
 * 
 * This file should be deployed as a Google Apps Script web app to handle
 * client-side test requests. It uses Web.addEventListener to handle all
 * incoming fetch requests.
 * 
 * Deployment Instructions:
 * 1. Create a new Google Apps Script project
 * 2. Copy both web.js and this file (backend.js) into the project
 * 3. Deploy as web app with:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the web app URL to client-tests.html configuration
 */

// Set up the fetch event listener
Web.addEventListener('fetch', (request) => {
  try {
    const url = request.url || '';
    const method = request.method || 'GET';
    const path = request.parameter?.path || request.parameters?.path?.[0] || '/';
    
    // Echo endpoint - returns request details
    if (path === '/echo' || path === 'echo') {
      const requestData = {
        method: method,
        url: url,
        headers: Object.fromEntries([...request.headers.entries()]),
        parameters: request.parameters || {},
        body: null
      };
      
      // Try to parse body if present
      try {
        const bodyText = request.text();
        if (bodyText) {
          requestData.body = bodyText;
          // Try parsing as JSON
          try {
            requestData.bodyJson = JSON.parse(bodyText);
          } catch (_) {
            // Not JSON, that's fine
          }
        }
      } catch (_) {
        // No body or can't read it
      }
      
      return new Web.Response(JSON.stringify(requestData, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // JSON endpoint - returns JSON response
    if (path === '/json' || path === 'json') {
      return new Web.Response(JSON.stringify({ 
        message: 'Hello from Google Apps Script',
        timestamp: new Date().toISOString(),
        success: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // POST endpoint - handles POST requests
    if (path === '/post' || path === 'post') {
      let receivedData = null;
      
      try {
        const bodyText = request.text();
        if (bodyText) {
          receivedData = JSON.parse(bodyText);
        }
      } catch (e) {
        return new Web.Response(JSON.stringify({ 
          error: 'Invalid JSON in request body',
          message: e.toString()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Web.Response(JSON.stringify({ 
        message: 'POST received',
        received: receivedData,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // FormData endpoint - handles multipart/form-data
    if (path === '/formdata' || path === 'formdata') {
      try {
        const formData = request.formData();
        const result = {};
        
        // Extract all form fields
        for (const [name, value] of formData.entries()) {
          if (value && value.getBytes) {
            // It's a file/blob
            result[name] = {
              type: 'file',
              contentType: value.type,
              size: value.size,
              content: value.text() // For small files, include content
            };
          } else {
            // It's a string
            result[name] = value;
          }
        }
        
        return new Web.Response(JSON.stringify({ 
          message: 'FormData received',
          fields: result,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Web.Response(JSON.stringify({ 
          error: 'Failed to parse FormData',
          message: e.toString()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Status code endpoint - returns specified status code
    if (path.startsWith('/status/') || path.startsWith('status/')) {
      const statusCode = parseInt(path.split('/').pop());
      if (statusCode >= 200 && statusCode < 600) {
        return new Web.Response(JSON.stringify({ 
          status: statusCode,
          message: 'Status code test'
        }), {
          status: statusCode,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Headers endpoint - returns request headers
    if (path === '/headers' || path === 'headers') {
      const headers = {};
      for (const [key, value] of request.headers.entries()) {
        headers[key] = value;
      }
      
      return new Web.Response(JSON.stringify({ 
        headers: headers,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default response - API info
    return new Web.Response(JSON.stringify({
      message: 'Google Web Script Test API',
      version: '1.0.0',
      endpoints: {
        '/echo': 'Echo back request details',
        '/json': 'Returns JSON response',
        '/post': 'Handles POST requests with JSON body',
        '/formdata': 'Handles multipart/form-data',
        '/status/{code}': 'Returns specified status code',
        '/headers': 'Returns request headers'
      },
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
    
  } catch (error) {
    // Error handler
    return new Web.Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.toString(),
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

/**
 * doGet function - required by Google Apps Script for web apps
 * Automatically configured by Web.addEventListener('fetch', ...)
 * 
 * This will be automatically created, but we can define it explicitly
 * to make it clear in the script editor.
 * 
 * Note: Web.addEventListener('fetch', ...) automatically sets up
 * globalThis.doGet and globalThis.doPost, so these explicit
 * definitions may be overridden. They're included here for clarity.
 */
function doGet(e) {
  // The addEventListener('fetch', ...) call above already configures doGet
  // This is just a fallback in case it's called before addEventListener runs
  if (typeof Web !== 'undefined' && Web.do) {
    return Web.do(e);
  }
  return ContentService.createTextOutput(JSON.stringify({
    error: 'Web object not initialized'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * doPost function - required by Google Apps Script for web apps
 * Automatically configured by Web.addEventListener('fetch', ...)
 */
function doPost(e) {
  // The addEventListener('fetch', ...) call above already configures doPost
  if (typeof Web !== 'undefined' && Web.do) {
    return Web.do(e);
  }
  return ContentService.createTextOutput(JSON.stringify({
    error: 'Web object not initialized'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function to verify setup
 * Run this from the script editor to test the backend
 */
function testBackend() {
  Logger.log('Testing backend setup...');
  
  // Test with a mock request
  const mockEvent = {
    parameter: { path: '/json' },
    parameters: { path: ['/json'] },
    postData: {
      contents: '',
      length: 0,
      type: 'application/json'
    }
  };
  
  const response = doGet(mockEvent);
  Logger.log('Response: ' + response.getContent());
  Logger.log('Backend test complete!');
}
