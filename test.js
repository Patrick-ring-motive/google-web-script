
'use strict';

const jest = {
    fn: (fn) => {
        const _function = function(...args) {
            _function.mock.calls.push(args);
            return fn ? fn(...args) : undefined;
        };
        _function.mock = { calls: [] };
        _function.mockReturnValue = () => {};
        _function.mockImplementation = (newFn) => { fn = newFn; };
        return _function;
    }
};

// Mock necessary Google Apps Script global objects
const mockGoogleAppsScriptObjects = () => {
    global.UrlFetchApp = {
        getRequest: jest.fn((url, params) => {
             // A simplified mock that throws for a specific header name for testing isValidHeader
            if (params && params.headers && params.headers['Invalid-Header']) {
                 throw new Error('Invalid header');
            }
            return {url, ...params};
        }),
        fetch: jest.fn(),
    };
    global.ContentService = {
        createTextOutput: jest.fn(text => ({
            text,
            mimeType: null,
            setMimeType: function(mime) { this.mimeType = mime; },
            getMimeType: function() { return this.mimeType; },
            downloadAsFile: jest.fn(),
        })),
        MimeType: {
            JSON: 'application/json',
            TEXT: 'text/plain',
            CSV: 'text/csv',
            JAVASCRIPT: 'application/javascript',
        },
    };
    global.Utilities = {
        newBlob: jest.fn((data, contentType, name) => ({
            data,
            contentType,
            name,
            getBytes: () => (typeof data === 'string' ? [...Buffer.from(data)] : (data || [])),
            getDataAsString: () => (typeof data === 'string' ? data : String(Buffer.from(data || []))),
            getContentType: () => contentType || 'text/plain',
        })),
        parseCsv: jest.fn(),
    };
    global.XmlService = {
        parse: jest.fn(text => {
            if (!text || !text.startsWith('<')) {
                throw new Error('Invalid XML');
            }
            return {};
        }),
    };
    global.HtmlService = {
        createHtmlOutput: jest.fn(html => ({
            html,
            type: 'html'
        })),
    };
    global.ScriptApp = {
        getService: () => ({
            getUrl: () => 'https://script.google.com/macros/s/your_deployment_id/exec',
        }),
    };
};

// Test runner
const tests = [];
const test = (name, fn) => {
    tests.push({ name, fn });
};

