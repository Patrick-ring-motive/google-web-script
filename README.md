# google-web-script

A comprehensive Web API polyfill library for Google Apps Script that brings familiar browser-based fetch API and Web standards to the Google Apps Script environment, with bidirectional support for both outgoing HTTP requests and incoming web app handlers.

## Overview

`google-web-script` provides a complete Web-compatible API layer on top of Google Apps Script's built-in services. It implements standard Web APIs like `fetch()`, `Blob`, `Headers`, `Request`, and `Response` by wrapping Google's `UrlFetchApp` and `Utilities` services with a modern, Web-standard interface.

**What makes this library unique:**
- **Synchronous by design** - Works naturally with Google Apps Script's synchronous execution model
- **Bidirectional compatibility** - Use the same APIs for both making requests (fetch) and handling incoming requests (doGet/doPost)
- **Automatic header validation** - Prevents runtime errors from invalid headers
- **Smart content-type detection** - Automatically infers content types when headers are missing
- **Full Web API compatibility** - Write code that works like browser fetch while leveraging Google's infrastructure

## Features

- **Web.fetch()** - Fetch API implementation using UrlFetchApp
- **Web.Blob** - Web Blob API compatible with Google Apps Script
- **Web.Headers** - HTTP Headers management with case-insensitive handling and validation
- **Web.Request** - Request objects with standard Web API interface and flexible constructors
- **Web.Response** - Response objects with methods like `.json()`, `.text()`, `.blob()`, `.clone()`
- **Web.RequestEvent** - Wraps doGet/doPost events with Web API methods
- **Web.ResponseEvent** - Converts Web.Response to Apps Script-compatible output
- **Web.do()** - Universal handler wrapper for doGet/doPost with automatic request/response conversion

## Installation

