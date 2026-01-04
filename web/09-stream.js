
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

    
