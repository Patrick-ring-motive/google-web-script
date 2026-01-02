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

// Helper function to log to Google Drive spreadsheet
const logToSheet = (()=>{
  const memo = {};

  return function logToSheet(message, data) {
    try {
      const name = 'google-web-scripts-log';
      const files = memo[name] || DriveApp.getFilesByName(name);
      memo[name] = files;
      const file = memo.file || files?.next?.();
      memo.file = file;
      const spreadSheet = memo.spreadSheet || SpreadsheetApp.openById(file.getId());
      memo.spreadSheet = spreadSheet;
      const sheet = memo.sheet || spreadSheet.getActiveSheet();
      memo.sheet = sheet;
      sheet.getActiveSheet().appendRow([new Date(), message, JSON.stringify(data)]);
    } catch (e) {
      // Ignore logging errors
    }
  };
})();

// Set up the fetch event listener
Web.addEventListener('fetch', (request) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestType: typeof request,
    hasMethod: 'method' in request,
    method: request.method,
    hasParameter: 'parameter' in request,
    hasParameters: 'parameters' in request,
  };
  
  logToSheet('Request received', debugInfo);
  
  try {
    const url = request.url || '';
    const rawPath = request.parameter?.path || request.parameters?.path?.[0] || '/';
    const path = decodeURIComponent(rawPath);
    
    debugInfo.url = url;
    debugInfo.rawPath = rawPath;
    debugInfo.path = path;
    debugInfo.parameters = request.parameters;
    
    logToSheet('Processing path', { path, rawPath, parameters: request.parameters });
    
    // Echo endpoint - returns request details
    if (/echo$/i.test(path)) {
      try {
        const requestData = {
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
      } catch (e) {
        return new Web.Response(JSON.stringify({ 
          error: 'Echo endpoint failed',
          message: e.toString(),
          stack: e.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // JSON endpoint - returns JSON response
    if (/json$/i.test(path)) {
      try {
        return new Web.Response(JSON.stringify({ 
          message: 'Hello from Google Apps Script',
          timestamp: new Date().toISOString(),
          success: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Web.Response(JSON.stringify({ 
          error: 'JSON endpoint failed',
          message: e.toString(),
          stack: e.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST endpoint - handles POST requests
    if (/post$/i.test(path)) {
      logToSheet('POST endpoint matched', { path });
      debugInfo.endpointMatched = 'POST';
      let receivedData = null;
      
      try {
        const bodyText = request.text();
        debugInfo.bodyLength = bodyText ? bodyText.length : 0;
        debugInfo.bodyPreview = bodyText ? bodyText.substring(0, 100) : null;
        
        logToSheet('POST body read', { bodyLength: debugInfo.bodyLength, bodyPreview: debugInfo.bodyPreview });
        
        if (bodyText) {
          receivedData = JSON.parse(bodyText);
          debugInfo.parsedJSON = true;
          logToSheet('POST JSON parsed', { keys: Object.keys(receivedData) });
        }
      } catch (e) {
        debugInfo.parseError = e.toString();
        logToSheet('POST parse error', { error: e.toString(), stack: e.stack });
        return new Web.Response(JSON.stringify({ 
          error: 'Invalid JSON in request body',
          message: e.toString(),
          debug: debugInfo
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      logToSheet('POST returning response', { receivedData });
      const response = new Web.Response(JSON.stringify({ 
        message: 'POST received',
        received: receivedData,
        timestamp: new Date().toISOString(),
        debug: debugInfo
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
      logToSheet('POST response created', { responseType: typeof response, hasGetContent: typeof response?.getContent === 'function' });
      return response;
    }
    
    // FormData endpoint - handles multipart/form-data
    if (/formdata$/i.test(path)) {
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
    if (/status\//i.test(path)) {
      try {
        const statusCode = parseInt(path.split('/').pop());
        if (statusCode >= 200 && statusCode < 600) {
          return new Web.Response(JSON.stringify({ 
            status: statusCode,
            message: 'Status code test'
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Web.Response(JSON.stringify({ 
            error: 'Invalid status code',
            message: `Status code ${statusCode} is out of valid range (200-599)`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Web.Response(JSON.stringify({ 
          error: 'Status endpoint failed',
          message: e.toString(),
          stack: e.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Headers endpoint - returns request headers
    if (/headers$/i.test(path)) {
      try {
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
      } catch (e) {
        return new Web.Response(JSON.stringify({ 
          error: 'Headers endpoint failed',
          message: e.toString(),
          stack: e.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Default response - API info
    debugInfo.endpointMatched = 'default';
    logToSheet('No endpoint matched, returning default', { path });
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
      timestamp: new Date().toISOString(),
      debug: debugInfo
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    // Error handler
    debugInfo.topLevelError = error.toString();
    debugInfo.topLevelStack = error.stack;
    logToSheet('Top-level error', { error: error.toString(), stack: error.stack, debugInfo });
    return new Web.Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.toString(),
      stack: error.stack,
      debug: debugInfo
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Note: Web.addEventListener('fetch', ...) automatically creates globalThis.doGet
// and globalThis.doPost, so we don't need to define them explicitly here.
// If you want explicit functions for clarity in the Apps Script editor, they
// should be defined BEFORE calling Web.addEventListener, not after.

/**
 * Test function to verify setup
 * Run this from the script editor to test the backend
 */
function testBackend() {
  Logger.log('Testing backend setup...');
  
  // Test with a mock GET request
  const mockGetEvent = {
    parameter: { path: '/json' },
    parameters: { path: ['/json'] },
    postData: {
      contents: '',
      length: 0,
      type: 'application/json'
    }
  };
  
  const getResponse = doGet(mockGetEvent);
  Logger.log('GET Response type: ' + typeof getResponse);
  Logger.log('GET Response has getContent: ' + (typeof getResponse?.getContent === 'function'));
  if (getResponse && typeof getResponse.getContent === 'function') {
    Logger.log('GET Response content: ' + getResponse.getContent());
  }
  
  // Test with a mock POST request
  const mockPostEvent = {
    parameter: { path: '/post' },
    parameters: { path: ['/post'] },
    postData: {
      contents: '{"test": "data"}',
      length: 16,
      type: 'application/json'
    }
  };
  
  const postResponse = doPost(mockPostEvent);
  Logger.log('POST Response type: ' + typeof postResponse);
  Logger.log('POST Response has getContent: ' + (typeof postResponse?.getContent === 'function'));
  if (postResponse && typeof postResponse.getContent === 'function') {
    Logger.log('POST Response content: ' + postResponse.getContent());
  }
  
  Logger.log('Backend test complete!');
}