1. Open your Google Apps Script project
2. Create a new script file (e.g., `web.js`)
3. Copy the contents of [`web.js`](https://github.com/Patrick-ring-motive/google-web-script/blob/main/web.js) into your project

Or add as a library using the Google Apps Script Library feature.

## Usage

### Basic Fetch Request

```javascript
const response = Web.fetch('https://api.example.com/data');
const data = response.json();
Logger.log(data);
```

### Fetch with Options

```javascript
const response = Web.fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'John Doe' })
});

Logger.log(response.status);
Logger.log(response.ok);
const result = response.text();
```

### Creating Web Apps with doGet/doPost

```javascript
// Simple handler using Web.do()
function doGet(e) {
  return Web.do(e);
}

function doPost(e) {
  return Web.do(e);
}

// Custom handler with Web.do()
function doGet(e) {
  return Web.do(e, (request) => {
    const userId = request.parameter.userId;
    const data = { userId, timestamp: new Date().toISOString() };
    
    return new Web.Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

// Manual handling with RequestEvent and ResponseEvent
function doPost(e) {
  const request = new Web.RequestEvent(e);
  const body = request.json();
  
  const response = new Web.Response(JSON.stringify({ 
    received: body,
    success: true 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  return new Web.ResponseEvent(response);
}
```

### Working with Headers

```javascript
const headers = new Web.Headers({
  'Authorization': 'Bearer token123',
  'Content-Type': 'application/json'
});

headers.append('X-Custom-Header', 'value');
headers.get('Authorization'); // 'Bearer token123'
headers.has('Content-Type'); // true

// Headers automatically validate against UrlFetchApp constraints
headers.set('Invalid-Header', 'value'); // Silently skipped if invalid
```

### Request Object Patterns

```javascript
// Pattern 1: URL only
const req1 = new Web.Request('https://api.example.com');

// Pattern 2: URL with options
const req2 = new Web.Request('https://api.example.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'value' })
});

// Pattern 3: Options object containing URL
const req3 = new Web.Request({
  url: 'https://api.example.com',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
```

### Response Handling and Cloning

```javascript
const response = Web.fetch('https://example.com/api');

// Check status
if (response.ok) {
  Logger.log('Success!');
}

// Get response data in different formats
const text = response.text();
const json = response.json();
const blob = response.blob();
const bytes = response.bytes();
const arrayBuffer = response.arrayBuffer();

// Clone for multiple reads
const clone1 = response.clone();
const clone2 = response.clone();
const data1 = clone1.json();
const data2 = clone2.text();
```

### Blob Operations

```javascript
const blob = new Web.Blob(['Hello, World!'], 'text/plain');
Logger.log(blob.size);
Logger.log(blob.type);

const text = blob.text();
const bytes = blob.bytes();
const buffer = blob.arrayBuffer();

// Slice operations
const sliced = blob.slice(0, 5);
```

## API Reference

### Web.fetch(url, options)

Performs an HTTP request and returns a Response object.

**Parameters:**
- `url` (String): The URL to fetch
- `options` (Object): Request options
  - `method`: HTTP method (GET, POST, PUT, DELETE, etc.)
  - `headers`: Request headers object or Headers instance
  - `body` or `payload`: Request body
  - `muteHttpExceptions`: Boolean (default: true)
  - `validateHttpsCertificates`: Boolean (default: false)

**Returns:** `Web.Response` object

### Web.do(request, handler)

Universal handler wrapper for doGet/doPost that automatically converts requests and responses.

**Parameters:**
- `request` (Object|Web.RequestEvent): Raw event object from doGet/doPost
- `handler` (Function): Optional handler function that receives RequestEvent and returns Response

**Returns:** ContentService or HtmlService output ready to return from doGet/doPost

**Example:**
```javascript
function doGet(e) {
  return Web.do(e, (request) => {
    return new Web.Response('Hello, World!');
  });
}
```

### Web.Headers

Web-standard Headers interface with case-insensitive key handling and automatic validation.

**Methods:**
- `append(key, value)` - Adds a header (validates first)
- `delete(key)` - Removes a header
- `get(key)` - Gets a header value
- `has(key)` - Checks if header exists
- `set(key, value)` - Sets a header (validates first)
- `getAll(key)` - Gets all values for a header
- `getSetCookie()` - Gets all Set-Cookie headers as array
- `entries()` - Returns iterator of [key, value] pairs
- `keys()` - Returns iterator of keys
- `values()` - Returns iterator of values
- `forEach(callback, thisArg)` - Iterates over headers

### Web.Response

Response object returned by Web.fetch() or created manually.

**Properties:**
- `status` - HTTP status code
- `statusText` - HTTP status message
- `ok` - Boolean indicating success (status 200-299)
- `headers` - Response headers (Web.Headers instance)

**Methods:**
- `text()` - Returns response as text
- `json()` - Parses response as JSON
- `blob()` - Returns response as Blob
- `bytes()` - Returns response as Uint8Array
- `arrayBuffer()` - Returns response as ArrayBuffer
- `clone()` - Creates a clone of the response
- `getAllHeaders()` - Returns headers with cookies as arrays

### Web.ResponseEvent

Wraps a Web.Response for returning from doGet/doPost handlers. Automatically converts to ContentService or HtmlService output based on content type.

**Constructor:**
```javascript
new Web.ResponseEvent(response)
```

**Features:**
- Automatically detects content type (JSON, XML, HTML, CSV, JavaScript, plain text)
- Returns appropriate ContentService or HtmlService output
- Preserves all response properties and methods

### Web.Request

Request object for HTTP requests with flexible constructor patterns.

**Properties:**
- `url` - Request URL
- `method` - HTTP method
- `headers` - Request headers
- `body` - Request body

**Methods:**
- `text()` - Gets body as text
- `json()` - Parses body as JSON
- `blob()` - Gets body as Blob
- `bytes()` - Gets body as Uint8Array
- `arrayBuffer()` - Gets body as ArrayBuffer
- `clone()` - Creates a clone of the request

### Web.RequestEvent

Wraps doGet/doPost event objects with Web API methods. Extends Web.Request.

**Constructor:**
```javascript
new Web.RequestEvent(eventObject)
```

**Properties (from event):**
- `queryString` - URL query string
- `parameter` - Query parameters as key-value pairs
- `parameters` - Query parameters as key-array pairs
- `pathInfo` - URL path after web app URL
- `postData` - POST request data object
- `contentLength` - Content length

**Methods:**
- All Web.Request methods (text, json, blob, bytes, arrayBuffer)
- Automatically extracts data from postData.contents

**Special Headers:**
- Includes ScriptApp metadata headers (X-ScriptApp-AuthMode, etc.)
- Complete URL built from ScriptApp.getService().getUrl()

### Web.Blob

Blob implementation compatible with Google Apps Script.

**Properties:**
- `size` - Size in bytes
- `type` - MIME type

**Methods:**
- `text()` - Returns content as text
- `bytes()` - Returns content as Uint8Array
- `arrayBuffer()` - Returns content as ArrayBuffer
- `slice(start, end)` - Creates a new Blob from a portion

## Implementation Details

### Key Design Decisions

- **Synchronous API** - Unlike browser fetch, this is intentionally synchronous to match Google Apps Script's execution model
- **Header Validation** - All headers are validated using UrlFetchApp.getRequest() before being set to prevent runtime errors
- **Plain Object Storage** - Headers are stored as plain objects (not Maps) for direct UrlFetchApp compatibility
- **Cookie Handling** - Multiple Set-Cookie headers use random casing trick to store in plain objects
- **Prototype Augmentation** - Uses setPrototypeOf to enhance native objects rather than wrapping them
- **Cross-realm Type Checking** - Type checks use multiple methods (instanceof, constructor.name) for reliability
- **Safe String Conversion** - Str() utility handles hidden Java properties that throw on stringification

### Content Type Detection

ResponseEvent automatically detects content types:
1. Checks Content-Type header first
2. Falls back to parsing body content:
   - Valid JSON → `application/json`
   - Valid XML → `text/xml` (uses HtmlService)
   - Valid CSV → `text/csv`
   - Valid JavaScript → `application/javascript`
   - Default → `text/plain`

## Use Cases

- Making HTTP requests from Google Sheets, Docs, or Forms
- Building REST API integrations
- Creating web apps with familiar Web API syntax
- Handling both incoming and outgoing HTTP in a unified way
- Migrating browser-based code to Google Apps Script
- Simplifying HTTP operations in Apps Script automation
- Building webhook receivers with standard request handling

## Limitations

- Synchronous operation (not Promise-based like browser fetch)
- Runs in Google Apps Script environment, subject to Apps Script quotas
- Some Web APIs may not be fully implemented
- Performance depends on Google's UrlFetchApp service limits
- Header validation may silently skip invalid headers

## Contributing

Contributions are welcome! Visit the [GitHub repository](https://github.com/Patrick-ring-motive/google-web-script) to submit issues or pull requests.

## License

No license information provided. Please check the repository for details.

## Links

- **Repository:** [https://github.com/Patrick-ring-motive/google-web-script](https://github.com/Patrick-ring-motive/google-web-script)
- **Main File:** [web.js](https://github.com/Patrick-ring-motive/google-web-script/blob/main/web.js)

## Compatibility

- **Platform:** Google Apps Script
- **Language:** JavaScript
- **API Version:** Based on Web standards (Fetch API, Blob API, etc.)
- **Apps Script Runtime:** V8 Runtime recommended

---

*Last updated: December 30, 2025*
