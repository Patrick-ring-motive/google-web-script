# google-web-script

A Web API polyfill library for Google Apps Script that brings familiar browser-based fetch API and Web standards to the Google Apps Script environment.

## Overview

`google-web-script` provides a Web-compatible API layer on top of Google Apps Script's built-in services. It implements standard Web APIs like `fetch()`, `Blob`, `Headers`, `Request`, and `Response` by wrapping Google's `UrlFetchApp` and `Utilities` services with a more modern, Web-standard interface.

## Features

-  **Web.fetch()** - Fetch API implementation using UrlFetchApp
-  **Web.Blob** - Web Blob API compatible with Google Apps Script
-  **Web.Headers** - HTTP Headers management with Web API methods
-  **Web.Request** - Request objects with standard Web API interface
-  **Web.Response** - Response objects with methods like `.json()`, `.text()`, `.blob()`
-  **Web.RequestEvent** - Event handling for web requests

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

### Working with Headers

```javascript
const headers = new Web.Headers({
  'Authorization': 'Bearer token123',
  'Content-Type': 'application/json'
});

headers.append('X-Custom-Header', 'value');
headers.get('Authorization'); // 'Bearer token123'
headers.has('Content-Type'); // true
```

### Creating Request Objects

```javascript
const request = new Web.Request('https://api.example.com', {
  method: 'GET',
  headers: { 'Accept': 'application/json' }
});

const body = request.text();
const jsonData = request.json();
```

### Response Handling

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

### Web.Headers

Web-standard Headers interface with case-insensitive key handling.

**Methods:**
- `append(key, value)` - Adds a header
- `delete(key)` - Removes a header
- `get(key)` - Gets a header value
- `has(key)` - Checks if header exists
- `set(key, value)` - Sets a header
- `getAll(key)` - Gets all values for a header
- `entries()` - Returns iterator of [key, value] pairs
- `keys()` - Returns iterator of keys
- `values()` - Returns iterator of values
- `forEach(callback)` - Iterates over headers

### Web.Response

Response object returned by Web.fetch().

**Properties:**
- `status` - HTTP status code
- `statusText` - HTTP status message
- `ok` - Boolean indicating success (status 200-299)
- `headers` - Response headers

**Methods:**
- `text()` - Returns response as text
- `json()` - Parses response as JSON
- `blob()` - Returns response as Blob
- `bytes()` - Returns response as Uint8Array
- `arrayBuffer()` - Returns response as ArrayBuffer

### Web.Request

Request object for HTTP requests.

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

### Web.RequestEvent

Event object for handling web requests in Apps Script web apps.

**Default Properties:**
- `queryString` - URL query string
- `parameter` - Query parameters object
- `parameters` - All parameters
- `pathInfo` - URL path information
- `contextPath` - Context path
- `postData` - POST request data
- `contentLength` - Content length

## Implementation Details

- Built on top of Google Apps Script's `UrlFetchApp` and `Utilities` services
- Maintains Web API compatibility while leveraging Google's infrastructure
- Handles cookies with special case-insensitive header management
- Supports both `body` and `payload` options for compatibility
- Automatic error handling with customizable exception behavior
- Extends native Google Apps Script objects for seamless integration

## Use Cases

- Making HTTP requests from Google Sheets, Docs, or Forms
- Building REST API integrations
- Creating web apps with familiar Web API syntax
- Migrating browser-based code to Google Apps Script
- Simplifying HTTP operations in Apps Script automation

## Limitations

- Runs in Google Apps Script environment, subject to Apps Script quotas
- Some Web APIs may not be fully implemented
- Performance depends on Google's UrlFetchApp service limits

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

---

*Last updated: December 30, 2025*
