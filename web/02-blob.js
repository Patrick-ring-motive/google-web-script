    /**
     * Web.Blob - Web-compatible Blob implementation
     * Extends Google Apps Script's Utilities.newBlob with Web API methods
     * 
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Blob (MDN Web Docs - Blob)
     * @see https://developers.google.com/apps-script/reference/utilities/utilities#newBlob(Byte) (Google Apps Script - Utilities.newBlob)
     * 
     * WHY EXTEND INSTEAD OF WRAP: We extend Utilities.newBlob directly because
     * UrlFetchApp and other Google APIs expect actual Blob objects, not wrappers.
     * By extending, our Web.Blob instances work seamlessly with all Google APIs
     * while still providing Web-standard methods like .text(), .arrayBuffer(), etc.
     * 
     * The setPrototypeOf calls ensure the Web API methods are available even when
     * the native Blob constructor doesn't cooperate with normal class extension.
     */

    const blobArgs = (args) => {
        if(!args[2])args = args.slice(0,2);
        if(!args[1])args = args.slice(0,1);
        if(!args[0])args = [];
        return args;
    }

    const Blob = class WebBlob extends Utilities.newBlob {

        /**
         * Creates a new Blob object
         * @param {Array|string|ArrayBuffer} parts - Data to include in the blob
         * @param {string} type - MIME type
         * @param {string} name - Optional name for the blob
         */
        constructor(parts = [], type, name) {
            // Extract type from various sources
            try{
            type = type?.type ?? type ?? parts?.type ?? parts?.getContentType?.();
            
            // Empty blob
            if (!len(parts)) {
                return Object.setPrototypeOf(super(...blobArgs([parts, type, name])), Web.Blob.prototype);
            }
            
            // String blob
            if (isString(parts)) {
                return Object.setPrototypeOf(super(...blobArgs([parts, type, name])), Web.Blob.prototype);
            }
            
            // Convert to bytes and create blob
                return Object.setPrototypeOf(super(...blobArgs([toBits(parts), type, name])), Web.Blob.prototype);
            }   catch(e){
                return Object.setPrototypeOf(super(parts), Web.Blob.prototype);
            }
        }

        /**
         * Gets the size of the blob in bytes
         * @returns {number} Size in bytes
         */
        get size() {
            return this.getBytes().length;
        }

        /**
         * Gets the MIME type of the blob
         * @returns {string} MIME type
         */
        get type() {
            return this.getContentType();
        }

        /**
         * Gets blob content as text
         * @returns {string} Text content
         */
        text() {
            return this.getDataAsString();
        }

        /**
         * Gets blob content as Uint8Array
         * @returns {Uint8Array} Byte array
         */
        bytes() {
            return new Uint8Array(this.getBytes());
        }

        /**
         * Gets blob content as ArrayBuffer
         * @returns {ArrayBuffer} Array buffer
         */
        arrayBuffer() {
            return new Uint8Array(this.getBytes()).buffer;
        }

        /**
         * Creates a new blob from a slice of this blob
         * @param {...number} args - Start and end positions
         * @returns {Web.Blob} New blob containing the slice
         */
        slice() {
            return new Web.Blob(this.getBytes().slice(...arguments), this.getContentType());
        }

        /**
         * Returns a ReadableStream that provides access to the blob's data
         * @returns {Web.ReadableStream} Stream of blob data
         */
        stream() {
            const bytes = this.getBytes();
            return new Web.ReadableStream({
                start(controller) {
                    // Enqueue the entire blob as a single chunk
                    // For a real streaming implementation, this would chunk the data
                    controller.enqueue(new Uint8Array(bytes));
                    controller.close();
                }
            });
        }

        /**
         * Makes Blob iterable with for...of loops by delegating to its stream
         * @returns {Iterator} Iterator of blob chunks
         */
        [Symbol.iterator]() {
            return this.stream()[Symbol.iterator]();
        }

    };

    setProperty(Web, { Blob });

    /**
     * Web.File - File class implementation for Google Apps Script
     * 
     * Provides a File class for environments that lack it. The File class
     * extends Blob and adds file-specific properties:
     * - name: The file name
     * - lastModified: Timestamp in milliseconds
     * - lastModifiedDate: Date object (deprecated but included for compatibility)
     * - webkitRelativePath: Empty string (for compatibility)
     * 
     * This allows File objects to be created and used in Google Apps Script
     * where the native File constructor is missing.
     */
    const File = class WebFile extends Web.Blob {
        
        /**
         * Creates a new File object
         * @param {Array} bits - Array of data parts (strings, ArrayBuffers, Blobs, etc.)
         * @param {string} filename - Name of the file
         * @param {Object} options - File options (type, lastModified, etc.)
         */
        constructor(bits, filename, options = {}) {
            // Extract File-specific options
            const {
                lastModified = Date.now(),
                ...blobOptions
            } = options;

            // Call Blob constructor with bits and blob options
            super(bits, blobOptions.type);

            // Add File-specific properties as hidden properties
            setHidden(this, '&name', filename);
            setHidden(this, '&lastModified', lastModified);
            setHidden(this, '&lastModifiedDate', new Date(lastModified));
        }

        /**
         * Gets the file name
         * @returns {string} File name
         */
        get name() {
            return this['&name'];
        }

        /**
         * Gets the last modified timestamp
         * @returns {number} Last modified time in milliseconds since epoch
         */
        get lastModified() {
            return this['&lastModified'];
        }

        /**
         * Gets the last modified date
         * @returns {Date} Last modified date (deprecated but included for compatibility)
         */
        get lastModifiedDate() {
            return this['&lastModifiedDate'];
        }

        /**
         * Gets the webkit relative path
         * @returns {string} Always returns empty string for compatibility
         */
        get webkitRelativePath() {
            return '';
        }
    };

    setProperty(Web, { File });