const runTests = () => {
    let successes = 0;
    let failures = 0;

    const expect = (actual) => ({
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`Expected ${actual} to be ${expected}`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to be equal to ${JSON.stringify(expected)}`);
            }
        },
        toThrow: (expectedError) => {
            let threw = false;
            let errorMessage = '';
            try {
                actual();
            } catch (e) {
                threw = true;
                errorMessage = e.message;
            }
            if (!threw) {
                throw new Error('Expected function to throw an error');
            }
            if (expectedError && !errorMessage.includes(expectedError)) {
                throw new Error(`Expected error message to include "${expectedError}", but got "${errorMessage}"`);
            }
        },
        toBeInstanceOf(expected) {
            if (!(actual instanceof expected)) {
                throw new Error(`Expected object to be an instance of ${expected.name}`);
            }
        },
        toHaveBeenCalledWith(...args) {
            // This is a simplified mock verification
        },
        toBeTruthy() {
             if (!actual) {
                throw new Error(`Expected ${actual} to be truthy`);
            }
        },
        toBeFalsy() {
            if (actual) {
                throw new Error(`Expected ${actual} to be falsy`);
            }
        }
    });

    // Run all registered tests
    tests.forEach(({ name, fn }) => {
        mockGoogleAppsScriptObjects();
        try {
            fn(expect);
            console.log(`✅ ${name}`);
            successes++;
        } catch (e) {
            console.error(`❌ ${name}`);
            console.error(e.stack);
            failures++;
        }
    });

    console.log(`\nTests finished. ${successes} passed, ${failures} failed.`);
    if (failures > 0) {
        process.exit(1);
    }
};

// Mock globals before loading web.js
mockGoogleAppsScriptObjects();
const fs = require('fs');
eval(fs.readFileSync('web.js','utf8'));

// --- Test Cases ---

test('setProperty should define a non-writable property', (expect) => {
    const obj = {};
    Web.setProperty(obj, { a: 1 });
    expect(obj.a).toBe(1);
    expect(() => { obj.a = 2; }).toThrow("Cannot assign to read only property 'a'");
});

test('Blob constructor should handle different arguments', (expect) => {
    const blob1 = new Web.Blob();
    expect(blob1.getBytes()).toEqual([]);

    const blob2 = new Web.Blob('hello');
    expect(blob2.getDataAsString()).toBe('hello');
    expect(blob2.getContentType()).toBe('text/plain');

    const blob3 = new Web.Blob('hello', 'text/html');
    expect(blob3.getDataAsString()).toBe('hello');
    expect(blob3.getContentType()).toBe('text/html');

    const blob4 = new Web.Blob([1, 2, 3]);
    expect(blob4.getBytes()).toEqual([1, 2, 3]);
});

test('Headers class should handle multiple values for the same header', (expect) => {
    const headers = new Web.Headers();
    headers.append('X-Custom', 'value1');
    headers.append('X-Custom', 'value2');
    expect(headers.get('X-Custom')).toBe('value1, value2');
    expect(headers.getAll('X-Custom')).toEqual(['value1', 'value2']);
});

test('Headers class should handle Set-Cookie correctly', (expect) => {
    const headers = new Web.Headers();
    headers.append('Set-Cookie', 'a=1');
    headers.append('Set-Cookie', 'b=2');
    expect(headers.getAll('Set-Cookie')).toEqual(['a=1', 'b=2']);
    expect(headers.get('Set-Cookie')).toBe('a=1, b=2');
});


test('Response.getAllHeaders should preserve original casing and handle multiple values', (expect) => {
    const headers = new Web.Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-Custom', 'value1');
    headers.append('x-custom', 'value2');
    headers.append('Set-Cookie', 'a=1');
    headers.append('Set-Cookie', 'b=2');

    const response = new Web.Response('', { headers: headers });
    const allHeaders = response.getAllHeaders();

    expect(allHeaders['Content-Type']).toBe('application/json');
    expect(allHeaders['X-Custom']).toEqual(['value1', 'value2']);
    expect(allHeaders['Set-Cookie']).toEqual(['a=1', 'b=2']);
});


test('ResponseEvent should detect JSON content type', (expect) => {
    const jsonBody = '{"a":1}';
    const response = new Web.Response(jsonBody, { headers: new Web.Headers({ 'Content-Type': 'application/json' }) });
    const event = new Web.ResponseEvent(response);
    expect(event.getMimeType()).toBe(ContentService.MimeType.JSON);
});

test('ResponseEvent should detect HTML content type', (expect) => {
    const htmlBody = '<h1>hello</h1>';
    const response = new Web.Response(htmlBody, { headers: new Web.Headers({ 'Content-Type': 'text/html' }) });
    new Web.ResponseEvent(response);
    expect(HtmlService.createHtmlOutput.mock.calls.length).toBe(1);
    expect(HtmlService.createHtmlOutput.mock.calls[0][0]).toBe(htmlBody);
});

test('Request constructor should handle different patterns', (expect) => {
    const req1 = new Web.Request('http://example.com');
    expect(req1.url).toBe('http://example.com');
    expect(req1.method).toBe('GET');

    const req2 = new Web.Request('http://example.com', { method: 'POST' });
    expect(req2.url).toBe('http://example.com');
    expect(req2.method).toBe('POST');

    const req3 = new Web.Request({ url: 'http://example.com', method: 'PUT' });
    expect(req3.url).toBe('http://example.com');
    expect(req3.method).toBe('PUT');

    const req4 = new Web.Request({ url: 'http://example.com', body: 'data' });
    expect(req4.payload).toBe('data');
    expect(req4.body).toBe('data');
});

test('Request constructor should not throw on invalid header, but silently drop it', (expect) => {
    const req = new Web.Request('http://example.com', {
        headers: { 'Invalid-Header': 'value', 'Valid-Header': 'good' }
    });
    expect(req.headers.has('Invalid-Header')).toBeFalsy();
    expect(req.headers.has('Valid-Header')).toBeTruthy();
});

// Start the test runner
runTests();
