/**
 * Google Web Script - Web API Polyfill for Google Apps Script
 * 
 * This library provides Web-standard APIs (fetch, Blob, Headers, Request, Response)
 * for use in Google Apps Script environment by wrapping Google's native services.
 * 
 * IMPORTANT: This library is SYNCHRONOUS, unlike browser fetch() which is Promise-based.
 * This is intentional because Google Apps Script's UrlFetchApp is synchronous,
 * and there's no benefit to wrapping it in Promises. This actually makes it easier
 * to use in Apps Script contexts where you typically want sequential execution.
 * 
 * The main challenge is balancing Web API standards with Google Apps Script quirks:
 * - UrlFetchApp expects plain JS objects for options, not specialized classes
 * - Built-in objects have hidden properties that throw when accessed
 * - No native Promise support in older Apps Script runtimes
 * - Different object inheritance patterns than browser JavaScript
 * 
 * @fileoverview Web API compatibility layer for Google Apps Script
 * @author Patrick Ring (Patrick-ring-motive)
 * @license Not specified
 */

// IIFE to avoid polluting global namespace while still exposing Web object
(() => {
    // Initialize the global Web namespace if it doesn't exist
    globalThis.Web = globalThis.Web || class Web {};

    /**
     * Utility function to define immutable properties on objects
     * @param {Object} object - The object to define properties on
     * @param {Object} property - An object containing a single key-value pair to set
     * @returns {Object} The property descriptor
     */
    const setProperty = (object, property) => {
        const [key, value] = Object.entries(property).pop();
        return Object.defineProperty(object, key, {
            value,
            enumerable: true,
            configurable: false,
            writable: false
        });
    };
    Web.setProperty = setProperty;

    /**
     * Safe instanceof check that handles potential errors
     * 
     * WHY THIS EXISTS: Google Apps Script's runtime sometimes throws errors
     * when using instanceof with certain built-in objects or when checking
     * against constructors from different execution contexts. This wrapper
     * ensures the check never crashes and falls back to false.
     * 
     * @param {*} x - Value to check
     * @param {Function} y - Constructor to check against
     * @returns {boolean} True if x is an instance of y
     */
    const instanceOf = (x, y) => {
        try {
            return x instanceof y;
        } catch (_) {
            return false;
        }
    };

    // Type checking utility functions
    // WHY MULTIPLE CHECKS: These check three ways (built-in, instanceof, constructor.name)
    // because objects can come from different execution contexts/realms in Apps Script.
    // instanceof can fail across realms, so we also check constructor.name as fallback.
    
    // Gets length from various object types (arrays, typed arrays, blobs, etc.)
    const len = x => x?.length || x?.size || x?.byteLength;
    
    // Checks if value is non-negative number (sufficient for validating byte values 0-255)
    const isNum = x => x > -1;
    
    const hasBits = x => !!(x?.bytes || x?.getBytes);
    const getBits = x => x.getBytes?.() ?? x.bytes();
    const isBits = x => Array.prototype.every.call(x, isNum);
    const hasBuffer = x => !!x?.buffer;
    const is = (x, type) => instanceOf(x, type) || x?.constructor?.name === type.name;
    const isBuffer = x => is(x, ArrayBuffer);
    const isArray = x => Array.isArray(x) || is(x, Array);
    const isString = x => typeof x === 'string' || is(x, String);

    /**
     * Safe string conversion that handles errors
     * 
     * WHY THIS EXISTS: When iterating over Google Apps Script's built-in objects
     * (like HTTPResponse from UrlFetchApp) using for...in loops, you'll encounter
     * hidden internal properties that throw errors when you try to stringify them.
     * This wrapper catches those errors and returns a safe string representation.
     * 
     * Example: UrlFetchApp response objects have internal Java properties that
     * are enumerable but throw "Cannot convert to string" errors.
     * 
     * @param {*} x - Value to convert to string
     * @returns {string} String representation
     */
    const Str = x => {
        try {
            return String(x);
        } catch (e) {
            return String(e);
        }
    };

    /**
     * Validates if a header key-value pair is acceptable to UrlFetchApp
     * 
     * WHY THIS EXISTS: UrlFetchApp is strict about what headers it accepts.
     * Some header names or values that seem valid will cause UrlFetchApp to throw.
     * By testing with UrlFetchApp.getRequest(), we can validate headers before
     * actually using them, preventing runtime errors during fetch operations.
     * 
     * @param {string} key - Header name
     * @param {string} value - Header value
     * @returns {boolean} True if header is valid
     */
    function isValidHeader(key, value) {
        try {
            const headers = {};
            headers[key] = value;
            UrlFetchApp.getRequest('https://is.Valid.Header', { headers });
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Converts various data types to byte arrays
     * Handles strings, ArrayBuffers, Uint8Arrays, and objects with getBytes() methods
     * 
     * WHY SO COMPLEX: This function bridges the gap between Web APIs (which use
     * ArrayBuffer/Uint8Array) and Google Apps Script (which uses byte arrays from
     * Utilities.newBlob). It needs to handle:
     * - Web standard types (ArrayBuffer, Uint8Array)
     * - Google Apps Script Blobs (with getBytes())
     * - Plain strings
     * - Nested arrays of any of the above
     * 
     * The multiple checks ensure data can flow smoothly between Web-style code
     * and Google's APIs without manual conversion.
     * 
     * @param {*} x - Data to convert
     * @returns {Array<number>} Byte array
     */
    function toBits(x) {
        if (isString(x)) {
            return Utilities.newBlob(x).getBytes();
        }
        if (isBuffer(x) || hasBuffer(x)) {
            return Object.setPrototypeOf(new Uint8Array(x.buffer ?? x), Array.prototype);
        }
        if (hasBits(x)) {
            return Object.setPrototypeOf(getBits(x), Array.prototype);
        }
        if (isBits(x)) {
            return x;
        }
        if (isArray(x)) {
            return x.map(toBits).flat();
        }
        return x;
    }

    /**
     * Web.Blob - Web-compatible Blob implementation
     * Extends Google Apps Script's Utilities.newBlob with Web API methods
     * 
     * WHY EXTEND INSTEAD OF WRAP: We extend Utilities.newBlob directly because
     * UrlFetchApp and other Google APIs expect actual Blob objects, not wrappers.
     * By extending, our Web.Blob instances work seamlessly with all Google APIs
     * while still providing Web-standard methods like .text(), .arrayBuffer(), etc.
     * 
     * The setPrototypeOf calls ensure the Web API methods are available even when
     * the native Blob constructor doesn't cooperate with normal class extension.
     */

    const Blob = class WebBlob {

        /**
         * Creates a new Blob object
         * @param {Array|string|ArrayBuffer} parts - Data to include in the blob
         * @param {string} type - MIME type
         * @param {string} name - Optional name for the blob
         */
        constructor(parts = [], type, name) {
            let blobContent = parts;
            const resolvedType = type?.type ?? type ?? parts?.type ?? parts?.getContentType?.() ?? undefined;

            if (len(parts) && !isString(parts)) {
                blobContent = toBits(parts);
            }
            
            // This is a simplified representation. The mock will handle the actual "blob" creation.
            this.blobData = blobContent;
            this.blobType = resolvedType;
            this.blobName = name;
            
            // In the real environment, this would be a Google Apps Script Blob
            const underlyingBlob = Utilities.newBlob(blobContent, resolvedType, name);
            Object.assign(this, underlyingBlob);
        }

        /**
         * Gets the size of the blob in bytes
         * @returns {number} Size in bytes
         */
        get size() {
            return this.getBytes().length;
        }

        /**
         * Gets the MIME type of the blob
         * @returns {string} MIME type
         */
        get type() {
            return this.getContentType();
        }

        /**
         * Gets blob content as text
         * @returns {string} Text content
         */
        text() {
            return this.getDataAsString();
        }

        /**
         * Gets blob content as Uint8Array
         * @returns {Uint8Array} Byte array
         */
        bytes() {
            return new Uint8Array(this.getBytes());
        }

        /**
         * Gets blob content as ArrayBuffer
         * @returns {ArrayBuffer} Array buffer
         */
        arrayBuffer() {
            return new Uint8Array(this.getBytes()).buffer;
        }

        /**
         * Creates a new blob from a slice of this blob
         * @param {...number} args - Start and end positions
         * @returns {Web.Blob} New blob containing the slice
         */
        slice() {
            return new Web.Blob(this.getBytes().slice(...arguments), this.getContentType());
        }

    };

    setProperty(Web, { Blob });

    /**
     * Web.Headers - HTTP Headers management with Web API compatibility
     * Implements case-insensitive header handling and cookie management
     * 
     * WHY PLAIN OBJECT STORAGE: UrlFetchApp.fetch() expects headers as a plain
     * JavaScript object like { 'Content-Type': 'application/json' }, NOT a Map
     * or specialized class instance. So we store headers directly as properties
     * on the object itself, making it trivially compatible with UrlFetchApp.
     * 
     * The Web API methods (get, set, has, etc.) provide the standard interface
     * while the internal storage remains a plain object that UrlFetchApp accepts.
     * 
     * COOKIE HANDLING: Set-Cookie headers can appear multiple times with the same
     * name, so we use the trick of randomizing the casing to create unique
     * property names that still match case-insensitive lookups.
     */
    const Headers = class WebHeaders {
        constructor(entries) {
            this.headers = {}; // Maps lower-case name to { key: originalKey, values: [value1, value2] }
            if (!entries) return;

            if (entries instanceof Web.Headers) {
                this.headers = JSON.parse(JSON.stringify(entries.headers));
                return;
            }
            
            if (typeof entries[Symbol.iterator] === 'function' && !isString(entries)) {
                for (const [key, value] of entries) {
                    this.append(key, value);
                }
            } else if (typeof entries === 'object') {
                for (const key of Object.keys(entries)) {
                    this.append(key, entries[key]);
                }
            }
        }

        get size() {
            return Object.keys(this.headers).length;
        }

        delete(key) {
            if (!key) return;
            delete this.headers[String(key).toLowerCase()];
        }

        set(key, value) {
            if (!isValidHeader(key, value)) return;
            const lowerKey = String(key).toLowerCase();
            this.headers[lowerKey] = { key: String(key), values: [String(value)] };
        }

        get(key) {
            if (!key) return null;
            const header = this.headers[String(key).toLowerCase()];
            return header ? header.values.join(', ') : null;
        }

        getSetCookie() {
            return this.getAll('set-cookie');
        }

        getAll(key) {
            if (!key) return [];
            const header = this.headers[String(key).toLowerCase()];
            return header ? header.values : [];
        }

        has(key) {
            return this.headers.hasOwnProperty(String(key).toLowerCase());
        }

        append(key, value) {
            if (!isValidHeader(key, value)) return;
            const lowerKey = String(key).toLowerCase();
            
            if (this.headers[lowerKey]) {
                this.headers[lowerKey].values.push(String(value));
            } else {
                this.headers[lowerKey] = { key: String(key), values: [String(value)] };
            }
        }

        entries() {
            return Object.values(this.headers).map(h => [h.key, h.values.join(', ')]).values();
        }

        [Symbol.iterator]() {
            return this.entries();
        }

        keys() {
            return Object.values(this.headers).map(h => h.key).values();
        }

        values() {
            return Object.values(this.headers).map(h => h.values.join(', ')).values();
        }

        forEach(callback, thisArg) {
            for (const header of Object.values(this.headers)) {
                callback.call(thisArg, header.values.join(', '), header.key, this);
            }
        }
    };

    setProperty(Web, { Headers });

    // Private symbols for Response internal state
    // WHY SYMBOLS: We use symbols to hide internal state from enumeration and
    // prevent conflicts with properties that UrlFetchApp's response objects might have.
    // This ensures our methods can safely store state without interfering with the
    // underlying Google Apps Script object when we use setPrototypeOf.
    const $body = Symbol('*body');
    const $status = Symbol('*status');
    const $statusText = Symbol('*statusText');
    const $headers = Symbol('*headers');

    /**
     * Web.Response - HTTP Response object with Web API compatibility
     */
    const Response = class WebResponse {

        /**
         * Creates a new Response object
         * @param {*} body - Response body
         * @param {Object} options - Response options (status, statusText, headers)
         */
        constructor(body, options = {}) {
            Object.assign(this, options);
            this[$headers] = new Web.Headers(this.headers);
            this[$status] = options.status ?? 200;
            this[$statusText] = options.statusText ?? 'OK';
            
            if (body) {
                try {
                    this[$body] = new Web.Blob(body);
                } catch (e) {
                    this[$body] = new Web.Blob(Str(body));
                    this[$status] = 500;
                    this[$statusText] = Str(e);
                    setProperty(this, { status: this[$status] });
                    setProperty(this, { statusText: this[$statusText] } );
                }
            }
        }

        /**
         * Gets all response headers with cookies as arrays
         * 
         * WHY THIS EXISTS: The native UrlFetchApp.HTTPResponse.getAllHeaders() returns
         * headers as a plain object. We enhance it to properly handle multiple cookies
         * by returning them as arrays, while keeping other headers as single values.
         * 
         * @returns {Object} Headers object with cookies/set-cookie as arrays
         */
        getAllHeaders() {
            const result = {};
            for (const header of Object.values(this[$headers].headers)) {
                result[header.key] = header.values.length > 1 ? header.values : header.values[0];
            }
            return result;
        }

        /**
         * Gets response headers
         * @returns {Web.Headers} Headers object
         */
        getHeaders() {
            return this[$headers];
        }

        /**
         * Headers property getter
         * @returns {Web.Headers} Headers object
         */
        get headers() {
            return this.getHeaders();
        }

        set headers(value) {
            this[$headers] = new Web.Headers(value);
        }

        /**
         * Gets response content as bytes
         * @returns {Array<number>} Byte array
         */
        getContent() {
            return this[$body]?.getBytes?.();
        }

        /**
         * Gets response as Uint8Array
         * @returns {Uint8Array} Byte array
         */
        bytes() {
            return new Uint8Array(this.getContent());
        }

        /**
         * Gets response as a specific type
         * @param {string} type - Target type
         * @returns {*} Converted response
         */
        getAs(type) {
            return this[$body]?.getAs?.(type);
        }

        /**
         * Gets response as Blob
         * @param {string} type - Optional type parameter
         * @returns {Web.Blob} Response blob
         */
        getBlob(type) {
            return this[$body];
        }

        /**
         * Gets response as Blob
         * @returns {Web.Blob} Response blob
         */
        blob() {
            return this.getBlob();
        }

        /**
         * Gets response content as text
         * @param {string} charset - Optional character set
         * @returns {string} Response text
         */
        getContentText(charset) {
            return charset ? this[$body]?.getDataAsString?.(charset) : this[$body]?.getDataAsString?.();
        }

        /**
         * Gets response as text
         * @returns {string} Response text
         */
        text() {
            return this.getContentText();
        }

        /**
         * Parses response as JSON
         * @returns {Object} Parsed JSON object
         */
        json() {
            return JSON.parse(this.getContentText());
        }

        /**
         * Gets HTTP response code
         * @returns {number} Status code
         */
        getResponseCode() {
            return this[$status];
        }

        /**
         * Gets HTTP status code
         * @returns {number} Status code
         */
        get status() {
            return this.getResponseCode();
        }

        set status(value) {
            return this[$status] = value;
        }

        /**
         * Gets HTTP status text
         * @returns {string} Status text
         */
        get statusText() {
            if (this.status == 200) {
                return 'OK';
            }
            return this[$statusText] || Str(this.status);
        }

        set statusText(value) {
            return this[$statusText] = value;
        }

        /**
         * Checks if response status indicates success (200-299)
         * @returns {boolean} True if status is in success range
         */
        get ok() {
            return this.status >= 200 && this.status < 300;
        }

        /**
         * Creates a clone of the response
         * 
         * WHY THIS EXISTS: Web API responses can only be read once. Cloning allows
         * you to read the same response multiple times, which is useful for caching,
         * logging, or processing the same response in different ways.
         * 
         * @returns {Web.Response} Cloned response
         */
        clone() {
            // Clone the body by getting bytes and creating new blob
            const bodyClone = this[$body] ? new Web.Blob(
                this[$body].getBytes(),
                this[$body].getContentType()
            ) : null;
            
            // Clone headers by creating new Headers from current ones
            const headersClone = new Web.Headers(this[$headers]);
            
            // Create new response with cloned data
            const cloned = new Web.Response(bodyClone, {
                status: this[$status],
                statusText: this[$statusText],
                headers: headersClone
            });
            
            return cloned;
        }

    };

    setProperty(Web, { Response });


    const canParseJSON = x =>{
        try {
            JSON.parse(x);
            return true; 
        } catch {
            return false;
        }
    };

    const canParseCSV = x =>{
        try {
            Utilities.parseCsv(x);
            return true;
        } catch {
            return false;
        }
    };

    const canCompileXML = x =>{
        try {
            XmlService.parse(x);
            return true;
        } catch {
            return false;
        }
    };

    const canCompile = x =>{
        try {
            new Function(x);
            return true;
        } catch {
            return false;
        }
    };

    /**
     * Web.ResponseEvent - Response wrapper for returning from doGet/doPost handlers
     * 
     * WHY THIS EXISTS: Google Apps Script web apps must return specific types from
     * doGet/doPost (like ContentService.createTextOutput or HtmlService output).
     * This class extends Web.Response and uses ContentService.createTextOutput to
     * create a response that can be returned directly from doGet/doPost while still
     * maintaining all Web.Response methods and properties.
     * 
     * This allows bidirectional compatibility: Web.Response can be used for outgoing
     * requests (with fetch), and ResponseEvent can be used for incoming request handlers.
     * 
     * Example usage:
     *   function doPost(e) {
     *     const request = new Web.RequestEvent(e);
     *     const data = request.json();
     *     const response = new Web.Response(JSON.stringify({ success: true }), {
     *       status: 200,
     *       headers: { 'Content-Type': 'application/json' }
     *     });
     *     return new Web.ResponseEvent(response);
     *   }
     */
    const ResponseEvent = class WebResponseEvent {

        /**
         * Creates a new ResponseEvent from a Web.Response
         * @param {Web.Response} response - A Web.Response object to wrap
         */
        constructor(response) {
            const bodyBlob = response.blob?.();
            const bodyText = bodyBlob?.text?.() || response.text?.() || '';
            const headers = response.headers ?? {};
            const contentTypeHeader = headers?.get?.('Content-Type') || headers?.['content-type'] || bodyBlob?.getContentType?.() || '';

            if (/xml|html/i.test(contentTypeHeader) || canCompileXML(bodyText)) {
                return HtmlService.createHtmlOutput(bodyText);
            }

            const output = ContentService.createTextOutput(bodyText);
            let mimeType;
            const mimeMap = ContentService.MimeType;
            
            const ct = contentTypeHeader.toLowerCase();
            if (ct) {
                for(const [key, value] of Object.entries(mimeMap)) {
                    if (ct.includes(key.toLowerCase())) {
                        mimeType = value;
                        break;
                    }
                }
                if(!mimeType && /script/i.test(ct)) {
                    mimeType = mimeMap.JAVASCRIPT;
                }
            }

            if (!mimeType && bodyText) {
                if (canParseJSON(bodyText)) mimeType = mimeMap.JSON;
                else if (canParseCSV(bodyText)) mimeType = mimeMap.CSV;
                else if (canCompile(bodyText)) mimeType = mimeMap.JAVASCRIPT;
            }

            output.setMimeType(mimeType || mimeMap.TEXT);
            
            if (output.getMimeType() === mimeMap.TEXT && contentTypeHeader && !ct.includes('text')) {
                try {
                    output.downloadAsFile(contentTypeHeader.split(';')[0].trim());
                } catch (e) {
                    console.warn('Could not set downloadAsFile for contentType:', contentTypeHeader, e);
                }
            }

            return output;
        }

    };

    setProperty(Web, { ResponseEvent });

    /**
     * Web.Request - HTTP Request object with Web API compatibility
     * Extends Google Apps Script's UrlFetchApp.getRequest
     * 
     * WHY EXTEND getRequest: This ties the APIs together and signals that instances
     * of Web.Request match or extend the type of object returned by getRequest().
     * It's primarily for type compatibility and showing the relationship between
     * our Request objects and what UrlFetchApp expects/returns.
     */
    const Request = class WebRequest {

        /**
         * Creates a new Request object
         * Supports three patterns:
         *   new Request(url)
         *   new Request(url, options)
         *   new Request(options) - where options.url contains the URL
         * 
         * @param {string|Object} url - Request URL or options object containing url
         * @param {Object} options - Request options (method, headers, body, etc.)
         */
        constructor(url, options = {}) {
            // Handle `new Request(options)` pattern where url is the options object
            if (typeof url === 'object' && url !== null) {
                options = url;
                url = options.url || '';
            }
            
            // Assign defaults and passed-in options
            const finalOptions = {
                method: 'GET', // Default method
                ...options,
            };

            // Sync 'body' and 'payload' properties for compatibility
            finalOptions.payload = finalOptions.body ?? finalOptions.payload;
            finalOptions.body = finalOptions.payload;

            // Assign all properties to `this`
            Object.assign(this, finalOptions);
            this.url = url;
            this.headers = new Web.Headers(finalOptions.headers);

            // Create a Blob from the body if it exists
            if (finalOptions.body) {
                this[$body] = new Web.Blob(finalOptions.body);
            }
            
            try {
                // Validate the final request object shape with UrlFetchApp.getRequest.
                UrlFetchApp.getRequest(this.url, this);
            } catch (e) {
                // Re-throw to signal an invalid Request
                throw new Error(`Failed to create a valid request: ${e.message}`);
            }
        }

        /**
         * Gets request body as Blob
         * @returns {Web.Blob} Request body
         */
        blob() {
            return this[$body];
        }

        /**
         * Gets request body as text
         * @returns {string} Request body text
         */
        text() {
            return this[$body].getDataAsString();
        }

        /**
         * Parses request body as JSON
         * @returns {Object} Parsed JSON
         */
        json() {
            return JSON.parse(this.getContentText());
        }

        /**
         * Gets request body as Uint8Array
         * @returns {Uint8Array} Byte array
         */
        bytes() {
            return new Uint8Array(this[$body].getBytes());
        }

        /**
         * Gets request body as ArrayBuffer
         * @returns {ArrayBuffer} Array buffer
         */
        arrayBuffer() {
            return new Uint8Array(this[$body].getBytes()).buffer;
        }

        /**
         * Creates a clone of the request
         * 
         * WHY THIS EXISTS: Web API requests can only be used once. Cloning allows
         * you to reuse the same request configuration for multiple fetch calls,
         * which is useful for retries, caching, or request interception patterns.
         * 
         * @returns {Web.Request} Cloned request
         */
        clone() {
            // Clone the body if present
            const bodyClone = this[$body] ? new Web.Blob(
                this[$body].getBytes(),
                this[$body].getContentType()
            ) : null;
            
            // Build options object from current request
            const options = {
                method: this.method,
                headers: new Web.Headers(this.headers),
                body: bodyClone
            };
            
            // Copy any additional properties from the original request
            for (const key in this) {
                if (!['url', 'method', 'headers', 'body'].includes(key) && 
                    !key.startsWith('Symbol(')) {
                    options[key] = this[key];
                }
            }
            
            // Create and return new request
            return new Web.Request(this.url, options);
        }

    };

    setProperty(Web, { Request });

    /**
     * Default options for fetch requests
     * 
     * WHY THESE DEFAULTS:
     * - validateHttpsCertificates: false - Many internal APIs and development
     *   servers use self-signed certs. Defaulting to false matches browser
     *   behavior for local development and prevents common errors.
     * 
     * - muteHttpExceptions: true - Web fetch() doesn't throw on HTTP errors
     *   (like 404, 500), it returns a Response with response.ok = false.
     *   We match this behavior by muting exceptions and returning error responses.
     * 
     * - escaping: false - Prevents UrlFetchApp from double-encoding URLs,
     *   which is unexpected behavior for developers familiar with fetch().
     */
    const defaultOptions = {
        validateHttpsCertificates: false,
        muteHttpExceptions: true,
        escaping: false,
    };

    /**
     * Web.fetch - Fetch API implementation using Google's UrlFetchApp
     * Makes HTTP requests with Web-standard API
     * 
     * WHY setPrototypeOf WITH UrlFetchApp.fetch: This links our fetch function's
     * prototype chain to UrlFetchApp.fetch, establishing type compatibility and
     * signaling that Web.fetch is an enhanced version of the underlying API.
     * Similar to Request extending getRequest - it's about API relationship.
     * 
     * @param {string} url - URL to fetch
     * @param {Object} options - Request options
     * @returns {Web.Response} Response object
     */
    const fetch = Object.setPrototypeOf(function WebFetch(url, options) {
        // Merge default options with provided options
        const requestOptions = {
            ...defaultOptions,
            ...options ?? {}
        };
        
        // Create request object (for consistency)
        const request = new Web.Request(url, requestOptions);
        
        try {
            // Perform the fetch using Google's UrlFetchApp
            const response = UrlFetchApp.fetch(Str(url), requestOptions);
            const status = response.getResponseCode();
            
            // Check for error status codes if exceptions are not muted
            if (requestOptions.muteHttpExceptions == false && (status >= 400 || status <= 0 || !status)) {
                throw new Error(`Fetch error ${Str(status)}`);
            }
            
            // Return response with Web.Response prototype
            // WHY SETPROTOTYPEOF: UrlFetchApp.fetch() returns a Google HTTPResponse
            // object. Rather than wrapping it, we augment it by changing its prototype
            // to Web.Response. This gives it all our Web API methods (.json(), .text(),
            // etc.) while preserving its internal Google properties. It's both a valid
            // HTTPResponse AND a valid Web.Response.
            return Object.setPrototypeOf(response, Web.Response.prototype);
        } catch (e) {
            // Handle errors
            if (requestOptions.muteHttpExceptions == false) {
                throw e;
            }
            
            // Return error response
            return new Web.Response(`500 ${Str(e)}`, {
                status: 500,
                statusText: Str(e)
            });
        }
    }, UrlFetchApp.fetch);

    setProperty(Web, { fetch });

    /**
     * Default event object structure for web requests
     * 
     * This mirrors the shape of the event object that Google Apps Script passes
     * to doGet(e) and doPost(e) functions when a web app receives an HTTP request.
     * 
     * See: https://developers.google.com/apps-script/guides/web#request_parameters
     */
    const defaultEvent = {
        queryString: '',      // The query string portion of the URL (e.g., "?name=value&foo=bar")
        parameter: {},        // Object with query/POST parameters as key-value pairs (first value if multiple)
        parameters: {},       // Object with query/POST parameters as key-array pairs (all values)
        pathInfo: '',         // Path after the web app URL (e.g., "/path/to/resource")
        contextPath: '',      // Not currently used but part of the event structure
        postData: {           // Present only for POST requests
            contents: '',     // Request body as string
            length: 0,        // Length of request body
            type: 'text/plain', // Content-Type of request
            name: 'postData'
        },
        contentLength: 0      // HTTP Content-Length header value
    };

    /**
     * Web.RequestEvent - Represents the event object passed to doGet(e) and doPost(e)
     * 
     * WHY THIS EXISTS: When you create a Google Apps Script web app and deploy it,
     * Google calls your doGet(e) or doPost(e) function with an event object containing
     * the request details. This class extends Web.Request to provide a typed wrapper
     * around that event object with Web API compatibility.
     * 
     * WHY EXTEND REQUEST: By extending Web.Request, RequestEvent gains all the Web API
     * methods (.text(), .json(), .blob(), etc.) that pull data from the event's postData
     * and parameters, making incoming requests work like outgoing Request objects.
     * 
     * Example usage:
     *   function doGet(e) {
     *     const event = new Web.RequestEvent(e);
     *     const userId = event.parameter.userId;
     *     const bodyText = event.text(); // Gets postData.contents
     *     return ContentService.createTextOutput(JSON.stringify(event.parameters));
     *   }
     */
    const RequestEvent = class WebRequestEvent {

        /**
         * Creates a new RequestEvent from a doGet/doPost event object
         * @param {Object} e - Event object passed to doGet(e) or doPost(e)
         */
        constructor(e = {}) {
            const eventData = { ...defaultEvent, ...e };
            
            let baseUrl = '';
            try {
                baseUrl = ScriptApp.getService().getUrl();
            } catch (_) {
                baseUrl = 'https://mock.script.url';
            }
            
            const url = baseUrl + (eventData.pathInfo || '') +
                (eventData.queryString ? '?' + eventData.queryString : '');
            
            const headers = new Web.Headers();
            if (eventData.postData?.type) headers.set('Content-Type', eventData.postData.type);
            if (eventData.contentLength) headers.set('Content-Length', String(eventData.contentLength));

            const method = eventData.postData?.contents ? 'POST' : 'GET';
            
            // Create a Request instance and copy properties to `this`
            const request = new Web.Request(url, {
                method: method,
                headers: headers,
                body: eventData.postData?.contents || ''
            });
            
            Object.assign(this, request);
            Object.assign(this, eventData);
        }

        /**
         * Gets request body as text from postData.contents
         * @returns {string} Request body text
         */
        text() {
            return this.postData?.contents || '';
        }

        /**
         * Parses request body as JSON from postData.contents
         * @returns {Object} Parsed JSON
         */
        json() {
            const content = this.postData?.contents || '{}';
            return JSON.parse(content);
        }

        /**
         * Gets request body as Blob from postData.contents
         * @returns {Web.Blob} Request body as Blob
         */
        blob() {
            const content = this.postData?.contents || '';
            const type = this.postData?.type || 'text/plain';
            return new Web.Blob(content, type);
        }

        /**
         * Gets request body as Uint8Array from postData.contents
         * @returns {Uint8Array} Byte array
         */
        bytes() {
            const content = this.postData?.contents || '';
            return new Uint8Array(Utilities.newBlob(content).getBytes());
        }

        /**
         * Gets request body as ArrayBuffer from postData.contents
         * @returns {ArrayBuffer} Array buffer
         */
        arrayBuffer() {
            return this.bytes().buffer;
        }

    };

    setProperty(Web, { RequestEvent });

    /**
     * Web.do - Universal handler wrapper for doGet/doPost
     * 
     * WHY THIS EXISTS: This function allows you to write a single handler that works
     * for both doGet() and doPost() while automatically handling request/response
     * conversion. It takes a request (raw event or RequestEvent), processes it through
     * your handler function, and returns a properly formatted response that Google
     * Apps Script can return from doGet/doPost.
     * 
     * This eliminates boilerplate and ensures consistent request/response handling.
     * 
     * Example usage:
     *   function doGet(e) { return Web.do(e); }
     *   function doPost(e) { return Web.do(e); }
     * 
     *   Or with a custom handler:
     *   function doGet(e) { 
     *     return Web.do(e, (request) => {
     *       const data = request.json();
     *       return new Web.Response(JSON.stringify({ received: data }), {
     *         headers: { 'Content-Type': 'application/json' }
     *       });
     *     });
     *   }
     * 
     * @param {Object|Web.RequestEvent} request - Raw event object or RequestEvent
     * @param {Function} handler - Optional handler function that receives RequestEvent and returns Response
     * @returns {ContentService.TextOutput|HtmlService.HtmlOutput} Formatted output for Apps Script
     */
    const WebDo = function WebDo(request, handler) {
        try {
            // Convert to RequestEvent if not already
            const req = instanceOf(request,Web.RequestEvent)
                ? request 
                : new Web.RequestEvent(request);
            
            // If handler provided, call it and wrap response
            if (handler && typeof handler === 'function') {
                const response = handler(req);
                
                // If response is already a ResponseEvent, return it
                if (instanceOf(response, Web.ResponseEvent)) {
                    return response;
                }
                
                // If response is a Web.Response, wrap it
                if (instanceOf(response, Web.Response)) {
                    return new Web.ResponseEvent(response);
                }
                
                // If response is already a ContentService/HtmlService output, return as-is
                if (response?.getContent || response?.getAs) {
                    return response;
                }
                
                // Otherwise, create a response from the returned value
                return new Web.ResponseEvent(new Web.Response(response, {
                    headers: { 'Content-Type': 'text/plain' }
                }));
            }
            
            // No handler provided - return a default response with request info
            const defaultResponse = new Web.Response(JSON.stringify({
                method: req.method,
                url: req.url,
                parameters: req.parameters,
                message: 'No handler provided to Web.do()'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            
            return new Web.ResponseEvent(defaultResponse);
            
        } catch (error) {
            // Error handling - return error response
            const errorResponse = new Web.Response(JSON.stringify({
                error: Str(error),
                message: error.message || 'An error occurred',
                stack: error.stack
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
            
            return new Web.ResponseEvent(errorResponse);
        }
    };

    setProperty(Web, { do: WebDo });

})();
