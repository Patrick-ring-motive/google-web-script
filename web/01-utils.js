  const ScripAppService = (()=>{
      let service;
      return ()=>{
        if(!service){
          service = ScriptApp.getService();
        }
        return service; 
      };
  })();
    

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

