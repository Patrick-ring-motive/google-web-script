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

  
