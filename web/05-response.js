
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
     * 
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Response (MDN Web Docs - Response)
     * @see https://developers.google.com/apps-script/reference/content/content-service (Google Apps Script - ContentService)
     * @see https://developers.google.com/apps-script/reference/url-fetch/http-response (Google Apps Script - HTTPResponse)
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
                //needs it's own class
                output = HtmlService.createHtmlOutput(bodyText);        
            }
            
            return Object.setPrototypeOf(this, Web.ResponseEvent.prototype) ;
        }

    };

    setProperty(Web, { ResponseEvent });

   
