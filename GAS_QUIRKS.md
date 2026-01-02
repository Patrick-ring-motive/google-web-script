# Google Apps Script Quirks and Workarounds

This document catalogs the various quirks, limitations, and workarounds needed when working with Google Apps Script (GAS), particularly when implementing Web APIs.

## Class Extension Quirks

### Builtin Extensions Don't Set Prototype Chain Automatically

**Issue**: When extending Google Apps Script builtins (like `Utilities.newBlob`, `ContentService.createTextOutput`, `UrlFetchApp.getRequest`), the constructor doesn't automatically set up the prototype chain on the receiver object.

**Symptom**: Methods defined on your class prototype won't be available on instances without explicit prototype assignment.

**Workaround**: Always end your constructor with:
```javascript
return Object.setPrototypeOf(this, YourClass.prototype);
```

**Examples in this codebase**:
- `Web.Blob` extends `Utilities.newBlob` - line 410
- `Web.Response` extends `ContentService.createTextOutput` - line 1214
- `Web.Request` extends `UrlFetchApp.getRequest` - line 1655
- `Web.RequestEvent` extends `Web.Request` - line 1946
- `Web.ResponseEvent` extends `Web.Response` - line 1565

### Why This Happens

GAS builtins are Java objects wrapped for JavaScript. When you call `super()` in a class extending these objects, the JavaScript `this` binding doesn't work as expected because the actual object construction happens in Java-land. The `setPrototypeOf` call forces the JavaScript prototype chain to be established correctly.

## HTTP and Networking Quirks

### Client-Side Content-Type Headers Trigger CORS Preflight (CRITICAL)

**Issue**: When making requests FROM a browser TO a deployed GAS web app, setting the `Content-Type` header triggers an OPTIONS preflight request that GAS web apps cannot handle.

**Symptom**: Browser console shows CORS errors, OPTIONS request fails, actual POST/GET never happens.

**Workaround**: **Never set Content-Type header in client-side fetch calls to GAS web apps**. Let the browser set it automatically:
```javascript
// BAD - triggers preflight
fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // ❌ Don't do this!
    body: JSON.stringify(data)
});

// GOOD - no preflight
fetch(url, {
    method: 'POST',
    body: JSON.stringify(data) // ✓ Browser sets Content-Type automatically
});
```

**Impact**: Cannot control Content-Type from client, but GAS handles this automatically on the server side.

### POST with FormData Gets Coerced to GET (CRITICAL)

**Issue**: When sending a POST request with FormData payload to a deployed GAS web app, Google automatically converts it to a GET request and moves the FormData fields to query parameters.

**Symptom**: Server receives GET instead of POST, body is empty, all form fields appear in `e.parameter` and `e.parameters` instead of `e.postData`.

**Workaround**: Access form data from parameters instead of body:
```javascript
// In your doGet/doPost handler
function doPost(e) {
    // FormData is in parameters, not postData.contents
    const fieldValue = e.parameter.fieldName;
    const allValues = e.parameters.fieldName; // Array of values
}
```

**Alternative**: For true POST with body, send raw JSON or text instead of FormData.

**Impact**: Cannot use FormData for file uploads to GAS web apps from browser clients.

### Cannot Control Response Headers or Status from Client Tests

**Issue**: When testing a deployed GAS web app from a browser client, the response headers and status codes are controlled by Google's infrastructure, not your script.

**Symptom**: Custom headers set in your script (like CORS headers) don't appear in the response. Status codes might always be 200 even when you return error responses.

