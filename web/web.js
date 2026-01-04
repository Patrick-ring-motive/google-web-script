
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
