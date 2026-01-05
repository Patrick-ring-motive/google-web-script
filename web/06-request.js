/**
 * Web.Request - HTTP Request object with Web API compatibility
 * Extends Google Apps Script's UrlFetchApp.getRequest
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Request (MDN Web Docs - Request)
 * @see https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#getRequesturl,-params (Google Apps Script - UrlFetchApp.getRequest)
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
        try {
            const blob = this.blob();
            return FormData['&fromBlob'](blob);
        } catch (e) {
            console.warn('Could not parse request body as FormData:', e);
            const fd = new Web.FormData();
            for (const key in this.parameters) {
                const values = this.parameters[key];
                if (isArray(values)) {
                    for (const value of values) {
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
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent (MDN Web Docs - FetchEvent)
 * @see https://developers.google.com/apps-script/guides/web#request_parameters (Google Apps Script - Web App Request Parameters)
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
let _clientId;
const RequestEvent = class WebRequestEvent extends Web.Request {
    get clientId() {
        if (!_clientId) {
            _clientId = ScriptApp.getScriptId();
        }
        return _clientId;
    }
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
            baseUrl = Web.location.href;
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
            method: eventData.method || ((eventData.postData?.length > 0) ? 'POST' : 'GET'),
            headers: headers,
            body: eventData.postData?.contents || ''
        });

        // Add all event properties to this instance
        Object.assign(this, eventData);

        this.handled = this.handled || false;

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

    get request() {
        return this
    }

    waitUntil() { }

    respondWith(response) {
        setHidden(this, '&respondWith', response);
    }

};

setProperty(Web, { RequestEvent });

