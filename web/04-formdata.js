
/**
 * Web.FormData - FormData API implementation for Google Apps Script
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FormData (MDN Web Docs - FormData)
 * @see https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetchurl,-params (Google Apps Script - UrlFetchApp payload)
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
            if (!instanceOf(value, Web.Blob)) {
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
    return new Web.Blob(chunks, { type: `multipart/form-data; boundary=${boundary}` });
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
