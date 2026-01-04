/**
 * URLSearchParams and FormData Implementation Review
 * 
 * Extracted from web.js for closer inspection and verification.
 * These implementations were created to provide URLSearchParams and FormData APIs
 * for Google Apps Script's V8 runtime.
 */

// ============================================================================
// URLSearchParams Implementation
// ============================================================================

const tecodeComponent = x => {
      try {
        return decodeURIComponent(x);
      } catch {
        return Str(x);
      }
    };
    const recodeComponent = x => Str(x).replace(/%[A-F0-9]{2}/g, tecodeComponent);
    const decodeComponent = x => {
      try {
        return decodeURIComponent(x);
      } catch {
        return recodeComponent(x);
      }
    };
    const toFormed = x => String.fromCodePoint(...new Web.Blob(x).bytes());
    const encodeComponent = x => {
      try {
        return encodeURIComponent(x);
      } catch {
        return encodeURIComponent(toFormed(Str(x)));
      }
    };

const serializeParam = (value) => {
    return encodeComponent(Str(value)).replace(/%20/g, '+');
};

    /**
     * Deserializes a parameter value from URL encoding
     * '+' becomes space, then decodeURIComponent handles the rest
     */
const deserializeParam = (value) => {
    return decodeComponent(Str(value).replace(/\+/g, ' '));
};

const isMapLike = x => instanceOf(x,Map) || x?.constructor?.name == 'Map' || ['Headers','FormData','URLSearchParams'].some(y=>instanceOf(x,Web[y])||x?.constructor?.name == y);
// Private symbol for URLSearchParams entries storage
const $urlEntries = Symbol('*urlEntries');

class URLSearchParams {
    /**
     * Creates a new URLSearchParams object
     * @param {string|Object|Array|URLSearchParams} init - Initial query parameters
     */
    constructor(init) {
        this[$urlEntries] = Object.create(null);

        if (!init) {
            return
        }
        if (isString(init)) {
            this['&fromString'](init);
        } else if (isMapLike(init)) {
            for(const [name,value] of init){
                $this.append(name, value);
            };
        } else if (typeof init === 'object') {
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
        name = Str(name);
        value = Str(value);
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
        delete this[$urlEntries][Str(name)];
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
        name = Str(name);
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
        name = Str(name);
        return (name in this[$urlEntries]) ? this[$urlEntries][name].slice() : [];
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
        return Str(name) in this[$urlEntries];
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
        name = Str(name);
        this[$urlEntries][name] = [Str(value)];
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
        for(const[name,value] of this){
            // NOTE: This uses serializeParam helper that would need to be defined
            pairs.push(serializeParam(name) + '=' + serializeParam(value));
        };
        return pairs.join('&');
    }

    /**
     * Sorts all name-value pairs by their names
     * Sorting is done by comparing code units
     */
    sort() {
        const entries = [];
        for(const[name,value] of this) {
            entries.push([name, value]);
        };
        entries.sort((a, b)=> {
            return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
        });
        this[$urlEntries] = {};
        const entriesLength = entries.length;
        for (let i = 0; i !== entriesLength; ++i) {
            this.append(entries[i][0], entries[i][1]);
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
}

// Hidden method for parsing query strings (uses '&fromString' convention)
URLSearchParams.prototype['&fromString'] = function fromString(searchString) {
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
                // NOTE: deserializeParam helper needs to be defined
                deserializeParam(pair.slice(0, index)),
                deserializeParam(pair.slice(index + 1))
            );
        } else if (pair) {
            this.append(deserializeParam(pair), '');
        }
    }
};

// ============================================================================
// FormData Implementation
// ============================================================================

// Private symbol for FormData internal storage
const $entries = Symbol('*entries');

class FormData {

