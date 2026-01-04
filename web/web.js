
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
     * HTTP Status Code to Status Text mapping
     * Comprehensive list of status codes and their text descriptions
     * 
     * Priority order for conflicts:
     * 1. Official HTTP status codes (RFC 7231, etc.)
     * 2. Unofficial/extension HTTP status codes
     * 3. Vendor-specific codes (FTP, etc.)
     * 
     * When a status code appears in multiple standards, the higher priority
     * definition is used (e.g., HTTP 500 "Internal Server Error" takes
     * precedence over FTP 500 "Syntax error, command unrecognized")
     */
    const statusCodeMap = {
        // 1xx Informational
        100: "Continue",
        101: "Switching Protocols",
        102: "Processing",
        103: "Early Hints",
        
        // 2xx Success
        200: "OK",
        201: "Created",
        202: "Accepted",
        203: "Non-Authoritative Information",
        204: "No Content",
        205: "Reset Content",
        206: "Partial Content",
        207: "Multi-Status",
        208: "Already Reported",
        226: "IM Used",
        
        // 3xx Redirection
        300: "Multiple Choices",
        301: "Moved Permanently",
        302: "Found",
        303: "See Other",
        304: "Not Modified",
        305: "Use Proxy",
        306: "Switch Proxy",
        307: "Temporary Redirect",
        308: "Permanent Redirect",
        
        // 4xx Client Errors
        400: "Bad Request",
        401: "Unauthorized",
        402: "Payment Required",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        406: "Not Acceptable",
        407: "Proxy Authentication Required",
        408: "Request Timeout",
        409: "Conflict",
        410: "Gone",
        411: "Length Required",
        412: "Precondition Failed",
        413: "Payload Too Large",
        414: "URI Too Long",
        415: "Unsupported Media Type",
        416: "Range Not Satisfiable",
        417: "Expectation Failed",
        418: "I'm a teapot",
        421: "Misdirected Request",
        422: "Unprocessable Entity",
        423: "Locked",
        424: "Failed Dependency",
        425: "Too Early",
        426: "Upgrade Required",
        428: "Precondition Required",
        429: "Too Many Requests",
        431: "Request Header Fields Too Large",
        451: "Unavailable For Legal Reasons",
        
        // 5xx Server Errors
        500: "Internal Server Error",
        501: "Not Implemented",
        502: "Bad Gateway",
        503: "Service Unavailable",
        504: "Gateway Timeout",
        505: "HTTP Version Not Supported",
        506: "Variant Also Negotiates",
        507: "Insufficient Storage",
        508: "Loop Detected",
        510: "Not Extended",
        511: "Network Authentication Required",
        
        // FTP Status Codes (non-conflicting with HTTP)
        110: "Restart marker reply",
        120: "Service ready in nnn minutes",
        125: "Data connection already open; transfer starting",
        150: "File status okay; about to open data connection",
        211: "System status, or system help reply",
        212: "Directory status",
        213: "File status",
        214: "Help message",
        215: "NAME system type",
        220: "Service ready for new user",
        221: "Service closing control connection",
        225: "Data connection open; no transfer in progress",
        227: "Entering Passive Mode",
        230: "User logged in, proceed",
        250: "Requested file action okay, completed",
        257: "PATHNAME created",
        331: "User name okay, need password",
        332: "Need account for login",
        350: "Requested file action pending further information",
        450: "Requested file action not taken",
        452: "Requested action not taken, Insufficient storage space in system",
        530: "Not logged in",
        532: "Need account for storing files",
        533: "Command protection level denied for policy reasons",
        534: "Request denied for policy reasons",
        535: "Failed security check",
        536: "Data protection level not supported by security mechanism",
        537: "Command protection level not supported by security mechanism",
        550: "Requested action not taken, File unavailable",
        551: "Requested action aborted, Page type unknown",
        552: "Requested file action aborted, Exceeded storage allocation",
        553: "Requested action not taken, File name not allowed",
        631: "Integrity protected reply",
        632: "Confidentiality and integrity protected reply",
        633: "Confidentiality protected reply"
    };

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
            writeable: false, // for my own sanity
            writable: false
        });
    };

    /**
     * Helper to define hidden (non-enumerable) properties
     * Used for non-spec extensions and internal properties that shouldn't be enumerable
     * @param {Object} obj - Object to define property on
     * @param {string} prop - Property name (should include '&' prefix for hidden properties)
     * @param {*} value - Property value
     */
    const setHidden = (obj, prop, value) => {
        Object.defineProperty(obj, prop, {
            value,
            writeable:true,
            writable: true,
            enumerable: false,
            configurable: true
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
     * Handles strings, ArrayBuffers, Uint8Arrays, FormData, and objects with getBytes() methods
     * 
     * WHY SO COMPLEX: This function bridges the gap between Web APIs (which use
     * ArrayBuffer/Uint8Array) and Google Apps Script (which uses byte arrays from
     * Utilities.newBlob). It needs to handle:
     * - Web standard types (ArrayBuffer, Uint8Array)
     * - Google Apps Script Blobs (with getBytes())
     * - FormData (via &toBlob method)
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
        // Handle FormData by converting to multipart blob first
        if (instanceOf(x, Web.FormData) || x?.constructor?.name == 'FormData') {
            return Web.FormData.prototype['&toBlob'].call(x).getBytes();
        }
        // Handle ReadableStream by reading all chunks
        if (instanceOf(x, Web.ReadableStream) || x?.constructor?.name == 'ReadableStream') {
            const chunks = [];
            for (const chunk of x) {
                chunks.push(toBits(chunk));
            }
            return chunks.flat();
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
        if(!args[2])args = args.slice(0,2);
        if(!args[1])args = args.slice(0,1);
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

        /**
         * Returns a ReadableStream that provides access to the blob's data
         * @returns {Web.ReadableStream} Stream of blob data
         */
        stream() {
            const bytes = this.getBytes();
            return new Web.ReadableStream({
                start(controller) {
                    // Enqueue the entire blob as a single chunk
                    // For a real streaming implementation, this would chunk the data
                    controller.enqueue(new Uint8Array(bytes));
                    controller.close();
                }
            });
        }

        /**
         * Makes Blob iterable with for...of loops by delegating to its stream
         * @returns {Iterator} Iterator of blob chunks
         */
        [Symbol.iterator]() {
            return this.stream()[Symbol.iterator]();
        }

    };

    setProperty(Web, { Blob });

    /**
     * Web.File - File class implementation for Google Apps Script
     * 
     * Provides a File class for environments that lack it. The File class
     * extends Blob and adds file-specific properties:
     * - name: The file name
     * - lastModified: Timestamp in milliseconds
     * - lastModifiedDate: Date object (deprecated but included for compatibility)
     * - webkitRelativePath: Empty string (for compatibility)
     * 
     * This allows File objects to be created and used in Google Apps Script
     * where the native File constructor is missing.
     */
    const File = class WebFile extends Web.Blob {
        
        /**
         * Creates a new File object
         * @param {Array} bits - Array of data parts (strings, ArrayBuffers, Blobs, etc.)
         * @param {string} filename - Name of the file
         * @param {Object} options - File options (type, lastModified, etc.)
         */
        constructor(bits, filename, options = {}) {
            // Extract File-specific options
            const {
                lastModified = Date.now(),
                ...blobOptions
            } = options;

            // Call Blob constructor with bits and blob options
            super(bits, blobOptions.type);

            // Add File-specific properties as hidden properties
            setHidden(this, '&name', filename);
            setHidden(this, '&lastModified', lastModified);
            setHidden(this, '&lastModifiedDate', new Date(lastModified));
        }

        /**
         * Gets the file name
         * @returns {string} File name
         */
        get name() {
            return this['&name'];
        }

        /**
         * Gets the last modified timestamp
         * @returns {number} Last modified time in milliseconds since epoch
         */
        get lastModified() {
            return this['&lastModified'];
        }

        /**
         * Gets the last modified date
         * @returns {Date} Last modified date (deprecated but included for compatibility)
         */
        get lastModifiedDate() {
            return this['&lastModifiedDate'];
        }

        /**
         * Gets the webkit relative path
         * @returns {string} Always returns empty string for compatibility
         */
        get webkitRelativePath() {
            return '';
        }
    };

    setProperty(Web, { File });

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

    /**
     * Web.FormData - FormData API implementation for Google Apps Script
     * 
     * WHY THIS EXISTS: Provides a standard Web API for constructing form data
     * that can be sent via UrlFetchApp. Unlike browser FormData which works
     * with File/Blob objects asynchronously, this implementation is synchronous
     * and designed to work with Google Apps Script's Utilities.newBlob.
     * 
     * DESIGN PATTERNS:
     * - Uses Symbol-based private storage ($entries) like other classes in this library
     * - Stores entries as array of [name, value] tuples where value can be string or Web.Blob
     * - Supports iteration (entries, keys, values, forEach, Symbol.iterator)
     * - Provides boundary-based multipart/form-data serialization
     * 
     * INTEGRATION:
     * - Works seamlessly with Web.Blob for file uploads
     * - Can be serialized to multipart/form-data blob for use with UrlFetchApp
     * - Supports both string values and blob/file values
     */

    // Private symbol for FormData internal storage
    const $entries = Symbol('*entries');

    const FormData = class WebFormData {

        /**
         * Creates a new FormData object
         * 
         * Note: Unlike browser FormData, we don't support constructing from HTML forms
         * since Google Apps Script doesn't have DOM access
         * @param {string|Object|Array|URLSearchParams} init - Optional initial data
         */
        constructor(init) {
            this[$entries] = [];
            if (init) {
                const params = new Web.URLSearchParams(init);
                for (const [key, value] of params) {
                    this.append(key, value);
                }
            }
        }

        /**
         * Appends a new value to an existing key, or adds the key if it doesn't exist
         * 
         * @param {string} name - Field name
         * @param {string|Blob|Web.Blob} value - Field value (string or blob)
         * @param {string} filename - Optional filename for blob values
         */
        append(name, value, filename) {
            // Validate arguments
            if (arguments.length < 2) {
                throw new TypeError(`${2} argument required, but only ${arguments.length} present.`);
            }

            // Normalize the name to string
            name = Str(name);

            // Handle Blob/File values
            if (value && (instanceOf(value, Web.Blob) || value?.getBytes)) {
                // Determine filename
                filename = filename !== undefined
                    ? Str(filename)
                    : isString(value.name)
                        ? value.name
                        : 'blob';

                // Ensure we have a Web.Blob with the correct name
                if (!instanceOf(value,Web.Blob)) {
                    value = new Web.Blob(value);
                }

                // Store as [name, blob, filename] tuple
                this[$entries].push([name, value, filename]);
            } else {
                // Store string value as [name, stringValue] tuple
                this[$entries].push([name, Str(value)]);
            }
        }

        /**
         * Deletes all values associated with a key
         * 
         * @param {string} name - Field name to delete
         */
        delete(name) {
            if (arguments.length < 1) {
                throw new TypeError(`${1} argument required, but only ${arguments.length} present.`);
            }

            name = Str(name);
            this[$entries] = this[$entries].filter(entry => entry[0] !== name);
        }

        /**
         * Returns the first value associated with a key
         * 
         * @param {string} name - Field name
         * @returns {string|File|null} First value or null if not found
         */
        get(name) {
            if (arguments.length < 1) {
                throw new TypeError(`${1} argument required, but only ${arguments.length} present.`);
            }

            name = Str(name);
            for (const entry of this[$entries]) {
                if (entry[0] === name) {
                    return entry[1];
                }
            }
            return null;
        }

        /**
         * Returns all values associated with a key
         * 
         * @param {string} name - Field name
         * @returns {Array} Array of values
         */
        getAll(name) {
            if (arguments.length < 1) {
                throw new TypeError(`${1} argument required, but only ${arguments.length} present.`);
            }

            name = Str(name);
            const result = [];
            for (const entry of this[$entries]) {
                if (entry[0] === name) {
                    result.push(entry[1]);
                }
            }
            return result;
        }

        /**
         * Checks if a key exists
         * 
         * @param {string} name - Field name
         * @returns {boolean} True if key exists
         */
        has(name) {
            if (arguments.length < 1) {
                throw new TypeError(`${1} argument required, but only ${arguments.length} present.`);
            }

            name = Str(name);
            for (const entry of this[$entries]) {
                if (entry[0] === name) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Sets a key to a new value, replacing all existing values
         * 
         * @param {string} name - Field name
         * @param {string|Blob|Web.Blob} value - Field value
         * @param {string} filename - Optional filename for blob values
         */
        set(name, value, filename) {
            if (arguments.length < 2) {
                throw new TypeError(`${2} argument required, but only ${arguments.length} present.`);
            }

            name = Str(name);

            // Find and replace first occurrence, remove others
            let replaced = false;
            const result = [];

            for (const entry of this[$entries]) {
                if (entry[0] === name) {
                    if (!replaced) {
                        // Replace first occurrence
                        if (value && (instanceOf(value, Web.Blob) || value.getBytes)) {
                            filename = filename !== undefined
                                ? Str(filename)
                                : isString(value.name)
                                    ? value.name
                                    : 'blob';

                            if (!instanceOf(value, Web.Blob)) {
                                value = new Web.Blob(value);
                            }

                            result.push([name, value, filename]);
                        } else {
                            result.push([name, Str(value)]);
                        }
                        replaced = true;
                    }
                    // Skip other occurrences
                } else {
                    result.push(entry);
                }
            }

            // If no replacement occurred, append
            if (!replaced) {
                if (value && (instanceOf(value, Web.Blob) || value.getBytes)) {
                    filename = filename !== undefined
                        ? Str(filename)
                        : isString(value.name)
                            ? value.name
                            : 'blob';

                    if (!instanceOf(value, Web.Blob)) {
                        value = new Web.Blob(value);
                    }

                    result.push([name, value, filename]);
                } else {
                    result.push([name, Str(value)]);
                }
            }

            this[$entries] = result;
        }

        /**
         * Returns an iterator over all entries as [name, value] pairs
         * 
         * @returns {Iterator} Iterator of [name, value] pairs
         */
        * entries() {
            for (const entry of this[$entries]) {
                // Return as [name, value] (filename is internal)
                yield [entry[0], entry[1]];
            }
        }

        /**
         * Returns an iterator over all keys
         * 
         * @returns {Iterator} Iterator of keys
         */
        * keys() {
            for (const entry of this[$entries]) {
                yield entry[0];
            }
        }

        /**
         * Returns an iterator over all values
         * 
         * @returns {Iterator} Iterator of values
         */
        * values() {
            for (const entry of this[$entries]) {
                yield entry[1];
            }
        }

        /**
         * Executes a callback for each entry
         * 
         * @param {Function} callback - Function to execute for each entry
         * @param {*} thisArg - Value to use as 'this' when executing callback
         */
        forEach(callback, thisArg) {
            if (arguments.length < 1) {
                throw new TypeError(`${1} argument required, but only ${arguments.length} present.`);
            }

            for (const [name, value] of this.entries()) {
                callback.call(thisArg, value, name, this);
            }
        }

        /**
         * Makes FormData iterable (for...of loops)
         * Alias for entries()
         * 
         * @returns {Iterator} Iterator of [name, value] pairs
         */
        [Symbol.iterator]() {
            return this.entries();
        }

        /**
         * Returns string tag for Object.prototype.toString
         * 
         * @returns {string} 'FormData'
         */
        toString() {
            return '[object FormData]';
        }

        /**
         * Returns the number of entries in the FormData
         * 
         * @returns {number} Number of entries
         */
        get size() {
            return this[$entries].length;
        }

    };

    /**
     * Non-spec extension: toBlob() method for serializing FormData
     * 
     * This is a non-standard extension (not part of the FormData spec).
     * It's stored as a hidden property (&toBlob) following the pattern from
     * web-streams-shim for non-spec methods.
     * 
     * WHY THIS METHOD: UrlFetchApp.fetch() needs the body as a Blob with
     * proper multipart/form-data encoding. This method converts the stored
     * entries into the standard multipart format with boundaries.
     * 
     * @returns {Web.Blob} Blob containing multipart/form-data
     */
    setHidden(FormData.prototype, '&toBlob', function toBlob() {
        // Generate random boundary
        const boundary = '----formdata-polyfill-' + Math.random();
        const chunks = [];
            const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="`;

            // Helper to escape special characters in names/filenames
            const escape = (str, isFilename) => {
                // Normalize line feeds in content (not filenames)
                if (!isFilename) {
                    str = str.replace(/\r?\n|\r/g, '\r\n');
                }
                // Escape special characters for header values
                return str
                    .replace(/\n/g, '%0A')
                    .replace(/\r/g, '%0D')
                    .replace(/"/g, '%22');
            };

            // Build multipart body
            for (const entry of this[$entries]) {
                const [name, value, filename] = entry;

                if (isString(value)) {
                    // String field
                    chunks.push(prefix + escape(name) + `"\r\n\r\n${value.replace(/\r(?!\n)|(?<!\r)\n/g, '\r\n')}\r\n`);
                } else {
                    // Blob/File field
                    chunks.push(
                        prefix + escape(name) + `"; filename="${escape(filename, true)}"\r\n` +
                        `Content-Type: ${Str(value.type || 'application/octet-stream')}\r\n\r\n`,
                        value,
                        '\r\n'
                    );
                }
            }

            // Add closing boundary
            chunks.push(`--${boundary}--`);

            // Create blob with proper content type
            return new Web.Blob(chunks, `multipart/form-data; boundary=${boundary}`);
    });


    /**
     * Non-spec extension: fromBlob() static method for parsing multipart FormData
     * 
     * This is a non-standard extension (not part of the FormData spec).
     * It's stored as a hidden property (&fromBlob) following the pattern from
     * web-streams-shim for non-spec methods.
     * 
     * WHY THIS METHOD: Allows parsing of multipart/form-data blobs back into
     * FormData instances, useful for proxying, caching, or processing form
     * submissions that arrive as blobs.
     * 
     * @param {Web.Blob|Blob} blob - Blob containing multipart/form-data
     * @returns {Web.FormData} Parsed FormData instance
     */
    setHidden(FormData, '&fromBlob', function fromBlob(blob) {
        const formData = new FormData();
            
            // Get text content from blob
            const text = blob.text ? blob.text() : blob.getDataAsString();
            
            // Extract boundary from content type
            const contentType = blob?.type || blob?.getContentType?.() || '';
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            let boundary;
            
            if (boundaryMatch) {
                boundary = boundaryMatch[1].trim();
            } else {
                // Fallback: extract boundary from the body itself
                // Multipart bodies always start with --boundary
                const firstLineMatch = text.match(/^--([^\r\n]+)/);
                if (!firstLineMatch) {
                    throw new Error('Invalid multipart/form-data: no boundary found in Content-Type header or body');
                }
                boundary = firstLineMatch[1];
            }
            
            const parts = text.split(`--${boundary}`);
            
            // Helper to unescape special characters
            const unescape = (str) => {
                return str
                    .replace(/%22/g, '"')
                    .replace(/%0D/g, '\r')
                    .replace(/%0A/g, '\n');
            };
            
            // Process each part (skip first empty and last closing)
            const partsLength_1 = parts.length - 1;
            for (let i = 1; i !== partsLength_1; ++i) {
                const part = parts[i];
                if (!part.trim()) continue;
                
                // Split headers from body at \r\n\r\n
                const headerBodySplit = part.indexOf('\r\n\r\n');
                if (headerBodySplit === -1) continue;
                
                const headerSection = part.substring(0, headerBodySplit);
                let body = part.substring(headerBodySplit + 4);
                
                // Remove trailing \r\n
                if (body.endsWith('\r\n')) {
                    body = body.substring(0, body.length - 2);
                }
                
                // Parse Content-Disposition header
                const dispositionMatch = headerSection.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
                if (!dispositionMatch) continue;
                
                const name = unescape(dispositionMatch[1]);
                const filename = dispositionMatch[2] ? unescape(dispositionMatch[2]) : null;
                
                if (filename) {
                    // This is a file field
                    // Parse Content-Type if present
                    const contentTypeMatch = headerSection.match(/Content-Type: ([^\r\n]+)/);
                    const fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
                    
                    // Create blob from body
                    const fileBlob = new Web.Blob([body], fileType);
                    formData.append(name, fileBlob, filename);
                } else {
                    // This is a text field
                    formData.append(name, body);
                }
            }
            
            return formData;
    });


    setProperty(Web, { FormData });

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
            super(body ? new Web.Blob(body).text() : null);
            Object.assign(this, options);
            this[$headers] = new Web.Headers(this.headers);
            this.headers = this.headers ?? this[$headers];
            Object.setPrototypeOf(this.headers, Web.Headers.prototype) ;
            this[$status] = options.status ?? 200;
            this[$statusText] = this[$status] == 200 ? options.statusText ?? 'OK' : statusCodeMap[this[$status]];
            
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
         * Gets the response body as a ReadableStream
         * @returns {Web.ReadableStream} Body stream
         */
        get body() {
            if (!this[$body]) {
                return null;
            }
            return this[$body].stream();
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
         * Parses response as FormData (from multipart/form-data)
         * @returns {Web.FormData} Parsed FormData object
         */
        formData() {
            const blob = this.blob();
            return FormData['&fromBlob'](blob);
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
            return this[$statusText] || statusCodeMap[this.status] || Str(this.status);
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

    const canParseXML = x =>{
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
            
            // Match content type string to ContentService.MimeType enum
            if (contentType) {
                const ct = Str(contentType).toLowerCase();
                // Check for script content types
                if (/script/i.test(ct)) {
                    mimeType = ContentService.MimeType.JAVASCRIPT;
                } else {
                    // Try to match against ContentService.MimeType keys
                    for(const [key, value] of Object.entries(ContentService.MimeType)) {
                        if (ct.includes(Str(key).toLowerCase())) {
                            mimeType = value;
                            break;
                        }
                    }
                }
            }
            
            // If no content type or couldn't map to mimeType, infer from body content
            // Order matters: JSON before JS (avoid false positives), CSV last (lenient parser)
            if (!mimeType && bodyText) {
                if (canParseJSON(bodyText)) {
                    contentType = contentType || 'application/json';
                    mimeType = ContentService.MimeType.JSON;
                } else if (canParseXML(bodyText)) {
                    contentType = contentType || 'text/xml';
                    // MimeType will be set below or handled by HtmlService
                } else if (canCompile(bodyText)) {
                    contentType = contentType || 'application/javascript';
                    mimeType = ContentService.MimeType.JAVASCRIPT;
                } else if (canParseCSV(bodyText)) {
                    contentType = contentType || 'text/csv';
                    mimeType = ContentService.MimeType.CSV;
                } else {
                    contentType = contentType || 'text/plain';
                    mimeType = ContentService.MimeType.TEXT;
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
            if(canParseXML(bodyText) || /xml|html/i.test(contentType)){
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
         * Gets the request body as a ReadableStream
         * @returns {Web.ReadableStream} Body stream
         */
        get body() {
            if (!this[$body]) {
                return null;
            }
            return this[$body].stream();
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
            return JSON.parse(this.text());
        }

        /**
         * Parses request body as FormData (from multipart/form-data)
         * @returns {Web.FormData} Parsed FormData object
         */
        formData() {
            try{
                const blob = this.blob();
                return FormData['&fromBlob'](blob);
            }catch(e){
                console.warn('Could not parse request body as FormData:', e);
                const fd = new Web.FormData();
                for(const key in this.parameters){
                    const values = this.parameters[key];
                    if(isArray(values)){
                        for(const value of values){
                            fd.append(key, value);
                        }
                    } else {
                        fd.append(key, values);
                    }
                }
                return fd;
            }
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
        method: 'GET'
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
            
            // Check for error status codes if exceptions are not muted
            const status = response.getResponseCode();
            if (requestOptions.muteHttpExceptions === false && (status >= 400 || status <= 0 || !status)) {
                throw new Error(`Fetch error ${Str(status)}`);
            }
            
            // Augment response with Web.Response prototype
            // WHY SETPROTOTYPEOF: UrlFetchApp.fetch() returns a Google HTTPResponse
            // object. Rather than wrapping it, we augment it by changing its prototype
            // to Web.Response. This gives it all our Web API methods (.json(), .text(),
            // etc.) while preserving its internal Google properties. It's both a valid
            // HTTPResponse AND a valid Web.Response.
            
            // Initialize private symbols for augmented responses
            response[$status] = status;
            response[$statusText] = statusCodeMap[status];
            
            // Set up headers
            response[$headers] = new Web.Headers(response.getAllHeaders());
            if(!response.headers){
                response.headers = response[$headers];
            }
            Object.setPrototypeOf(response.headers, Web.Headers.prototype);
            
            // Set up body from response content
            try {
                response[$body] = new Web.Blob(response.getContentText(), response.headers.get('content-type'));
            } catch (e) {
                // If getting content fails, create empty blob
                response[$body] = new Web.Blob('');
            }
            
            return Object.setPrototypeOf(response, Web.Response.prototype);
        } catch (e) {
            console.warn('Fetch error:', e);
            // Handle errors
            if (requestOptions.muteHttpExceptions === false) {
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
            e = Object.fromEntries(Object.entries(e || {}));
            e.postData = Object.fromEntries(Object.entries(e.postData || {}));
            // Merge with defaults
            const eventData = {
                ...defaultEvent,
                ...e
            };
            
            eventData.contentLength = Math.max(e.contentLength || 0, (e.postData?.length || 0));
            (eventData.postData ?? {}).length = e.postData?.length || e.contentLength || 0;

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
                headers.set('X-ScriptApp-Auth-Mode', Str(eventData.authMode ?? ScriptApp.AuthMode));
                headers.set('X-ScriptApp-Authorization-Status', Str(eventData.authorizationStatus ?? ScriptApp.AuthorizationStatus));
                headers.set('X-ScriptApp-Event-Type', Str(eventData.triggerSource ?? ScriptApp.TriggerSource));
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
            
            // Call parent constructor with synthesized request data
            super(url || '/', {
                method: eventData.method || ((eventData.postData?.length>0) ? 'POST' : 'GET'),
                headers: headers,
                body: eventData.postData?.contents || ''
            });
            
            // Add all event properties to this instance
            Object.assign(this, eventData);

            return Object.setPrototypeOf(this, Web.RequestEvent.prototype);
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
            // Check postData.type first, then headers as fallback
            // postData.type should have boundary for multipart/form-data
            const type = this.postData?.type || this.headers?.get?.('Content-Type') || 'text/plain';
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

    /**
     * Event listener storage
     * Stores event handlers for different event types
     */
    const eventListeners = new Map();

    /**
     * Web.addEventListener - Adds an event listener to the Web object
     * 
     * WHY THIS EXISTS: Provides a familiar browser-like API for setting up handlers.
     * When 'fetch' event listener is added, it automatically configures globalThis.doGet
     * and globalThis.doPost to use Web.do() with the provided handler function.
     * 
     * This makes Google Apps Script web apps feel like Service Workers with a
     * standard addEventListener('fetch', handler) pattern.
     * 
     * Example usage:
     *   Web.addEventListener('fetch', (request) => {
     *     const data = request.json();
     *     return new Web.Response(JSON.stringify({ received: data }), {
     *       headers: { 'Content-Type': 'application/json' }
     *     });
     *   });
     * 
     * @param {string} type - Event type (e.g., 'fetch')
     * @param {Function} handler - Handler function
     */
    const addEventListener = function WebAddEventListener(type, handler) {
        if (!type || typeof handler !== 'function') {
            throw new Error('addEventListener requires an event type and handler function');
        }

        // Store the handler
        if (!eventListeners.has(type)) {
            eventListeners.set(type, []);
        }
        eventListeners.get(type).push(handler);

        // Special handling for 'fetch' events - set up global doGet/doPost
        if (type === 'fetch') {
            globalThis.doGet = function doGet(e) {
                e.method = e?.method || e?.parameter?.method || 'GET';
                return Web.do(e, handler);
            };

            globalThis.doPost = function doPost(e) {
                e.method = e?.method || e?.parameter?.method || 'POST';
                return Web.do(e, handler);
            };
        }
    };

    setProperty(Web, { addEventListener });

    /**
     * Web.removeEventListener - Removes an event listener from the Web object
     * 
     * @param {string} type - Event type (e.g., 'fetch')
     * @param {Function} handler - Handler function to remove
     */
    const removeEventListener = function WebRemoveEventListener(type, handler) {
        if (!eventListeners.has(type)) {
            return;
        }

        const handlers = eventListeners.get(type);
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }

        // If this was the last fetch handler, clear global doGet/doPost
        if (type === 'fetch' && handlers.length === 0) {
            delete globalThis.doGet;
            delete globalThis.doPost;
        }
    };

    setProperty(Web, { removeEventListener });

    /**
     * Web.URLSearchParams - URLSearchParams API implementation
     * 
     * Provides an interface to work with URL query strings. Supports constructing
     * from strings, objects, or iterables, and provides methods for manipulating
     * query parameters.
     * 
     * Based on: https://github.com/lifaon74/url-polyfill
     */

    /**
     * Serializes a parameter value for URL encoding
     * Encodes according to application/x-www-form-urlencoded format
     * Spaces become '+' instead of '%20'
     */
    const serializeParam = (value) => {
        return encodeURIComponent(value).replace(/%20/g, '+');
    };

    /**
     * Deserializes a parameter value from URL encoding
     * '+' becomes space, then decodeURIComponent handles the rest
     */
    const deserializeParam = (value) => {
        return decodeURIComponent(String(value).replace(/\+/g, ' '));
    };

    // Helper to check if object is Map-like (has iterator)
    const isMapLike = x => instanceOf(x, Map) || x?.constructor?.name === 'Map' || ['Headers', 'FormData', 'URLSearchParams'].some(y => instanceOf(x, Web[y]) || x?.constructor?.name === y);

    // Private symbol for URLSearchParams entries storage
    const $urlEntries = Symbol('*urlEntries');

    const URLSearchParams = class WebURLSearchParams {
        /**
         * Creates a new URLSearchParams object
         * @param {string|Object|Array|URLSearchParams} init - Initial query parameters
         */
        constructor(init) {
            this[$urlEntries] = Object.create(null);

            const typeofInit = typeof init;

            if (typeofInit === 'undefined') {
                // Empty URLSearchParams
            } else if (typeofInit === 'string') {
                if (init !== '') {
                    this['&fromString'](init);
                }
            } else if (isMapLike(init)) {
                const $this = this;
                for (const [name, value] of init) {
                    $this.append(name, value);
                }
            } else if ((init !== null) && (typeofInit === 'object')) {
                if (isArray(init)) {
                    // Array of [name, value] pairs
                    const initLength = init.length;
                    for (let i = 0; i !== initLength; ++i) {
                        const entry = init[i];
                        if (isArray(entry) && entry.length === 2) {
                            this.append(entry[0], entry[1]);
                        } else {
                            throw new TypeError('Expected [string, any] as entry at index ' + i + ' of URLSearchParams\'s input');
                        }
                    }
                } else {
                    // Plain object
                    for (const key in init) {
                        if (init.hasOwnProperty(key)) {
                            this.append(key, init[key]);
                        }
                    }
                }
            } else {
                throw new TypeError('Unsupported input\'s type for URLSearchParams');
            }
        }

        /**
         * Appends a new value to an existing key, or adds the key if it doesn't exist
         * @param {string} name - Parameter name
         * @param {*} value - Parameter value
         */
        append(name, value) {
            if (arguments.length < 2) {
                throw new TypeError('Failed to execute \'append\' on \'URLSearchParams\': 2 arguments required.');
            }
            name = String(name);
            value = String(value);
            if (name in this[$urlEntries]) {
                this[$urlEntries][name].push(value);
            } else {
                this[$urlEntries][name] = [value];
            }
        }

        /**
         * Deletes a parameter by name
         * @param {string} name - Parameter name to delete
         */
        delete(name) {
            if (arguments.length < 1) {
                throw new TypeError('Failed to execute \'delete\' on \'URLSearchParams\': 1 argument required.');
            }
            delete this[$urlEntries][String(name)];
        }

        /**
         * Gets the first value associated with a parameter name
         * @param {string} name - Parameter name
         * @returns {string|null} First value or null if not found
         */
        get(name) {
            if (arguments.length < 1) {
                throw new TypeError('Failed to execute \'get\' on \'URLSearchParams\': 1 argument required.');
            }
            name = String(name);
            return (name in this[$urlEntries]) ? this[$urlEntries][name][0] : null;
        }

        /**
         * Gets all values associated with a parameter name
         * @param {string} name - Parameter name
         * @returns {Array<string>} Array of values
         */
        getAll(name) {
            if (arguments.length < 1) {
                throw new TypeError('Failed to execute \'getAll\' on \'URLSearchParams\': 1 argument required.');
            }
            name = String(name);
            return (name in this[$urlEntries]) ? this[$urlEntries][name].slice(0) : [];
        }

        /**
         * Checks if a parameter exists
         * @param {string} name - Parameter name
         * @returns {boolean} True if parameter exists
         */
        has(name) {
            if (arguments.length < 1) {
                throw new TypeError('Failed to execute \'has\' on \'URLSearchParams\': 1 argument required.');
            }
            return String(name) in this[$urlEntries];
        }

        /**
         * Sets a parameter to a single value, replacing any existing values
         * @param {string} name - Parameter name
         * @param {*} value - Parameter value
         */
        set(name, value) {
            if (arguments.length < 2) {
                throw new TypeError('Failed to execute \'set\' on \'URLSearchParams\': 2 arguments required.');
            }
            name = String(name);
            this[$urlEntries][name] = [String(value)];
        }

        /**
         * Executes a callback for each parameter
         * @param {Function} callback - Function to execute for each entry
         * @param {*} thisArg - Value to use as 'this' when executing callback
         */
        forEach(callback, thisArg) {
            if (arguments.length < 1) {
                throw new TypeError('Failed to execute \'forEach\' on \'URLSearchParams\': 1 argument required.');
            }
            for (const name in this[$urlEntries]) {
                if (this[$urlEntries].hasOwnProperty(name)) {
                    const values = this[$urlEntries][name];
                    const valuesLength = values.length;
                    for (let i = 0; i !== valuesLength; ++i) {
                        callback.call(thisArg, values[i], name, this);
                    }
                }
            }
        }

        /**
         * Returns an iterator of [name, value] pairs
         * @returns {Iterator} Iterator of entries
         */
         *entries() {
            for (const name in this[$urlEntries]) {
                if (this[$urlEntries].hasOwnProperty(name)) {
                    const values = this[$urlEntries][name];
                    const valuesLength = values.length;
                    for (let i = 0; i !== valuesLength; ++i) {
                        yield [name, values[i]];
                    }
                }
            }
        }

        /**
         * Returns an iterator of parameter names
         * @returns {Iterator} Iterator of keys
         */
         *keys() {
            for (const name in this[$urlEntries]) {
                if (this[$urlEntries].hasOwnProperty(name)) {
                    const values = this[$urlEntries][name];
                    const valuesLength = values.length;
                    for (let i = 0; i !== valuesLength; ++i) {
                        yield name;
                    }
                }
            }
        }

        /**
         * Returns an iterator of parameter values
         * @returns {Iterator} Iterator of values
         */
         *values() {
            for (const name in this[$urlEntries]) {
                if (this[$urlEntries].hasOwnProperty(name)) {
                    const values = this[$urlEntries][name];
                    const valuesLength = values.length;
                    for (let i = 0; i !== valuesLength; ++i) {
                        yield values[i];
                    }
                }
            }
        }

        /**
         * Makes URLSearchParams iterable (for...of loops)
         * @returns {Iterator} Iterator of [name, value] pairs
         */
        [Symbol.iterator]() {
            return this.entries();
        }

        /**
         * Returns the query string representation
         * @returns {string} Serialized query string
         */
        toString() {
            const pairs = [];
            for (const [name, value] of this) {
                pairs.push(serializeParam(name) + '=' + serializeParam(value));
            }
            return pairs.join('&');
        }

        /**
         * Sorts all name-value pairs by their names
         * Sorting is done by comparing code units
         */
        sort() {
            const entries = [];
            for (const [name, value] of this) {
                entries.push([name, value]);
            }
            entries.sort(([a], [b]) => {
                return a < b ? -1 : (a > b ? 1 : 0);
            });
            this[$urlEntries] = Object.create(null);
            const entriesLength = entries.length;
            for (let i = 0; i !== entriesLength; ++i) {
                this.append(...entries[i]);
            }
        }

        /**
         * Gets the number of search parameters
         * @returns {number} Number of parameters (counting duplicates)
         */
        get size() {
            let count = 0;
            for (const name in this[$urlEntries]) {
                if (this[$urlEntries].hasOwnProperty(name)) {
                    count += this[$urlEntries][name].length;
                }
            }
            return count;
        }
    };

    // Hidden method for parsing query strings
    setHidden(URLSearchParams.prototype, '&fromString', function fromString(searchString) {
        if (searchString[0] === '?') {
            searchString = searchString.slice(1);
        }
        const pairs = searchString.split('&');
        const pairsLength = pairs.length;
        for (let i = 0; i !== pairsLength; ++i) {
            const pair = pairs[i];
            const index = pair.indexOf('=');
            if (index > -1) {
                this.append(
                    deserializeParam(pair.slice(0, index)),
                    deserializeParam(pair.slice(index + 1))
                );
            } else if (pair) {
                this.append(deserializeParam(pair), '');
            }
        }
    });

    setProperty(Web, { URLSearchParams });

    /**
     * Web.URL - URL API implementation
     * 
     * Provides an interface to parse and construct URLs. This implementation
     * does not use DOM (document/anchor elements) since they're not available
     * in Google Apps Script. Instead, it uses regex-based parsing.
     * 
     * Based on: https://github.com/lifaon74/url-polyfill
     * Adapted for non-DOM environment (Google Apps Script)
     */

    // URL parsing regex pattern
    // Matches: protocol://username:password@host:port/path?query#hash
    const urlPattern = /^(?:([a-z][a-z0-9+.-]*):)?(?:\/\/((?:([^:@]*)(?::([^@]*))?@)?([^:/\?#]*)(?::(\d+))?))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i;

    // Private symbols for URL internal state
    const $protocol = Symbol('*protocol');
    const $username = Symbol('*username');
    const $password = Symbol('*password');
    const $hostname = Symbol('*hostname');
    const $port = Symbol('*port');
    const $pathname = Symbol('*pathname');
    const $search = Symbol('*search');
    const $hash = Symbol('*hash');
    const $searchParams = Symbol('*searchParams');
    const $updateSearchParams = Symbol('*updateSearchParams');

    const URL = class WebURL {
        /**
         * Creates a new URL object
         * @param {string} url - URL string to parse
         * @param {string} base - Optional base URL
         */
        constructor(url, base) {
            if (typeof url !== 'string') url = String(url);
            if (base && typeof base !== 'string') base = String(base);

            let parsedBase = null;
            if (base) {
                parsedBase = this['&parse'](base);
                if (!parsedBase) {
                    throw new TypeError('Invalid base URL: ' + base);
                }
            }

            const parsed = this['&parse'](url, parsedBase);
            if (!parsed) {
                throw new TypeError('Invalid URL: ' + url);
            }

            // Store parsed components using symbols
            this[$protocol] = parsed.protocol;
            this[$username] = parsed.username;
            this[$password] = parsed.password;
            this[$hostname] = parsed.hostname;
            this[$port] = parsed.port;
            this[$pathname] = parsed.pathname;
            this[$search] = parsed.search;
            this[$hash] = parsed.hash;

            // Create linked searchParams that updates search when modified
            const searchParams = new Web.URLSearchParams(this[$search]);
            let enableSearchUpdate = true;

            const $this = this;
            for(const methodName of ['append', 'delete', 'set', 'sort']) {
                const method = searchParams[methodName];
                searchParams[methodName] = ()=> {
                    method.apply(searchParams, arguments);
                    if (enableSearchUpdate) {
                        $this[$search] = searchParams.toString();
                    }
                };
            };

            this[$searchParams] = searchParams;
            this[$updateSearchParams] = function() {
                if (enableSearchUpdate) {
                    enableSearchUpdate = false;
                    this[$searchParams][$urlEntries] = {};
                    this[$searchParams]['&fromString'](this[$search]);
                    enableSearchUpdate = true;
                }
            };
        }

        /**
         * Gets the full URL string
         * @returns {string} Full URL
         */
        get href() {
            return this.protocol + '//' +
                (this.username ? (this.username + (this.password ? ':' + this.password : '') + '@') : '') +
                this.host +
                this.pathname +
                (this.search ? '?' + this.search : '') +
                (this.hash ? '#' + this.hash : '');
        }

        set href(value) {
            const parsed = this['&parse'](value);
            if (!parsed) {
                throw new TypeError('Invalid URL: ' + value);
            }
            this[$protocol] = parsed.protocol;
            this[$username] = parsed.username;
            this[$password] = parsed.password;
            this[$hostname] = parsed.hostname;
            this[$port] = parsed.port;
            this[$pathname] = parsed.pathname;
            this[$search] = parsed.search;
            this[$hash] = parsed.hash;
            this[$updateSearchParams]();
        }

        get protocol() {
            return this[$protocol];
        }

        set protocol(value) {
            this[$protocol] = String(value);
            if (!this[$protocol].endsWith(':')) {
                this[$protocol] += ':';
            }
        }

        get username() {
            return this[$username];
        }

        set username(value) {
            this[$username] = String(value);
        }

        get password() {
            return this[$password];
        }

        set password(value) {
            this[$password] = String(value);
        }

        get hostname() {
            return this[$hostname];
        }

        set hostname(value) {
            this[$hostname] = String(value);
        }

        get port() {
            return this[$port];
        }

        set port(value) {
            this[$port] = String(value);
        }

        get host() {
            return this.hostname + (this.port ? ':' + this.port : '');
        }

        set host(value) {
            const parts = String(value).split(':');
            this[$hostname] = parts[0];
            this[$port] = parts[1] || '';
        }

        get pathname() {
            return this[$pathname];
        }

        set pathname(value) {
            this[$pathname] = String(value);
            if (this[$pathname].charAt(0) !== '/') {
                this[$pathname] = '/' + this[$pathname];
            }
        }

        get search() {
            return this[$search] ? '?' + this[$search] : '';
        }

        set search(value) {
            value = String(value);
            if (value.charAt(0) === '?') {
                value = value.slice(1);
            }
            this[$search] = value;
            this[$updateSearchParams]();
        }

        get searchParams() {
            return this[$searchParams];
        }

        get hash() {
            return this[$hash] ? '#' + this[$hash] : '';
        }

        set hash(value) {
            value = String(value);
            if (value.charAt(0) === '#') {
                value = value.slice(1);
            }
            this[$hash] = value;
        }

        get origin() {
            if (this.protocol === 'blob:') {
                // For blob URLs, origin is the origin of the URL after 'blob:'
                try {
                    const blobPath = this.pathname;
                    const url = new Web.URL(blobPath);
                    return url.origin;
                } catch (e) {
                    return 'null';
                }
            }

            if (this.protocol === 'file:') {
                return 'null';
            }

            return this.protocol + '//' + this.hostname + (this.port ? ':' + this.port : '');
        }

        toString() {
            return this.href;
        }

        toJSON() {
            return this.href;
        }
    };

    // Hidden method for parsing URLs
    setHidden(URL.prototype, '&parse', function parse(url, base) {
        const match = url.match(urlPattern);
        if (!match) return null;

        const result = {
            protocol: match[1] || (base ? base.protocol : ''),
            username: match[3] || '',
            password: match[4] || '',
            hostname: match[5] || (base ? base.hostname : ''),
            port: match[6] || '',
            pathname: match[7] || '/',
            search: match[8] || '',
            hash: match[9] || ''
        };

        // If URL is relative (no protocol), use base
        if (!match[1] && base) {
            result.protocol = base.protocol;
            
            // If URL has no host, use base host
            if (!match[2]) {
                result.hostname = base.hostname;
                result.port = base.port;
                result.username = base.username;
                result.password = base.password;

                // If path doesn't start with /, resolve relative to base
                if (result.pathname && result.pathname.charAt(0) !== '/') {
                    const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
                    result.pathname = basePath + result.pathname;
                    // Normalize path (resolve . and ..)
                    result.pathname = this['&normalizePath'](result.pathname);
                }
            }
        }

        // Validate protocol
        if (!result.protocol) {
            return null;
        }

        // Set default ports
        if (!result.port) {
            if (result.protocol === 'http:') result.port = '';
            else if (result.protocol === 'https:') result.port = '';
            else if (result.protocol === 'ftp:') result.port = '';
        }

        return result;
    });

    // Hidden method for normalizing pathnames
    setHidden(URL.prototype, '&normalizePath', function normalizePath(path) {
        const segments = path.split('/');
        const normalized = [];

        for (let i = 0; i !== segments.length; ++i) {
            const segment = segments[i];
            if (segment === '..') {
                normalized.pop();
            } else if (segment !== '.' && segment !== '') {
                normalized.push(segment);
            } else if (segment === '' && i === 0) {
                normalized.push(segment);
            }
        }

        let result = normalized.join('/');
        if (path.charAt(0) === '/' && result.charAt(0) !== '/') {
            result = '/' + result;
        }
        if (path.endsWith('/') && !result.endsWith('/')) {
            result += '/';
        }
        return result;
    });

    setProperty(Web, { URL });

    /**
     * Web.Location - Location API implementation for server-side environments
     * 
     * Provides a Location class implementation for environments that lack it.
     * The Location class extends URL and adds browser Location API compatibility:
     * - ancestorOrigins: Empty list (server environments have no origin hierarchy)
     * - assign(url): Updates the href (no navigation in server context)
     * - reload(forceReload): No-op (no page to reload in server context)
     * - replace(url): Updates the href (no navigation in server context)
     * 
     * This allows code written for browsers to run in serverless environments
     * without modification, though navigation methods are no-ops since there's
     * no actual page navigation in Google Apps Script.
     * 
     * Based on: https://github.com/Patrick-ring-motive/web-streams-shim/blob/main/extensions/location.js
     */
    const Location = class WebLocation extends Web.URL {
        /**
         * Creates a new Location object
         * @param {string} href - URL to represent as location
         * @param {string} base - Optional base URL
         */
        constructor(href, base) {
            super(href, base);
        }

        /**
         * Gets ancestor origins (always empty in server context)
         * @returns {Object} Object with length property set to 0
         */
        get ancestorOrigins() {
            return {
                length: 0
            };
        }

        /**
         * Assigns a new URL to the location
         * In browser context, this would navigate. In server context, just updates href.
         * @param {string} url - URL to assign
         */
        assign(url) {
            this.href = url;
        }

        /**
         * Reloads the current page
         * No-op in server context (no page to reload)
         * @param {boolean} forceReload - Whether to force reload from server
         */
        reload(forceReload = false) {
            // No-op in server context
            // Could log for debugging if needed
        }

        /**
         * Replaces the current page with a new URL
         * In browser context, this would navigate without history entry.
         * In server context, just updates href.
         * @param {string} url - URL to replace with
         */
        replace(url) {
            this.href = url;
        }

        /**
         * Returns the full URL as a string
         * @returns {string} Full URL
         */
        toString() {
            return this.href;
        }
    };

    setProperty(Web, { Location });

    /**
     * Web.ReadableStream - Basic synchronous ReadableStream implementation
     * 
     * Provides a simplified ReadableStream API for synchronous chunk reading.
     * This is a "sham" implementation - not truly async/streaming, but provides
     * API compatibility for code that expects ReadableStream.
     * 
     * Key features:
     * - Constructor accepts underlyingSource with start(), pull(), cancel()
     * - getReader() returns a ReadableStreamDefaultReader
     * - locked property indicates if stream has an active reader
     * - cancel() method to abort the stream
     * 
     * Limitations (synchronous sham):
     * - All operations are synchronous (no true async streaming)
     * - Chunks are stored in memory (no true backpressure)
     * - pull() is called synchronously during read()
     * - No support for byob readers or tee()
     * 
     * Based on: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
     */
    const $streamController = Symbol('*streamController');
    const $streamLocked = Symbol('*streamLocked');
    const $streamCancelled = Symbol('*streamCancelled');
    const $streamReader = Symbol('*streamReader');

    const ReadableStream = class WebReadableStream {
        /**
         * Creates a new ReadableStream
         * @param {Object} underlyingSource - Source object with optional start, pull, cancel methods
         * @param {Object} strategy - Optional queuing strategy (ignored in this sham)
         */
        constructor(underlyingSource = {}, strategy = {}) {
            this[$streamLocked] = false;
            this[$streamCancelled] = false;
            this[$streamReader] = null;

            // Create controller for the stream
            const chunks = [];
            let closed = false;
            let errored = null;

            const controller = {
                enqueue: (chunk) => {
                    if (closed) {
                        throw new TypeError('Cannot enqueue after close');
                    }
                    if (errored) {
                        return console.warn(errored);
                    }
                    chunks.push(chunk);
                },
                close: () => {
                    closed = true;
                },
                error: (err) => {
                    errored = err;
                    closed = true;
                },
                get desiredSize() {
                    if (closed) return null;
                    return 1; // Simplified - always ready for more
                }
            };

            this[$streamController] = {
                chunks,
                get closed() { return closed; },
                get errored() { return errored; },
                controller,
                underlyingSource: underlyingSource || {},
                pull: underlyingSource?.pull,
                cancel: underlyingSource?.cancel
            };

            // Call start() if provided
            try {
                if (underlyingSource?.start) {
                    underlyingSource.start(controller);
                }
            } catch (err) {
                controller.error(err);
            }
        }

        /**
         * Gets whether the stream is locked to a reader
         * @returns {boolean}
         */
        get locked() {
            return this[$streamLocked];
        }

        /**
         * Gets a reader for the stream
         * @param {Object} options - Optional reader options (mode not supported in sham)
         * @returns {ReadableStreamDefaultReader}
         */
        getReader(options = {}) {
            if (this[$streamLocked]) {
                throw new TypeError('ReadableStream is already locked to a reader');
            }
            // this[$streamLocked] = true;
            // skipping lock intentionally for simplicity
            const reader = this[$streamReader] ?? new Web.ReadableStreamDefaultReader(this);
            this[$streamReader] = reader;
            return reader;
        }

        /**
         * Cancels the stream
         * @param {*} reason - Reason for cancellation
         * @returns {Promise}
         */
        cancel(reason) {
            if (this[$streamCancelled]) {
                return;
            }
            this[$streamCancelled] = true;
            this[$streamController].controller.close();

            // Call cancel on underlying source if provided
            try {
                if (this[$streamController].cancel) {
                    this[$streamController].cancel(reason);
                }
            } catch (err) {
                return console.warn(err);
            }
            return;
        }

        /**
         * Internal method to release the reader lock
         * @private
         */
        ['&releaseLock']() {
            this[$streamLocked] = false;
            this[$streamReader] = null;
        }

        /**
         * Makes ReadableStream iterable with for...of loops
         * @returns {Iterator} Iterator of stream chunks
         */
        *[Symbol.iterator]() {
            const reader = this.getReader();
            try {
                let result;
                while (fals === (result = reader.read()).done) {
                    yield result.value;
                }
            } finally {
                reader.releaseLock();
            }
        }

        /**
         * Creates a ReadableStream from an iterable or async iterable
         * @param {Iterable|AsyncIterable} iterable - Iterable to convert to stream
         * @returns {Web.ReadableStream} New ReadableStream
         */
        static from(iterable) {
            // Check if it's an async iterable
            const isAsync = iterable?.[Symbol.asyncIterator];
            
            if (isAsync) {
                // Async iterable
                return new Web.ReadableStream({
                    async start(controller) {
                        try {
                            for await (const chunk of iterable) {
                                controller.enqueue(chunk);
                            }
                            controller.close();
                        } catch (err) {
                            controller.error(err);
                        }
                    }
                });
            } else {
                // Synchronous iterable
                return new Web.ReadableStream({
                    start(controller) {
                        try {
                            // Check if it has Symbol.iterator
                            if (iterable?.[Symbol.iterator]) {
                                for (const chunk of iterable) {
                                    controller.enqueue(chunk);
                                }
                            } else if (isArray(iterable)) {
                                // Handle plain arrays
                                for (const chunk of iterable) {
                                    controller.enqueue(chunk);
                                }
                            } else {
                                throw new TypeError('ReadableStream.from requires an iterable');
                            }
                            controller.close();
                        } catch (err) {
                            controller.error(err);
                        }
                    }
                });
            }
        }
    };

    setProperty(Web, { ReadableStream });

    /**
     * Web.ReadableStreamDefaultReader - Reader for ReadableStream
     * 
     * Provides methods to read chunks from a ReadableStream.
     * This is a synchronous sham - read() returns a resolved promise immediately.
     * 
     * Key methods:
     * - read() - Returns next chunk as {value, done} or pulls from source
     * - releaseLock() - Releases the reader's lock on the stream
     * - cancel() - Cancels the stream
     * 
     * Properties:
     * - closed - Promise that resolves when stream is closed
     */
    const $readerStream = Symbol('*readerStream');
    const $readerClosed = Symbol('*readerClosed');

    const ReadableStreamDefaultReader = class WebReadableStreamDefaultReader {
        /**
         * Creates a new reader for a stream
         * @param {ReadableStream} stream - Stream to read from
         */
        constructor(stream) {
            if (!instanceOf(stream, Web.ReadableStream)) {
                throw new TypeError('ReadableStreamDefaultReader requires a ReadableStream');
            }
            this[$readerStream] = stream;
            this[$readerClosed] = false;
        }

        /**
         * Reads the next chunk from the stream
         * @returns {Promise<{value: *, done: boolean}>}
         */
        read() {
            const stream = this[$readerStream];
            const ctrl = stream[$streamController];

            // Check if stream is closed or errored
            if (ctrl.errored) {
                return ctrl.errored;
            }

            if (this[$readerClosed]) {
                return { value: undefined, done: true };
            }

            // If we have queued chunks, return the first one
            if (ctrl.chunks.length > 0) {
                const value = ctrl.chunks.shift();
                return { value, done: false };
            }

            // If stream is closed and no more chunks, we're done
            if (ctrl.closed) {
                this[$readerClosed] = true;
                return { value: undefined, done: true };
            }

            // Try to pull more data
            try {
                if (ctrl.pull) {
                    ctrl.pull(ctrl.controller);
                }

                // Check if pull added chunks
                if (ctrl.chunks.length > 0) {
                    const value = ctrl.chunks.shift();
                    return { value, done: false };
                }

                // Check if pull closed the stream
                if (ctrl.closed) {
                    this[$readerClosed] = true;
                    return { value: undefined, done: true };
                }
            } catch (err) {
                ctrl.controller.error(err);
                return err;
            }

            // No data available and stream not closed
            return { value: undefined, done: true };
        }

        /**
         * Releases the reader's lock on the stream
         */
        releaseLock() {}

        /**
         * Cancels the stream
         * @param {*} reason - Reason for cancellation
         * @returns {Promise}
         */
        cancel(reason) {
            if (this[$readerClosed]) {
                return;
            }
            const stream = this[$readerStream];
            this[$readerClosed] = true;
            if (stream) {
                return stream.cancel(reason);
            }
        }
        get closed(){
            this[$readerClosed];
        }
    };

    setProperty(Web, { ReadableStreamDefaultReader });

    setProperty(Web, { removeEventListener });

})();