**Reality**: GAS web apps always return:
- Status 200 for successful script execution
- Status 500 only if the script crashes/throws
- Limited set of headers (mostly Google's own)

**Impact**: Cannot test:
- Custom response headers
- Status code handling (404, 401, etc.)
- CORS configurations
- Custom error responses

**Workaround**: Include status/headers in response body for testing:
```javascript
return ContentService.createTextOutput(JSON.stringify({
    statusCode: 404, // Not the actual HTTP status, just metadata
    headers: { 'X-Custom': 'value' },
    body: { error: 'Not found' }
}));
```

### Content-Type Header Loss in Request Bodies

**Issue**: When creating a `Web.Request` with a body, the content-type information might not be preserved through the request/event cycle.

**Symptom**: `request.blob().type` or `blob.getContentType()` returns empty string or generic type instead of the actual content-type.

**Workaround**: Always check multiple sources for content-type:
```javascript
const contentType = blob.type || blob.getContentType?.() || headers.get('Content-Type') || '';
```

**Related Code**: 
- FormData `&fromBlob` method - line 1082
- RequestEvent blob creation - line 1964

### UrlFetchApp Header Validation

**Issue**: UrlFetchApp silently rejects certain headers or throws errors on others without clear documentation of what's invalid.

**Solution**: Pre-validate headers using `UrlFetchApp.getRequest()`:
```javascript
function isValidHeader(key, value) {
    try {
        UrlFetchApp.getRequest('https://example.com', {
            headers: { [key]: value }
        });
        return true;
    } catch (e) {
        return false;
    }
}
```

**Related Code**: `isValidHeader` function - line 260

### Logger.log() Doesn't Work in Web App Requests

**Issue**: `Logger.log()` produces output when testing in the script editor, but when your code runs as a deployed web app responding to HTTP requests, the logs are never written.

**Symptom**: No logs appear in View > Logs or the Execution log, even though the code is executing.

**Workaround**: Write logs to a spreadsheet using `DriveApp` and `SpreadsheetApp`:
```javascript
function logToSheet(message, data = {}) {
    try {
        const file = DriveApp.getFilesByName('your-log-sheet').next();
        const sheet = SpreadsheetApp.open(file).getActiveSheet();
        sheet.appendRow([new Date(), message, JSON.stringify(data)]);
    } catch (e) {
        // Can't log the logging error!
    }
}
```

**Related Code**: `logToSheet` function in test/backend.js - line 17

## Object and Type Quirks

### instanceof Fails Across Execution Contexts

**Issue**: `instanceof` checks can throw errors or return false negatives when objects come from different execution contexts/realms.

**Symptom**: `x instanceof Array` might fail even when `x` is clearly an array.

**Workaround**: Use safe checking with multiple fallbacks:
```javascript
const instanceOf = (x, y) => {
    try {
        return x instanceof y;
    } catch {
        return false;
    }
};

const isArray = x => Array.isArray(x) || instanceOf(x, Array) || x?.constructor?.name == 'Array';
```

**Related Code**: `instanceOf` and type checking utilities - lines 199-220

### Hidden Internal Properties on Native Objects

**Issue**: When iterating over GAS native objects (like `HTTPResponse` from `UrlFetchApp`) using `for...in`, you'll encounter hidden internal properties that throw errors when accessed.

**Symptom**: `Cannot convert to string` errors when trying to stringify enumerated properties.

**Workaround**: Wrap string conversion in try-catch:
```javascript
const Str = x => {
    try {
        return String(x);
    } catch {
        return '';
    }
};
```

**Related Code**: `Str` function - line 240

## FormData and Multipart Quirks

### Boundary Information Loss

**Issue**: When a FormData request is received as a `RequestEvent`, the multipart boundary information from the `Content-Type` header might not be properly preserved in the blob.

**Symptom**: `FormData['&fromBlob']` throws "Invalid multipart/form-data: no boundary found"

**Potential Causes**:
1. The `postData.type` in the event object doesn't include the boundary parameter
2. The blob created from `postData.contents` doesn't have content-type set
3. The headers aren't being passed through to the blob creation

**Investigation Needed**: 
- Check if `e.postData.type` includes the full `multipart/form-data; boundary=...` string
- Verify that `Web.Blob` constructor preserves the full content-type string
- Ensure `request.formData()` passes the content-type from headers to the blob

**Related Code**:
- Request.formData() - line 1671
- RequestEvent.blob() - line 1964
- FormData['&fromBlob'] - line 1075

### File Content Encoding in Multipart

**Issue**: When parsing multipart/form-data, file contents are treated as strings, which can corrupt binary data.

**Potential Solution**: Use base64 encoding for binary file data in multipart bodies, or keep file data as byte arrays instead of strings.

**Status**: Under investigation

## Content Service and MIME Types

### ContentService.MimeType Enum Limitations

**Issue**: ContentService only supports a limited set of MIME types via the `ContentService.MimeType` enum. Custom MIME types must use `downloadAsFile()` instead.

**Symptom**: Can't set arbitrary content-types on responses.

**Workaround**: Map known types to the enum, fall back to `downloadAsFile` for others:
```javascript
let mimeType;
for(const [key, value] of Object.entries(ContentService.MimeType)) {
    if (contentType.includes(key.toLowerCase())) {
        mimeType = value;
        break;
    }
}

if (!mimeType) {
    output.downloadAsFile(contentType);
}
```

**Related Code**: ResponseEvent content-type handling - line 1520

### HtmlService Auto-Sandboxing

**Issue**: When returning HTML content, it must go through `HtmlService.createHtmlOutput()` which applies sandboxing and security restrictions.

**Impact**: Inline scripts might be blocked, certain HTML features disabled.

**Related Code**: ResponseEvent XML/HTML handling - line 1559

## Error Handling Quirks

### Exceptions in doGet/doPost Are Swallowed

**Issue**: If your `doGet(e)` or `doPost(e)` function throws an exception, Google Apps Script shows a generic error page to the client instead of your error response.

**Workaround**: Always wrap handler logic in try-catch and return error responses:
```javascript
function doPost(e) {
    try {
        return Web.do(e, handler);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
```

**Related Code**: Web.do() error handling - line 2087

## Performance Quirks

### Spreadsheet Access is Expensive

**Issue**: Every call to `DriveApp.getFilesByName()` and `SpreadsheetApp.open()` is slow.

**Symptom**: Logging to spreadsheet significantly slows down request handling.

**Workaround**: Memoize the spreadsheet/sheet references:
```javascript
let cachedSheet;
function getLogSheet() {
    if (!cachedSheet) {
        const file = DriveApp.getFilesByName('log-sheet-name').next();
        cachedSheet = SpreadsheetApp.open(file).getActiveSheet();
    }
    return cachedSheet;
}
```

**Related Code**: logToSheet memoization - line 17 in test/backend.js

### UrlFetchApp.fetch() Has 6 Second Timeout by Default

**Issue**: External HTTP requests will timeout after 6 seconds unless explicitly configured.

**Workaround**: Set longer timeout in fetch options:
```javascript
UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    deadline: 60 // seconds
});
```

## Best Practices

### Use Symbols for Private State

**Why**: Prevents enumeration and naming conflicts with native object properties.

```javascript
const $privateData = Symbol('*privateData');
class MyClass {
    constructor() {
        this[$privateData] = 'hidden';
    }
}
```

**Related Code**: $body, $status, $statusText, $headers symbols - line 1156

### Validate All External Input

**Why**: GAS doesn't have strong type checking, and errors can be cryptic.

```javascript
if (arguments.length < 2) {
    throw new TypeError(`${2} argument required, but only ${arguments.length} present.`);
}
```

### Use Hidden Properties for Non-Spec Extensions

**Why**: Keeps non-standard methods separate from spec-compliant API surface.

```javascript
const setHidden = (obj, prop, value) => {
    Object.defineProperty(obj, prop, {
        value,
        writable: true,
        enumerable: false,
        configurable: true
    });
};

setHidden(FormData.prototype, '&toBlob', function toBlob() { ... });
```

**Related Code**: setHidden helper - line 178

## Testing Quirks

### No Native Test Framework

**Issue**: GAS has no built-in unit testing framework.

**Solution**: Build your own using simple assertions:
```javascript
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}
```

### Deployed Web Apps Cache Aggressively

**Issue**: Changes to your script might not reflect immediately in deployed web apps.

**Workaround**:
1. Create new deployment version after changes
2. Use versioned URLs for testing
3. Add cache-busting query parameters: `?v=${Date.now()}`

---

## Contributing to This Document

If you discover new quirks or workarounds, please add them here with:
- Clear description of the issue
- Symptoms that help identify it
- Workaround or solution
- References to related code (line numbers)
- Date discovered (for tracking if GAS fixes it)