    /**
     * Creates a new FormData object
     * 
     * Note: Unlike browser FormData, we don't support constructing from HTML forms
     * since Google Apps Script doesn't have DOM access
     */
    constructor(init) {
        this[$entries] = [];
        if(init){
              const params = new Web.URLSearchParams(init);
              for(const[key,value] of params){
                    this.append(key,value);
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

        // Normalize the name to string (NOTE: Assumes Str() helper exists)
        name = Str(name);

        // Handle Blob/File values
        // NOTE: This references Web.Blob which would need to be available
        if (instanceOf(value, Web.Blob) || value?.getBytes){
            // Determine filename
            filename = filename !== undefined
                ? Str(filename)
                : isString(value.name)
                    ? value.name
                    : 'blob';

            // Ensure we have a Blob with the correct name
            if (!instanceOf(value,Web.Blob)) {
                // NOTE: Assumes Web.Blob constructor exists
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
            if (instanceOf(value, Web.Blob) || value?.getBytes) {
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

    get size(){
        return this[$entries].length;
    }

}

/**
 * Non-spec extension: toBlob() method for serializing FormData
 * 
 * This is a non-standard extension (not part of the FormData spec).
 * WHY THIS METHOD: UrlFetchApp.fetch() needs the body as a Blob with
 * proper multipart/form-data encoding.
 * 
 * @returns {Blob} Blob containing multipart/form-data
 */
FormData.prototype['&toBlob'] = function toBlob() {
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
        const name = entry[0];
        const value = entry[1];
        const filename = entry[2];

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

    // Create blob with proper content type (NOTE: Assumes Blob constructor exists)
    return new Web.Blob(chunks, `multipart/form-data; boundary=${boundary}`);
};

/**
 * Non-spec extension: fromBlob() static method for parsing multipart FormData
 * 
 * This is a non-standard extension (not part of the FormData spec).
 * WHY THIS METHOD: Allows parsing of multipart/form-data blobs back into
 * FormData instances.
 * 
 * @param {Blob} blob - Blob containing multipart/form-data
 * @returns {FormData} Parsed FormData instance
 */
FormData['&fromBlob'] = function fromBlob(blob) {
    const formData = new Web.FormData();
    
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
        const firstLineMatch = text.match(/^--([^\r\n]+)/);
        if (!firstLineMatch) {
            throw new Error('Invalid multipart/form-data: no boundary found');
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
    const partsLength = parts.length - 1;
    for (let i = 1; i !== partsLength; ++i) {
        const part = parts[i];
        if (!part.trim?.()) continue;
        
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
            const contentTypeMatch = headerSection.match(/Content-Type: ([^\r\n]+)/);
            const fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
            
            // Create blob from body (NOTE: Assumes Blob constructor exists)
            const fileBlob = new Web.Blob([body], fileType);
            formData.append(name, fileBlob, filename);
        } else {
            // This is a text field
            formData.append(name, body);
        }
    }
    
    return formData;
};

// ============================================================================
// NOTES FOR REVIEW
// ============================================================================

/**
 * DEPENDENCIES NEEDED FROM web.js:
 * 
 * For URLSearchParams:
 * - serializeParam() - URL encoding helper
 * - deserializeParam() - URL decoding helper
 * 
 * For FormData:
 * - Web.Blob class - Blob implementation
 * - Str() helper - String conversion (or just use String())
 * - instanceOf() helper - Instance checking (or just use instanceof)
 * - isString() helper - String type check (or just use typeof === 'string')
 * 
 * KNOWN ISSUES:
 * 1. URLSearchParams.keys() has typo: "valueLength" should be "valuesLength" (line 201 in web.js)
 * 2. Both classes use non-standard '&' prefix for internal/non-spec methods
 * 3. FormData assumes Blob compatibility with Google Apps Script's Blob
 * 
 * VERIFICATION CHECKLIST:
 * □ URLSearchParams constructor handles all input types correctly
 * □ URLSearchParams.append() allows multiple values per key
 * □ URLSearchParams.set() replaces all values with single value
 * □ URLSearchParams.toString() properly encodes special characters
 * □ URLSearchParams.sort() maintains multiple values per key
 * □ FormData.append() distinguishes between string and blob values
 * □ FormData.set() replaces only matching entries
 * □ FormData toBlob() creates valid multipart/form-data format
 * □ FormData fromBlob() correctly parses multipart/form-data
 * □ Both classes implement proper iterator protocol
 */
