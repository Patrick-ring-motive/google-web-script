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
    const isBuffer = x => instanceOf(x, ArrayBuffer) || x?.constructor?.name == 'ArrayBuffer';
    const isArray = x => Array.isArray(x) || instanceOf(x, Array) || x?.constructor?.name == 'Array';
    const isString = x => typeof x === 'string' || instanceOf(x, String) || x?.constructor?.name == 'String';

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

    const blobArgs = (args) => {
        while (args.length > 0 && args[args.length - 1] === undefined) {
            args.pop();
        }
        if(!args[0])args = [];
        return args;
    }

    const Blob = class WebBlob extends Utilities.newBlob {

        /**
         * Creates a new Blob object
         * @param {Array|string|ArrayBuffer} parts - Data to include in the blob
         * @param {string} type - MIME type
         * @param {string} name - Optional name for the blob
         */
        constructor(parts = [], type, name) {
            // Extract type from various sources
            try{
            type = type?.type ?? type ?? parts?.type ?? parts?.getContentType?.();

            // Empty blob
            if (!len(parts)) {
                return Object.setPrototypeOf(super(...blobArgs([parts, type, name])), Web.Blob.prototype);
            }
            
            // String blob
            if (isString(parts)) {
                return Object.setPrototypeOf(super(...blobArgs([parts, type, name])), Web.Blob.prototype);
            }
            
            // Convert to bytes and create blob
                return Object.setPrototypeOf(super(...blobArgs([toBits(parts), type, name])), Web.Blob.prototype);
            }   catch(e){
                return Object.setPrototypeOf(super(parts), Web.Blob.prototype);
            }
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

        /**
         * Creates a new Headers object
         * @param {Object|Array} entries - Initial headers as object or array of [key, value] pairs
         */
        constructor(entries) {
            if (!entries) return this;
            
            try {
                // Try to iterate as array of entries
                for (const [key, value] of entries) {
                    this.append(key, value);
                }
                return this;
            } catch (_) {
                // Fall back to object iteration
                for (const key in entries) {
                    this.append(key, entries[key]);
                }
                return Object.setPrototypeOf(this, Web.Headers.prototype);
            }
        }

        /**
         * Gets the number of headers
         * @returns {number} Number of headers
         */
        get size() {
            return Object.keys(this).length;
        }

        /**
         * Deletes a header (case-insensitive)
         * @param {string} key - Header name to delete
         */
        delete(key) {
            if (!key) return;
            key = Str(key).toLowerCase();
            for (const k in this) {
                if (Str(k).toLowerCase() === key) {
                    delete this[k];
                }
            }
        }

        /**
         * Sets a header value, replacing any existing value (case-insensitive)
         * @param {string} key - Header name
         * @param {string} value - Header value
         */
        set(key, value) {
            // Validate header before setting
            if (!isValidHeader(key, value)) {
                return; // Skip invalid headers silently
            }
            this.delete(key);
            this[String(key).toLowerCase()] = value;
        }

        /**
         * Gets a header value (case-insensitive)
         * @param {string} key - Header name
         * @returns {string|undefined} Header value
         */
        get(key) {
            if (this[key]) return this[key];
            key = Str(key).toLowerCase();
            for (const k in this) {
                if (Str(k).toLowerCase() === key) {
                    return this[k];
                }
            }
        }

        /**
         * Gets all Set-Cookie headers
         * @returns {Array<string>} Array of Set-Cookie values
         */
        getSetCookie() {
            const cookies = [];
            for (const key in this) {
                if (Str(key).toLowerCase() === 'set-cookie') {
                    cookies.push(this[key]);
                }
            }
            return cookies;
        }

        /**
         * Gets all values for a header
         * Special handling for cookies, otherwise splits comma-separated values
         * @param {string} head - Header name
         * @returns {Array<string>} Array of header values
         */
        getAll(head) {
            head = Str(head).toLowerCase();

            // Special handling for cookies
            if (/^(set-)?cookie$/.test(head)) {
                const cookies = [];
                for (const key in this) {
                    if (Str(key).toLowerCase() === head) {
                        cookies.push(this[key]);
                    }
                }
                return cookies;
            }

            // Regular headers - split by comma
            const value = this.get(head);
            if (value == undefined) return [];
            return Str(value).split(',').map(x => x.trim());
        }

        /**
         * Checks if a header exists (case-insensitive)
         * @param {string} key - Header name
         * @returns {boolean} True if header exists
         */
        has(key) {
            if (this[key] != undefined) return true;
            key = Str(key).toLowerCase();
            for (const k in this) {
                if (Str(k).toLowerCase() === key && this[k] != undefined) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Appends a value to a header
         * Cookies get unique keys, other headers get comma-separated values
         *
         * WHY RANDOM CASING FOR COOKIES: HTTP allows multiple Set-Cookie headers
         * in a response, but JavaScript objects can't have duplicate keys. The
         * solution: store each cookie with a uniquely-cased version of the key
         * (like 'set-cookie', 'Set-Cookie', 'sET-cOOKIE'). Since our get() method
         * is case-insensitive, all variants match when retrieved, but each can
         * store a different cookie value in the object.
         *
         * @param {string} key - Header name
         * @param {string} value - Header value to append
         */
        append(key, value) {
            // Validate header before appending
            if (!isValidHeader(key, value)) {
                return; // Skip invalid headers silently
            }
            
            key = Str(key).toLowerCase();

            // Special handling for cookies - each cookie gets a unique key with random casing
            if (/^(set-)?cookie$/.test(key)) {
                while (this[key] != undefined) {
                    // Randomly change case of characters to create unique key
                    key = key.replace(/./g, x => x[`to${Math.random() > .5 ? 'Upp' : 'Low'}erCase`]());
                }
                this[key] = value;
            } else {
                // Regular headers - append with comma separator
                if (this[key] == undefined) {
                    this[key] = value;
                } else {
                    this[key] = `${Str(this[key])}, ${Str(value)}`;
                }
            }
        }

        /**
         * Returns an iterator of [key, value] pairs
         * @returns {Iterator} Header entries iterator
         */
        entries() {
            return Object.entries(this).values();
        }

        /**
         * Makes the object iterable
         * @returns {Iterator} Header entries iterator
         */
        [Symbol.iterator]() {
            return this.entries();
        }

        /**
         * Returns an iterator of header names
         * @returns {Iterator} Header keys iterator
         */
        keys() {
            return Object.keys(this).values();
        }

        /**
         * Returns an iterator of header values
         * @returns {Iterator} Header values iterator
         */
        values() {
            return Object.values(this).values();
        }

        /**
         * Executes a callback for each header
         * @param {Function} callback - Function to execute for each entry
         * @param {*} thisArg - Value to use as 'this' when executing callback
         */
        forEach(callback, thisArg) {
            for (const key in this) {
                callback.call(thisArg, this[key], key, this);
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
    const Response = class WebResponse extends ContentService.createTextOutput{

        /**
         * Creates a new Response object
         * @param {*} body - Response body
         * @param {Object} options - Response options (status, statusText, headers)
         */
        constructor(body, options = {}) {;
            super(body);
            Object.assign(this, options);
            this[$headers] = new Web.Headers(this.headers);
            this[$status] = options.status ?? 200;
            this[$statusText] = options.statusText ?? 'OK';
            
            // Handle body with error catching
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
            return Object.setPrototypeOf(this, Web.Response.prototype) ;
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
            // Try to call native getAllHeaders first (when this is an augmented HTTPResponse)
            let nativeHeaders;
            try {
                // Call the native method from the prototype chain
                const proto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                if (proto?.getAllHeaders) {
                    nativeHeaders = proto.getAllHeaders.call(this);
                }
            } catch (_) {
                // No native method available, use our stored headers
            }

            // Use native headers if available, otherwise use our stored headers
            const headers = nativeHeaders || this[$headers] || {};

            // Build result object with cookies as arrays
            const result = {};
            const cookieKeys = [];

            // First pass: collect all keys and identify cookie keys
            for (const key in headers) {
                const lowerKey = Str(key).toLowerCase();
                if (/^(set-)?cookie$/.test(lowerKey)) {
                    cookieKeys.push(key);
                } else {
                    // For non-cookie headers, just copy the value
                    result[key] = headers[key];
                }
            }

            // Second pass: group cookies by their normalized name
            const cookieGroups = {};
            for (const key of cookieKeys) {
                const lowerKey = Str(key).toLowerCase();
                if (!cookieGroups[lowerKey]) {
                    cookieGroups[lowerKey] = [];
                }
                // Handle case where cookies might already be an array from native method
                const value = headers[key];
                if (isArray(value)) {
                    cookieGroups[lowerKey].push(...value);
                } else {
                    cookieGroups[lowerKey].push(value);
                }
            }

            // Add cookie arrays to result using the first key's casing we found
            for (const key of cookieKeys) {
                const lowerKey = Str(key).toLowerCase();
                if (cookieGroups[lowerKey]) {
                    result[key] = cookieGroups[lowerKey];
                    delete cookieGroups[lowerKey]; // Prevent duplicates
                }
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
    const ResponseEvent = class WebResponseEvent extends Web.Response {

        /**
         * Creates a new ResponseEvent from a Web.Response
         * @param {Web.Response} response - A Web.Response object to wrap
         */
        constructor(response) {
            // Extract data from the response
            const bodyBlob = response.blob?.();
            const bodyText = bodyBlob?.text?.() || response.text?.() || '';
            const status = response.status;
            const statusText = response.statusText;
            const headers = response.headers ?? {};

            // Call parent constructor with text, not blob
            super(bodyText, { status, statusText, headers });

            // Create ContentService output with the body text
            let output = this

            // Determine content type from header or infer from body content
            let contentType = headers?.get?.('Content-Type') || headers?.['content-type'] || bodyBlob?.getContentType?.();
            let mimeType;
            // If no content-type header, try to infer from body content
            if (!contentType) {
                if (canParseJSON(bodyText)) {
                    contentType = 'application/json';
                    mimeType = ContentService.MimeType.JSON;
                } else if (canCompileXML(bodyText)) {
                    contentType = 'text/xml';
                    // Will be handled later for HTML output
                } else if (canParseCSV(bodyText)) {
                    contentType = 'text/csv';
                    mimeType = ContentService.MimeType.CSV;
                } else if (canCompile(bodyText)) {
                    contentType = 'application/javascript';
                    mimeType = ContentService.MimeType.JAVASCRIPT;
                } else {
                    contentType = 'text/plain';
                    mimeType = ContentService.MimeType.TEXT;
                }
            }
            
            // Match content type to ContentService.MimeType enum
            if (!mimeType) {
                const ct = Str(contentType).toLowerCase();
                for(const [key, value] of Object.entries(ContentService.MimeType)) {
                    if (ct.includes(Str(key).toLowerCase())) {
                        mimeType = value;
                    }
                }
            }

            // Special handling for script content types
            if(!mimeType && /script/i.test(contentType)) {
                mimeType = ContentService.MimeType.JAVASCRIPT;
            }

            // Try to infer from body if still no mime type
            if(((ContentService.MimeType.TEXT == mimeType) || !mimeType) && bodyText){
                if(canParseJSON(bodyText)){
                    mimeType = ContentService.MimeType.JSON;
                }else if(canCompile(bodyText)){
                    mimeType = ContentService.MimeType.JAVASCRIPT;
                }else if(canParseCSV(bodyText)){
                    mimeType = ContentService.MimeType.CSV;
                }
            }
            
            // Set the mime type or fall back to downloadAsFile
            if(mimeType){
                output.setMimeType(mimeType);
            } else if (contentType) {
                try{
                    output.downloadAsFile(contentType);
                }catch(e){
                    console.warn('Could not set downloadAsFile for contentType:', contentType, e);
                }
                output.setMimeType(ContentService.MimeType.TEXT);
            }

            // Use HtmlService for XML/HTML content
            if(canCompileXML(bodyText) || /xml|html/i.test(contentType)){
                output = HtmlService.createHtmlOutput(bodyText);
            }

            return Object.setPrototypeOf(this, Web.ResponseEvent.prototype) ;
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
    const Request = class WebRequest extends UrlFetchApp.getRequest {

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
            let $this;

            // Handle new Request(options) pattern where url is actually the options object
            if (typeof url === 'object' && url !== null && !options) {
                options = url;
                url = options.url || '';
            }
            
            // Default to GET method
            options.method = options.method ?? 'GET';

            // Support both 'body' and 'payload' options
            // WHY BOTH: Web APIs use 'body' for request data, but UrlFetchApp uses
            // 'payload'. We support both names and sync them so developers can use
            // familiar Web API terminology while still working with Google's API.
            // This makes migration easier and code more readable.
            if (options?.body && !options?.payload) {
                options.payload = options.body;
            }
            if (options?.payload && !options?.body) {
                options.body = options.payload;
            }
            
            try {
                $this = super(...arguments);
                $this.url = url;
                Object.assign($this, options ?? {});
                $this.headers = new Web.Headers(options.headers);

                if (options?.body) {
                    $this[$body] = new Web.Blob(options.body);
                }
            } catch (e) {
                // Error handling - create error request
                // WHY 'https://Request.Error': This preserves the Request object shape
                // without throwing, allowing error inspection. The URL pattern signals
                // an error state while maintaining a valid Request structure.
                $this = super('https://Request.Error', {
                    body: Str(e)
                });
                $this[$body] = new Web.Blob(Str(e));
                setProperty($this, { body: $this[$body] });
                throw e;
            }

            return Object.setPrototypeOf($this, Web.Request.prototype);
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
    const RequestEvent = class WebRequestEvent extends Web.Request {

        /**
         * Creates a new RequestEvent from a doGet/doPost event object
         * @param {Object} e - Event object passed to doGet(e) or doPost(e)
         */
        constructor(e = {}) {
            // Merge with defaults
            const eventData = {
                ...defaultEvent,
                ...e
            };
            
            // Build complete URL using ScriptApp.getService().getUrl() as base
            let baseUrl = '';
            try {
                baseUrl = ScriptApp.getService().getUrl();
            } catch (_) {
                // ScriptApp not available or not a web app
                baseUrl = '';
            }
            
            const url = baseUrl + eventData.pathInfo +
                (eventData.queryString ? '?' + eventData.queryString : '');
            
            // Build headers from event data and ScriptApp properties using Web.Headers
            // This ensures all headers are validated via isValidHeader before being set
            const headers = new Web.Headers();

            // Content headers
            if (eventData.postData?.type) {
                headers.set('Content-Type', eventData.postData.type);
            }
            if (eventData.contentLength || eventData.postData?.length) {
                headers.set('Content-Length', Str(eventData.contentLength || eventData.postData.length));
            }
            if (eventData.postData?.name) {
                headers.set('Content-Name', eventData.postData.name);
            }

            // ScriptApp metadata headers (safe access in case not available)
            try {
                headers.set('X-ScriptApp-AuthMode', Str(eventData.authMode ?? ScriptApp.AuthMode));
                headers.set('X-ScriptApp-AuthorizationStatus', Str(eventData.authorizationStatus ?? ScriptApp.AuthorizationStatus));
                headers.set('X-ScriptApp-EventType', Str(eventData.triggerSource ?? ScriptApp.TriggerSource));
                headers.set('X-ScriptApp-WeekDay', Str(eventData.weekDay ?? ScriptApp.WeekDay));
                if (ScriptApp.InstallationSource) {
                    headers.set('X-ScriptApp-InstallationSource', Str(ScriptApp.InstallationSource));
                }
                // Get authorization info if authMode is available

                try {
                    const authInfo = ScriptApp.getAuthorizationInfo(eventData.authMode ?? ScriptApp.AuthMode);
                    if (authInfo) {
                        headers.set('X-ScriptApp-AuthorizationInfo', Str(authInfo.getAuthorizationStatus()));
                    }
                } catch (_) {
                    // Authorization info not available
                }

            } catch (_) {
                // ScriptApp metadata not available
            }

            // Determine method (POST if postData exists, otherwise GET)
            const method = eventData.postData?.contents ? 'POST' : 'GET';
            
            // Call parent constructor with synthesized request data
            super(url || '/', {
                method: method,
                headers: headers,
                body: eventData.postData?.contents || ''
            });
            
            // Add all event properties to this instance
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
