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


let _location;
Object.defineProperty(Web,'location',{
   get(){
      if(!_location){
         _location = new Location(ScriptAppService().getUrl());
      }
      return _location;
   }
});
