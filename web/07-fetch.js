
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
 * @see https://developer.mozilla.org/en-US/docs/Web/API/fetch (MDN Web Docs - fetch)
 * @see https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetchurl,-params (Google Apps Script - UrlFetchApp.fetch)
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
        if (!response.headers) {
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
    let req;
    try {
        // Convert to RequestEvent if not already
        req = instanceOf(request, Web.RequestEvent)
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

        const responseEvent = new Web.ResponseEvent(defaultResponse);
        return responseEvent;

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
    } finally {
        req.handled = true;
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
            return Web.do(e, handler) ?? e?.['&respondWith'];
        };

        globalThis.doPost = function doPost(e) {
            e.method = e?.method || e?.parameter?.method || 'POST';
            return Web.do(e, handler) ?? e?.['&respondWith'];
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


