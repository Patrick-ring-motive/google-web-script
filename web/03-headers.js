
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

