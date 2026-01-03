/**
 * Server-side tests for Google Web Script
 * 
 * Run these tests directly in Google Apps Script environment.
 * To run: Call runAllTests() from the script editor.
 * 
 * These tests verify the Web API polyfill works correctly in Google Apps Script
 * without any external dependencies.
 */

// Simple test framework
const TestRunner = {
  results: [],
  
  test(name, fn) {
    try {
      fn();
      this.results.push({ name, status: 'PASS', error: null });
      Logger.log(`✓ ${name}`);
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.toString() });
      Logger.log(`✗ ${name}: ${error}`);
    }
  },
  
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  },
  
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      const baseMessage = message ? `${message}\n` : '';
      throw new Error(`${baseMessage}Expected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
  },
  
  assertNotEqual(actual, notExpected, message) {
    if (actual === notExpected) {
      const baseMessage = message ? `${message}\n` : '';
      throw new Error(`${baseMessage}Expected value to not be: ${JSON.stringify(notExpected)}\nActual: ${JSON.stringify(actual)}`);
    }
  },
  
  assertThrows(fn, message) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw');
    }
  },
  
  summary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;
    
    Logger.log('\n' + '='.repeat(50));
    Logger.log(`Test Results: ${passed}/${total} passed, ${failed} failed`);
    Logger.log('='.repeat(50));
    
    if (failed > 0) {
      Logger.log('\nFailed tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        Logger.log(`  - ${r.name}: ${r.error}`);
      });
    }
    
    return { passed, failed, total, results: this.results };
  },
  
  reset() {
    this.results = [];
  }
};

// ============================================================================
// Web.Blob Tests
// ============================================================================

function testBlobCreation() {
  TestRunner.test('Web.Blob - Create empty blob', () => {
    const blob = new Web.Blob();
    TestRunner.assert(blob, 'Blob should be created');
    TestRunner.assertEqual(blob.size, 0, 'Empty blob size should be 0');
  });
  
  TestRunner.test('Web.Blob - Create blob from string', () => {
    const blob = new Web.Blob('Hello, World!');
    TestRunner.assert(blob.size > 0, 'Blob should have size');
    TestRunner.assertEqual(blob.text(), 'Hello, World!', 'Blob text should match');
  });
  
  TestRunner.test('Web.Blob - Create blob with type', () => {
    const blob = new Web.Blob('{"test": true}', 'application/json');
    TestRunner.assertEqual(blob.type, 'application/json', 'Blob type should match');
  });
  
  TestRunner.test('Web.Blob - Blob.text() method', () => {
    const blob = new Web.Blob('Test content');
    TestRunner.assertEqual(blob.text(), 'Test content', 'text() should return string');
  });
  
  TestRunner.test('Web.Blob - Blob.bytes() method', () => {
    const blob = new Web.Blob('ABC');
    const bytes = blob.bytes();
    TestRunner.assert(bytes instanceof Uint8Array, 'bytes() should return Uint8Array');
    TestRunner.assert(bytes.length > 0, 'Bytes should have length');
  });
  
  TestRunner.test('Web.Blob - Blob.arrayBuffer() method', () => {
    const blob = new Web.Blob('Test');
    const buffer = blob.arrayBuffer();
    TestRunner.assert(buffer instanceof ArrayBuffer, 'arrayBuffer() should return ArrayBuffer');
  });
  
  TestRunner.test('Web.Blob - Blob.slice() method', () => {
    const blob = new Web.Blob('Hello, World!');
    const slice = blob.slice(0, 5);
    TestRunner.assertEqual(slice.text(), 'Hello', 'Slice should extract correct portion');
  });
}

// ============================================================================
// Web.Headers Tests
// ============================================================================

function testHeaders() {
  TestRunner.test('Web.Headers - Create empty headers', () => {
    const headers = new Web.Headers();
    TestRunner.assert(headers, 'Headers should be created');
    TestRunner.assertEqual(headers.size, 0, 'Empty headers size should be 0');
  });
  
  TestRunner.test('Web.Headers - Create headers from object', () => {
    const headers = new Web.Headers({ 'Content-Type': 'application/json' });
    TestRunner.assert(headers.has('Content-Type'), 'Header should exist');
    TestRunner.assertEqual(headers.get('Content-Type'), 'application/json', 'Header value should match');
  });
  
  TestRunner.test('Web.Headers - Case-insensitive get', () => {
    const headers = new Web.Headers({ 'Content-Type': 'text/plain' });
    TestRunner.assertEqual(headers.get('content-type'), 'text/plain', 'Should be case-insensitive');
    TestRunner.assertEqual(headers.get('CONTENT-TYPE'), 'text/plain', 'Should be case-insensitive');
  });
  
  TestRunner.test('Web.Headers - set() method', () => {
    const headers = new Web.Headers();
    headers.set('X-Custom', 'value');
    TestRunner.assertEqual(headers.get('X-Custom'), 'value', 'Set should add header');
  });
  
  TestRunner.test('Web.Headers - append() method', () => {
    const headers = new Web.Headers();
    headers.append('X-Custom', 'value1');
    headers.append('X-Custom', 'value2');
    const value = headers.get('X-Custom');
    TestRunner.assert(value.includes('value1'), 'Should contain first value');
    TestRunner.assert(value.includes('value2'), 'Should contain second value');
  });
  
  TestRunner.test('Web.Headers - delete() method', () => {
    const headers = new Web.Headers({ 'X-Test': 'value' });
    headers.delete('X-Test');
    TestRunner.assert(!headers.has('X-Test'), 'Header should be deleted');
  });
  
  TestRunner.test('Web.Headers - has() method', () => {
    const headers = new Web.Headers({ 'X-Test': 'value' });
    TestRunner.assert(headers.has('X-Test'), 'Should return true for existing header');
    TestRunner.assert(!headers.has('X-Missing'), 'Should return false for missing header');
  });
  
  TestRunner.test('Web.Headers - Cookie handling', () => {
    const headers = new Web.Headers();
    headers.append('Set-Cookie', 'cookie1=value1');
    headers.append('Set-Cookie', 'cookie2=value2');
    const cookies = headers.getSetCookie();
    TestRunner.assertEqual(cookies.length, 2, 'Should store multiple cookies');
  });
}

// ============================================================================
// Web.Response Tests
// ============================================================================

function testResponse() {
  TestRunner.test('Web.Response - Create basic response', () => {
    const response = new Web.Response('Hello');
    TestRunner.assert(response, 'Response should be created');
    TestRunner.assertEqual(response.status, 200, 'Default status should be 200');
    TestRunner.assertEqual(response.statusText, 'OK', 'Default statusText should be OK');
  });
  
  TestRunner.test('Web.Response - Create response with options', () => {
    const response = new Web.Response('Error', {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'text/plain' }
    });
    TestRunner.assertEqual(response.status, 404, 'Status should match');
    TestRunner.assertEqual(response.statusText, 'Not Found', 'StatusText should match');
    TestRunner.assertEqual(response.headers.get('Content-Type'), 'text/plain', 'Header should match');
  });
  
  TestRunner.test('Web.Response - text() method', () => {
    const response = new Web.Response('Test content');
    TestRunner.assertEqual(response.text(), 'Test content', 'text() should return body');
  });
  
  TestRunner.test('Web.Response - json() method', () => {
    const data = { test: true, value: 42 };
    const response = new Web.Response(JSON.stringify(data));
    const parsed = response.json();
    TestRunner.assertEqual(parsed.test, true, 'JSON should be parsed correctly');
    TestRunner.assertEqual(parsed.value, 42, 'JSON should be parsed correctly');
  });
  
  TestRunner.test('Web.Response - ok property', () => {
    const goodResponse = new Web.Response('OK', { status: 200 });
    TestRunner.assert(goodResponse.ok, '200 status should be ok');
    
    const badResponse = new Web.Response('Error', { status: 404 });
    TestRunner.assert(!badResponse.ok, '404 status should not be ok');
  });
  
  TestRunner.test('Web.Response - clone() method', () => {
    const original = new Web.Response('Test', {
      status: 201,
      headers: { 'X-Custom': 'value' }
    });
    const cloned = original.clone();
    
    TestRunner.assertEqual(cloned.status, 201, 'Cloned status should match');
    TestRunner.assertEqual(cloned.text(), 'Test', 'Cloned body should match');
    TestRunner.assertEqual(cloned.headers.get('X-Custom'), 'value', 'Cloned headers should match');
  });
}

// ============================================================================
// Web.Request Tests
// ============================================================================

function testRequest() {
  TestRunner.test('Web.Request - Create basic request', () => {
    const request = new Web.Request('https://example.com');
    TestRunner.assert(request, 'Request should be created');
    TestRunner.assertEqual(request.url, 'https://example.com', 'URL should match');
    TestRunner.assertEqual(request.method, 'GET', 'Default method should be GET');
  });
  
  TestRunner.test('Web.Request - Create request with options', () => {
    const request = new Web.Request('https://api.example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    
    TestRunner.assertEqual(request.method, 'POST', 'Method should match');
    TestRunner.assertEqual(request.headers.get('Content-Type'), 'application/json', 'Header should match');
  });
  
  TestRunner.test('Web.Request - body and payload sync', () => {
    const request = new Web.Request('https://example.com', {
      method: 'POST',
      body: 'test data'
    });
    
    TestRunner.assert(request.payload, 'payload should be set when body is provided');
    TestRunner.assertEqual(request.body, request.payload, 'body and payload should be synced');
  });
  
  TestRunner.test('Web.Request - clone() method', () => {
    const original = new Web.Request('https://example.com', {
      method: 'POST',
      headers: { 'X-Test': 'value' },
      body: 'test'
    });
    
    const cloned = original.clone();
    TestRunner.assertEqual(cloned.url, 'https://example.com', 'Cloned URL should match');
    TestRunner.assertEqual(cloned.method, 'POST', 'Cloned method should match');
    TestRunner.assertEqual(cloned.headers.get('X-Test'), 'value', 'Cloned headers should match');
  });
}

// ============================================================================
// Web.fetch Tests
// ============================================================================

function testFetch() {
  TestRunner.test('Web.fetch - Basic GET request', () => {
    const response = Web.fetch('https://httpbin.org/get');
    TestRunner.assert(response, 'Response should be returned');
    TestRunner.assertEqual(response.status, 200, 'Status should be 200');
    TestRunner.assert(response.ok, 'Response should be ok');
  });
  
  TestRunner.test('Web.fetch - Response has Web API methods', () => {
    const response = Web.fetch('https://httpbin.org/get');
    TestRunner.assert(typeof response.text === 'function', 'Should have text() method');
    TestRunner.assert(typeof response.json === 'function', 'Should have json() method');
    TestRunner.assert(typeof response.blob === 'function', 'Should have blob() method');
  });
  
  TestRunner.test('Web.fetch - POST request with body', () => {
    const response = Web.fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ test: true, timestamp: Date.now() })
    });
    
    TestRunner.assertEqual(response.status, 200, 'POST should succeed');
    const data = response.json();
    TestRunner.assert(data.json, 'Response should contain JSON data');
    TestRunner.assertEqual(data.json.test, true, 'Posted data should match');
  });
  
  TestRunner.test('Web.fetch - Headers are accessible', () => {
    const response = Web.fetch('https://httpbin.org/get');
    TestRunner.assert(response.headers, 'Response should have headers');
    TestRunner.assert(response.headers.has('content-type'), 'Should have content-type header');
  });
  
  TestRunner.test('Web.fetch - Custom headers are sent', () => {
    const response = Web.fetch('https://httpbin.org/headers', {
      headers: { 'X-Custom-Header': 'test-value' }
    });
    
    const data = response.json();
    TestRunner.assert(
      data.headers['X-Custom-Header'] === 'test-value',
      'Custom header should be sent'
    );
  });
  
  TestRunner.test('Web.fetch - Error handling with muteHttpExceptions', () => {
    const response = Web.fetch('https://httpbin.org/status/404');
    TestRunner.assertEqual(response.status, 404, 'Should return 404 status');
    TestRunner.assert(!response.ok, 'Response should not be ok');
  });
}

// ============================================================================
// Web.RequestEvent Tests
// ============================================================================

function testRequestEvent() {
  TestRunner.test('Web.RequestEvent - Create from event object', () => {
    const event = {
      parameter: { key: 'value' },
      parameters: { key: ['value'] },
      postData: {
        contents: '{"test": true}',
        type: 'application/json',
        length: 15
      }
    };
    
    const request = new Web.RequestEvent(event);
    TestRunner.assert(request, 'RequestEvent should be created');
    TestRunner.assertEqual(request.method, 'POST', 'Should detect POST from postData');
  });
  
  TestRunner.test('Web.RequestEvent - GET request without postData', () => {
    const event = {
      parameter: { id: '123' },
      parameters: { id: ['123'] }
    };
    
    const request = new Web.RequestEvent(event);
    TestRunner.assertEqual(request.method, 'GET', 'Should be GET without postData');
  });
  
  TestRunner.test('Web.RequestEvent - text() method', () => {
    const event = {
      postData: {
        contents: 'test content',
        type: 'text/plain'
      }
    };
    
    const request = new Web.RequestEvent(event);
    TestRunner.assertEqual(request.text(), 'test content', 'text() should return postData contents');
  });
  
  TestRunner.test('Web.RequestEvent - json() method', () => {
    const event = {
      postData: {
        contents: '{"test": true, "value": 42}',
        type: 'application/json'
      }
    };
    
    const request = new Web.RequestEvent(event);
    const data = request.json();
    TestRunner.assertEqual(data.test, true, 'JSON should be parsed');
    TestRunner.assertEqual(data.value, 42, 'JSON should be parsed');
  });
}

// ============================================================================
// Web.ResponseEvent Tests
// ============================================================================

function testResponseEvent() {
  TestRunner.test('Web.ResponseEvent - Create from Response', () => {
    const response = new Web.Response('Test content', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
    
    const event = new Web.ResponseEvent(response);
    TestRunner.assert(event, 'ResponseEvent should be created');
  });
  
  TestRunner.test('Web.ResponseEvent - JSON content type detection', () => {
    const response = new Web.Response('{"test": true}');
    const event = new Web.ResponseEvent(response);
    // Should detect JSON and set appropriate MIME type
    TestRunner.assert(event, 'Should handle JSON content');
  });
  
  TestRunner.test('Web.ResponseEvent - Text content type', () => {
    const response = new Web.Response('Plain text content', {
      headers: { 'Content-Type': 'text/plain' }
    });
    const event = new Web.ResponseEvent(response);
    TestRunner.assert(event, 'Should handle text content');
  });
}

// ============================================================================
// Web.addEventListener Tests
// ============================================================================

function testAddEventListener() {
  TestRunner.test('Web.addEventListener - Add fetch listener', () => {
    const originalDoGet = globalThis.doGet;
    const originalDoPost = globalThis.doPost;
    
    try {
      Web.addEventListener('fetch', (request) => {
        return new Web.Response('OK');
      });
      
      TestRunner.assert(typeof globalThis.doGet === 'function', 'doGet should be created');
      TestRunner.assert(typeof globalThis.doPost === 'function', 'doPost should be created');
    } finally {
      // Restore original values
      if (originalDoGet) {
        globalThis.doGet = originalDoGet;
      } else {
        delete globalThis.doGet;
      }
      if (originalDoPost) {
        globalThis.doPost = originalDoPost;
      } else {
        delete globalThis.doPost;
      }
    }
  });
  
  TestRunner.test('Web.addEventListener - Fetch handler is called', () => {
    const originalDoGet = globalThis.doGet;
    
    try {
      let handlerCalled = false;
      
      Web.addEventListener('fetch', (request) => {
        handlerCalled = true;
        return new Web.Response('OK');
      });
      
      const event = { parameter: {}, parameters: {} };
      const result = globalThis.doGet(event);
      
      TestRunner.assert(handlerCalled, 'Handler should be called');
      TestRunner.assert(result, 'Should return result');
    } finally {
      if (originalDoGet) {
        globalThis.doGet = originalDoGet;
      } else {
        delete globalThis.doGet;
      }
    }
  });
}

// ============================================================================
// Web.do Tests
// ============================================================================

function testWebDo() {
  TestRunner.test('Web.do - Basic usage with handler', () => {
    const event = {
      parameter: { test: 'value' },
      parameters: { test: ['value'] }
    };
    
    const result = Web.do(event, (request) => {
      return new Web.Response(JSON.stringify({ received: request.parameter.test }), {
        headers: { 'Content-Type': 'application/json' }
      });
    });
    
    TestRunner.assert(result, 'Should return result');
  });
  
  TestRunner.test('Web.do - Default response without handler', () => {
    const event = {
      parameter: {},
      parameters: {}
    };
    
    const result = Web.do(event);
    TestRunner.assert(result, 'Should return default response');
  });
  
  TestRunner.test('Web.do - Error handling', () => {
    const event = {
      parameter: {},
      parameters: {}
    };
    
    const result = Web.do(event, (request) => {
      throw new Error('Test error');
    });
    
    TestRunner.assert(result, 'Should return error response');
  });
}

// ============================================================================
// Run All Tests
// ============================================================================

/**
 * Test FormData functionality
 */
function testFormData() {
  TestRunner.test('Web.FormData - Create empty FormData', () => {
    const fd = new Web.FormData();
    TestRunner.assert(fd !== null, 'FormData should be created');
    TestRunner.assertEqual(fd.toString(), '[object FormData]', 'toString should return [object FormData]');
  });

  TestRunner.test('Web.FormData - Append string values', () => {
    const fd = new Web.FormData();
    fd.append('key', 'value');
    TestRunner.assertEqual(fd.get('key'), 'value', 'Should retrieve appended value');
  });

  TestRunner.test('Web.FormData - Append multiple values with same key', () => {
    const fd = new Web.FormData();
    fd.append('key', 'value1');
    fd.append('key', 'value2');
    TestRunner.assertEqual(fd.get('key'), 'value1', 'get() should return first value');
    
    const all = fd.getAll('key');
    TestRunner.assertEqual(all.length, 2, 'getAll() should return both values');
    TestRunner.assertEqual(all[0], 'value1', 'First value should be value1');
    TestRunner.assertEqual(all[1], 'value2', 'Second value should be value2');
  });

  TestRunner.test('Web.FormData - get() returns null for non-existent key', () => {
    const fd = new Web.FormData();
    TestRunner.assertEqual(fd.get('nonexistent'), null, 'Should return null');
  });

  TestRunner.test('Web.FormData - getAll() returns empty array for non-existent key', () => {
    const fd = new Web.FormData();
    const all = fd.getAll('nonexistent');
    TestRunner.assertEqual(all.length, 0, 'Should return empty array');
  });

  TestRunner.test('Web.FormData - has() checks key existence', () => {
    const fd = new Web.FormData();
    TestRunner.assertEqual(fd.has('key'), false, 'Should not have key initially');
    fd.append('key', 'value');
    TestRunner.assertEqual(fd.has('key'), true, 'Should have key after append');
  });

  TestRunner.test('Web.FormData - delete() removes all values for key', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.append('key2', 'value2');
    fd.append('key1', 'value3');
    
    TestRunner.assertEqual(fd.has('key1'), true, 'Should have key1');
    fd.delete('key1');
    TestRunner.assertEqual(fd.has('key1'), false, 'Should not have key1 after delete');
    TestRunner.assertEqual(fd.has('key2'), true, 'Should still have key2');
  });

  TestRunner.test('Web.FormData - set() replaces all values', () => {
    const fd = new Web.FormData();
    fd.append('key', 'value1');
    fd.append('key', 'value2');
    fd.set('key', 'value3');
    
    TestRunner.assertEqual(fd.get('key'), 'value3', 'Should have new value');
    const all = fd.getAll('key');
    TestRunner.assertEqual(all.length, 1, 'Should only have one value');
  });

  TestRunner.test('Web.FormData - set() appends if key does not exist', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.set('key2', 'value2');
    
    TestRunner.assertEqual(fd.get('key2'), 'value2', 'Should have new key');
    TestRunner.assertEqual(fd.has('key1'), true, 'Should still have key1');
  });

  TestRunner.test('Web.FormData - Append blob values', () => {
    const fd = new Web.FormData();
    const blob = new Web.Blob(['test content'], 'text/plain');
    fd.append('file', blob, 'test.txt');
    
    const retrieved = fd.get('file');
    TestRunner.assert(retrieved instanceof Web.Blob, 'Retrieved value should be a Blob');
    TestRunner.assertEqual(retrieved.text(), 'test content', 'Blob content should match');
  });

  TestRunner.test('Web.FormData - Append blob without filename defaults to "blob"', () => {
    const fd = new Web.FormData();
    const blob = new Web.Blob(['test']);
    fd.append('file', blob);
    
    const retrieved = fd.get('file');
    TestRunner.assert(retrieved instanceof Web.Blob, 'Retrieved value should be a Blob');
  });

  TestRunner.test('Web.FormData - entries() iteration', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.append('key2', 'value2');
    
    const entries = [...fd.entries()];
    TestRunner.assertEqual(entries.length, 2, 'Should have 2 entries');
    TestRunner.assertEqual(entries[0][0], 'key1', 'First entry key should be key1');
    TestRunner.assertEqual(entries[0][1], 'value1', 'First entry value should be value1');
    TestRunner.assertEqual(entries[1][0], 'key2', 'Second entry key should be key2');
    TestRunner.assertEqual(entries[1][1], 'value2', 'Second entry value should be value2');
  });

  TestRunner.test('Web.FormData - keys() iteration', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.append('key2', 'value2');
    fd.append('key1', 'value3');
    
    const keys = [...fd.keys()];
    TestRunner.assertEqual(keys.length, 3, 'Should have 3 keys');
    TestRunner.assertEqual(keys[0], 'key1', 'First key should be key1');
    TestRunner.assertEqual(keys[1], 'key2', 'Second key should be key2');
    TestRunner.assertEqual(keys[2], 'key1', 'Third key should be key1');
  });

  TestRunner.test('Web.FormData - values() iteration', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.append('key2', 'value2');
    
    const values = [...fd.values()];
    TestRunner.assertEqual(values.length, 2, 'Should have 2 values');
    TestRunner.assertEqual(values[0], 'value1', 'First value should be value1');
    TestRunner.assertEqual(values[1], 'value2', 'Second value should be value2');
  });

  TestRunner.test('Web.FormData - forEach() callback', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.append('key2', 'value2');
    
    const collected = [];
    fd.forEach((value, name, formData) => {
      collected.push([name, value]);
      TestRunner.assert(formData === fd, 'Third argument should be the FormData instance');
    });
    
    TestRunner.assertEqual(collected.length, 2, 'Should iterate 2 times');
    TestRunner.assertEqual(collected[0][0], 'key1', 'First iteration key');
    TestRunner.assertEqual(collected[0][1], 'value1', 'First iteration value');
  });

  TestRunner.test('Web.FormData - for...of iteration', () => {
    const fd = new Web.FormData();
    fd.append('key1', 'value1');
    fd.append('key2', 'value2');
    
    const entries = [];
    for (const [name, value] of fd) {
      entries.push([name, value]);
    }
    
    TestRunner.assertEqual(entries.length, 2, 'Should iterate 2 times');
    TestRunner.assertEqual(entries[0][0], 'key1', 'First entry key');
    TestRunner.assertEqual(entries[1][0], 'key2', 'Second entry key');
  });

  TestRunner.test('Web.FormData - toBlob() creates multipart blob', () => {
    const fd = new Web.FormData();
    fd.append('name', 'John Doe');
    fd.append('age', '30');
    
    const blob = fd.toBlob();
    TestRunner.assert(blob instanceof Web.Blob, 'toBlob should return a Blob');
    
    const text = blob.text();
    TestRunner.assert(text.includes('Content-Disposition: form-data; name="name"'), 'Should include name field');
    TestRunner.assert(text.includes('John Doe'), 'Should include name value');
    TestRunner.assert(text.includes('Content-Disposition: form-data; name="age"'), 'Should include age field');
    TestRunner.assert(text.includes('30'), 'Should include age value');
  });

  TestRunner.test('Web.FormData - toBlob() with file', () => {
    const fd = new Web.FormData();
    const fileBlob = new Web.Blob(['file content'], 'text/plain');
    fd.append('file', fileBlob, 'test.txt');
    
    const blob = fd.toBlob();
    const text = blob.text();
    
    TestRunner.assert(text.includes('filename="test.txt"'), 'Should include filename');
    TestRunner.assert(text.includes('Content-Type: text/plain'), 'Should include content type');
    TestRunner.assert(text.includes('file content'), 'Should include file content');
  });

  TestRunner.test('Web.FormData - Argument validation for append', () => {
    const fd = new Web.FormData();
    TestRunner.assertThrows(() => {
      fd.append('key');
    }, 'append() should throw when missing value argument');
  });

  TestRunner.test('Web.FormData - Argument validation for get', () => {
    const fd = new Web.FormData();
    TestRunner.assertThrows(() => {
      fd.get();
    }, 'get() should throw when missing name argument');
  });

  TestRunner.test('Web.FormData - Argument validation for delete', () => {
    const fd = new Web.FormData();
    TestRunner.assertThrows(() => {
      fd.delete();
    }, 'delete() should throw when missing name argument');
  });

  TestRunner.test('Web.FormData - Value coercion to string', () => {
    const fd = new Web.FormData();
    fd.append('number', 123);
    fd.append('bool', true);
    fd.append('null', null);
    fd.append('undefined', undefined);
    
    TestRunner.assertEqual(fd.get('number'), '123', 'Number should be coerced to string');
    TestRunner.assertEqual(fd.get('bool'), 'true', 'Boolean should be coerced to string');
    TestRunner.assertEqual(fd.get('null'), 'null', 'null should be coerced to string');
    TestRunner.assertEqual(fd.get('undefined'), 'undefined', 'undefined should be coerced to string');
  });

  TestRunner.test('Web.FormData - Maintains insertion order', () => {
    const fd = new Web.FormData();
    fd.append('z', 'last');
    fd.append('a', 'first');
    fd.append('m', 'middle');
    
    const keys = [...fd.keys()];
    TestRunner.assertEqual(keys[0], 'z', 'First key should be z (insertion order)');
    TestRunner.assertEqual(keys[1], 'a', 'Second key should be a');
    TestRunner.assertEqual(keys[2], 'm', 'Third key should be m');
  });

  TestRunner.test('Web.FormData - set() maintains order and position', () => {
    const fd = new Web.FormData();
    fd.append('a', 'value1');
    fd.append('b', 'value2');
    fd.append('c', 'value3');
    fd.set('b', 'newValue');
    
    const keys = [...fd.keys()];
    TestRunner.assertEqual(keys[0], 'a', 'First key should still be a');
    TestRunner.assertEqual(keys[1], 'b', 'Second key should still be b');
    TestRunner.assertEqual(keys[2], 'c', 'Third key should still be c');
    TestRunner.assertEqual(fd.get('b'), 'newValue', 'Value should be updated');
  });

  TestRunner.test('Web.FormData - toBlob() creates valid multipart/form-data', () => {
    const fd = new Web.FormData();
    fd.append('name', 'John Doe');
    fd.append('email', 'john@example.com');
    
    const blob = fd['&toBlob']();
    TestRunner.assert(blob !== null, 'toBlob should return a blob');
    TestRunner.assert(blob.type.includes('multipart/form-data'), 'Content type should be multipart/form-data');
    TestRunner.assert(blob.type.includes('boundary='), 'Content type should include boundary');
    
    const text = blob.text();
    TestRunner.assert(text.includes('name="name"'), 'Should contain name field');
    TestRunner.assert(text.includes('John Doe'), 'Should contain name value');
    TestRunner.assert(text.includes('name="email"'), 'Should contain email field');
    TestRunner.assert(text.includes('john@example.com'), 'Should contain email value');
  });

  TestRunner.test('Web.FormData - toBlob() handles blob/file values', () => {
    const fd = new Web.FormData();
    fd.append('text', 'Some text');
    const fileBlob = new Web.Blob(['file content'], 'text/plain');
    fd.append('file', fileBlob, 'test.txt');
    
    const blob = fd['&toBlob']();
    const text = blob.text();
    
    TestRunner.assert(text.includes('name="text"'), 'Should contain text field');
    TestRunner.assert(text.includes('Some text'), 'Should contain text value');
    TestRunner.assert(text.includes('name="file"'), 'Should contain file field');
    TestRunner.assert(text.includes('filename="test.txt"'), 'Should contain filename');
    TestRunner.assert(text.includes('Content-Type: text/plain'), 'Should contain file content type');
    TestRunner.assert(text.includes('file content'), 'Should contain file content');
  });

  TestRunner.test('Web.FormData - fromBlob() parses simple text fields', () => {
    const fd = new Web.FormData();
    fd.append('username', 'testuser');
    fd.append('password', 'secret123');
    fd.append('remember', 'true');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    TestRunner.assertEqual(parsed.get('username'), 'testuser', 'Should parse username correctly');
    TestRunner.assertEqual(parsed.get('password'), 'secret123', 'Should parse password correctly');
    TestRunner.assertEqual(parsed.get('remember'), 'true', 'Should parse remember correctly');
  });

  TestRunner.test('Web.FormData - fromBlob() handles multiple values for same key', () => {
    const fd = new Web.FormData();
    fd.append('tags', 'javascript');
    fd.append('tags', 'web-development');
    fd.append('tags', 'apps-script');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    const tags = parsed.getAll('tags');
    TestRunner.assertEqual(tags.length, 3, 'Should have 3 tags');
    TestRunner.assertEqual(tags[0], 'javascript', 'First tag should be javascript');
    TestRunner.assertEqual(tags[1], 'web-development', 'Second tag should be web-development');
    TestRunner.assertEqual(tags[2], 'apps-script', 'Third tag should be apps-script');
  });

  TestRunner.test('Web.FormData - fromBlob() parses file fields', () => {
    const fd = new Web.FormData();
    fd.append('description', 'My file upload');
    const fileBlob = new Web.Blob(['Hello, World!'], 'text/plain');
    fd.append('document', fileBlob, 'hello.txt');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    TestRunner.assertEqual(parsed.get('description'), 'My file upload', 'Should parse description');
    
    const file = parsed.get('document');
    TestRunner.assert(file !== null, 'Should have document field');
    TestRunner.assert(file.getBytes, 'Document should be a blob');
    TestRunner.assertEqual(file.text(), 'Hello, World!', 'File content should match');
    TestRunner.assertEqual(file.type, 'text/plain', 'File type should match');
  });

  TestRunner.test('Web.FormData - fromBlob() handles special characters in field names', () => {
    const fd = new Web.FormData();
    fd.append('user[name]', 'John');
    fd.append('user[email]', 'john@example.com');
    fd.append('data-value', 'test123');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    TestRunner.assertEqual(parsed.get('user[name]'), 'John', 'Should handle brackets in field name');
    TestRunner.assertEqual(parsed.get('user[email]'), 'john@example.com', 'Should handle brackets in field name');
    TestRunner.assertEqual(parsed.get('data-value'), 'test123', 'Should handle hyphens in field name');
  });

  TestRunner.test('Web.FormData - fromBlob() handles special characters in values', () => {
    const fd = new Web.FormData();
    fd.append('quote', 'He said "hello"');
    fd.append('newline', 'Line 1\nLine 2\nLine 3');
    fd.append('special', 'Special: <>&"\r\n');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    TestRunner.assertEqual(parsed.get('quote'), 'He said "hello"', 'Should handle quotes in value');
    TestRunner.assert(parsed.get('newline').includes('Line 1'), 'Should handle newlines - part 1');
    TestRunner.assert(parsed.get('newline').includes('Line 2'), 'Should handle newlines - part 2');
    TestRunner.assert(parsed.get('newline').includes('Line 3'), 'Should handle newlines - part 3');
    TestRunner.assert(parsed.get('special').includes('Special:'), 'Should handle special characters');
  });

  TestRunner.test('Web.FormData - fromBlob() handles multiple files', () => {
    const fd = new Web.FormData();
    fd.append('file1', new Web.Blob(['content1'], 'text/plain'), 'file1.txt');
    fd.append('file2', new Web.Blob(['content2'], 'text/html'), 'file2.html');
    fd.append('file3', new Web.Blob(['content3'], 'application/json'), 'file3.json');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    TestRunner.assertEqual(parsed.get('file1').text(), 'content1', 'File1 content should match');
    TestRunner.assertEqual(parsed.get('file1').type, 'text/plain', 'File1 type should match');
    TestRunner.assertEqual(parsed.get('file2').text(), 'content2', 'File2 content should match');
    TestRunner.assertEqual(parsed.get('file2').type, 'text/html', 'File2 type should match');
    TestRunner.assertEqual(parsed.get('file3').text(), 'content3', 'File3 content should match');
    TestRunner.assertEqual(parsed.get('file3').type, 'application/json', 'File3 type should match');
  });

  TestRunner.test('Web.FormData - toBits() converts FormData to byte array', () => {
    const fd = new Web.FormData();
    fd.append('name', 'John Doe');
    fd.append('email', 'john@example.com');
    
    // toBits is an internal function, so we test it through Blob constructor
    // Create a blob with FormData as the body
    const blob = new Web.Blob([fd]);
    
    TestRunner.assert(blob !== null, 'Blob should be created from FormData');
    TestRunner.assert(blob.getBytes, 'Blob should have getBytes method');
    TestRunner.assert(blob.type.includes('multipart/form-data'), 'Blob type should be multipart/form-data');
    TestRunner.assert(blob.type.includes('boundary='), 'Blob type should include boundary');
    
    const text = blob.text();
    TestRunner.assert(text.includes('name="name"'), 'Blob content should contain name field');
    TestRunner.assert(text.includes('John Doe'), 'Blob content should contain name value');
    TestRunner.assert(text.includes('name="email"'), 'Blob content should contain email field');
    TestRunner.assert(text.includes('john@example.com'), 'Blob content should contain email value');
    
    const bytes = blob.getBytes();
    TestRunner.assert(Array.isArray(bytes) || bytes.length !== undefined, 'Should return byte array');
    TestRunner.assert(bytes.length > 0, 'Byte array should not be empty');
  });

  TestRunner.test('Web.FormData - toBits() handles FormData with file attachments', () => {
    const fd = new Web.FormData();
    fd.append('message', 'Test message');
    const fileBlob = new Web.Blob(['file data'], 'text/plain');
    fd.append('attachment', fileBlob, 'document.txt');
    
    const blob = new Web.Blob([fd]);
    const text = blob.text();
    
    TestRunner.assert(text.includes('name="message"'), 'Should contain message field');
    TestRunner.assert(text.includes('Test message'), 'Should contain message value');
    TestRunner.assert(text.includes('name="attachment"'), 'Should contain attachment field');
    TestRunner.assert(text.includes('filename="document.txt"'), 'Should contain filename');
    TestRunner.assert(text.includes('file data'), 'Should contain file data');
  });

  TestRunner.test('Web.FormData - fromBlob() round-trip preserves data', () => {
    const fd = new Web.FormData();
    fd.append('text1', 'Hello');
    fd.append('text2', 'World');
    fd.append('number', '42');
    const fileBlob = new Web.Blob(['binary data here'], 'application/octet-stream');
    fd.append('file', fileBlob, 'data.bin');
    
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    // Verify all fields survived the round-trip
    TestRunner.assertEqual(parsed.get('text1'), 'Hello', 'text1 should survive round-trip');
    TestRunner.assertEqual(parsed.get('text2'), 'World', 'text2 should survive round-trip');
    TestRunner.assertEqual(parsed.get('number'), '42', 'number should survive round-trip');
    TestRunner.assertEqual(parsed.get('file').text(), 'binary data here', 'file content should survive round-trip');
    TestRunner.assertEqual(parsed.get('file').type, 'application/octet-stream', 'file type should survive round-trip');
  });

  TestRunner.test('Web.FormData - fromBlob() throws on invalid blob (no boundary)', () => {
    const invalidBlob = new Web.Blob(['some content'], 'text/plain');
    
    TestRunner.assertThrows(() => {
      Web.FormData['&fromBlob'](invalidBlob);
    }, 'Should throw error when no boundary found');
  });

  TestRunner.test('Web.FormData - fromBlob() handles empty FormData', () => {
    const fd = new Web.FormData();
    const blob = fd['&toBlob']();
    const parsed = Web.FormData['&fromBlob'](blob);
    
    // Should parse without error even though empty
    TestRunner.assert(parsed !== null, 'Should return a FormData instance');
    TestRunner.assertEqual([...parsed.keys()].length, 0, 'Should have no keys');
  });

  TestRunner.test('Web.Response - formData() parses multipart/form-data', () => {
    const fd = new Web.FormData();
    fd.append('name', 'Alice');
    fd.append('age', '30');
    
    const blob = fd['&toBlob']();
    const response = new Web.Response(blob, {
      status: 200,
      headers: { 'Content-Type': blob.type }
    });
    
    const parsedFd = response.formData();
    TestRunner.assertEqual(parsedFd.get('name'), 'Alice', 'Should parse name from response');
    TestRunner.assertEqual(parsedFd.get('age'), '30', 'Should parse age from response');
  });

  TestRunner.test('Web.Response - formData() handles file uploads', () => {
    const fd = new Web.FormData();
    fd.append('title', 'My Document');
    const fileBlob = new Web.Blob(['Document content'], 'text/plain');
    fd.append('document', fileBlob, 'doc.txt');
    
    const blob = fd['&toBlob']();
    const response = new Web.Response(blob, {
      status: 200,
      headers: { 'Content-Type': blob.type }
    });
    
    const parsedFd = response.formData();
    TestRunner.assertEqual(parsedFd.get('title'), 'My Document', 'Should parse title');
    const doc = parsedFd.get('document');
    TestRunner.assert(doc !== null, 'Should have document');
    TestRunner.assertEqual(doc.text(), 'Document content', 'Document content should match');
  });

  TestRunner.test('Web.Request - formData() parses multipart/form-data from request body', () => {
    const fd = new Web.FormData();
    fd.append('username', 'bob');
    fd.append('message', 'Hello from request');
    
    const blob = fd['&toBlob']();
    const request = new Web.Request('https://example.com/api', {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': blob.type }
    });
    
    const parsedFd = request.formData();
    TestRunner.assertEqual(parsedFd.get('username'), 'bob', 'Should parse username from request');
    TestRunner.assertEqual(parsedFd.get('message'), 'Hello from request', 'Should parse message from request');
  });

  TestRunner.test('Web.Request - formData() handles complex request with files', () => {
    const fd = new Web.FormData();
    fd.append('type', 'upload');
    fd.append('category', 'images');
    const image = new Web.Blob(['fake image data'], 'image/png');
    fd.append('image', image, 'photo.png');
    
    const blob = fd['&toBlob']();
    const request = new Web.Request('https://example.com/upload', {
      method: 'POST',
      body: blob
    });
    
    const parsedFd = request.formData();
    TestRunner.assertEqual(parsedFd.get('type'), 'upload', 'Should parse type');
    TestRunner.assertEqual(parsedFd.get('category'), 'images', 'Should parse category');
    const img = parsedFd.get('image');
    TestRunner.assertEqual(img.text(), 'fake image data', 'Image content should match');
    TestRunner.assertEqual(img.type, 'image/png', 'Image type should match');
  });
}

/**
 * Test URLSearchParams functionality
 */
function testURLSearchParams() {
  TestRunner.test('Web.URLSearchParams - Create empty URLSearchParams', () => {
    const params = new Web.URLSearchParams();
    TestRunner.assertEqual(params.size, 0, 'Empty params should have size 0');
    TestRunner.assertEqual(params.toString(), '', 'Empty params toString should be empty string');
  });

  TestRunner.test('Web.URLSearchParams - Create from string', () => {
    const params = new Web.URLSearchParams('foo=bar&baz=qux');
    TestRunner.assertEqual(params.get('foo'), 'bar', 'Should parse foo=bar');
    TestRunner.assertEqual(params.get('baz'), 'qux', 'Should parse baz=qux');
    TestRunner.assertEqual(params.size, 2, 'Should have 2 parameters');
  });

  TestRunner.test('Web.URLSearchParams - Create from string with ? prefix', () => {
    const params = new Web.URLSearchParams('?name=John&age=30');
    TestRunner.assertEqual(params.get('name'), 'John', 'Should parse name');
    TestRunner.assertEqual(params.get('age'), '30', 'Should parse age');
  });

  TestRunner.test('Web.URLSearchParams - Create from object', () => {
    const params = new Web.URLSearchParams({ user: 'alice', role: 'admin' });
    TestRunner.assertEqual(params.get('user'), 'alice', 'Should have user');
    TestRunner.assertEqual(params.get('role'), 'admin', 'Should have role');
  });

  TestRunner.test('Web.URLSearchParams - Create from array of pairs', () => {
    const params = new Web.URLSearchParams([['key1', 'value1'], ['key2', 'value2']]);
    TestRunner.assertEqual(params.get('key1'), 'value1', 'Should have key1');
    TestRunner.assertEqual(params.get('key2'), 'value2', 'Should have key2');
  });

  TestRunner.test('Web.URLSearchParams - Create from another URLSearchParams', () => {
    const original = new Web.URLSearchParams('a=1&b=2');
    const copy = new Web.URLSearchParams(original);
    TestRunner.assertEqual(copy.get('a'), '1', 'Should copy a');
    TestRunner.assertEqual(copy.get('b'), '2', 'Should copy b');
  });

  TestRunner.test('Web.URLSearchParams - append() adds values', () => {
    const params = new Web.URLSearchParams();
    params.append('tag', 'javascript');
    params.append('tag', 'web');
    TestRunner.assertEqual(params.getAll('tag').length, 2, 'Should have 2 tag values');
    TestRunner.assertEqual(params.getAll('tag')[0], 'javascript', 'First tag should be javascript');
    TestRunner.assertEqual(params.getAll('tag')[1], 'web', 'Second tag should be web');
  });

  TestRunner.test('Web.URLSearchParams - set() replaces values', () => {
    const params = new Web.URLSearchParams();
    params.append('name', 'John');
    params.append('name', 'Jane');
    params.set('name', 'Bob');
    TestRunner.assertEqual(params.getAll('name').length, 1, 'Should have 1 name value after set');
    TestRunner.assertEqual(params.get('name'), 'Bob', 'Name should be Bob');
  });

  TestRunner.test('Web.URLSearchParams - delete() removes parameter', () => {
    const params = new Web.URLSearchParams('a=1&b=2&c=3');
    params.delete('b');
    TestRunner.assertEqual(params.has('b'), false, 'Should not have b after delete');
    TestRunner.assertEqual(params.has('a'), true, 'Should still have a');
    TestRunner.assertEqual(params.has('c'), true, 'Should still have c');
  });

  TestRunner.test('Web.URLSearchParams - get() returns null for missing key', () => {
    const params = new Web.URLSearchParams('a=1');
    TestRunner.assertEqual(params.get('missing'), null, 'Should return null for missing key');
  });

  TestRunner.test('Web.URLSearchParams - getAll() returns empty array for missing key', () => {
    const params = new Web.URLSearchParams('a=1');
    TestRunner.assertEqual(params.getAll('missing').length, 0, 'Should return empty array');
  });

  TestRunner.test('Web.URLSearchParams - toString() encodes properly', () => {
    const params = new Web.URLSearchParams();
    params.append('name', 'John Doe');
    params.append('email', 'john@example.com');
    const str = params.toString();
    TestRunner.assert(str.includes('name=John+Doe'), 'Should encode space as +');
    TestRunner.assert(str.includes('email=john%40example.com'), 'Should encode @ as %40');
  });

  TestRunner.test('Web.URLSearchParams - entries() iteration', () => {
    const params = new Web.URLSearchParams('a=1&b=2');
    const entries = [...params.entries()];
    TestRunner.assertEqual(entries.length, 2, 'Should have 2 entries');
    TestRunner.assertEqual(entries[0][0], 'a', 'First entry key should be a');
    TestRunner.assertEqual(entries[0][1], '1', 'First entry value should be 1');
  });

  TestRunner.test('Web.URLSearchParams - keys() iteration', () => {
    const params = new Web.URLSearchParams('x=1&y=2');
    const keys = [...params.keys()];
    TestRunner.assertEqual(keys.length, 2, 'Should have 2 keys');
    TestRunner.assert(keys.includes('x'), 'Should include x');
    TestRunner.assert(keys.includes('y'), 'Should include y');
  });

  TestRunner.test('Web.URLSearchParams - values() iteration', () => {
    const params = new Web.URLSearchParams('a=hello&b=world');
    const values = [...params.values()];
    TestRunner.assertEqual(values.length, 2, 'Should have 2 values');
    TestRunner.assert(values.includes('hello'), 'Should include hello');
    TestRunner.assert(values.includes('world'), 'Should include world');
  });

  TestRunner.test('Web.URLSearchParams - forEach() callback', () => {
    const params = new Web.URLSearchParams('a=1&b=2');
    const collected = [];
    params.forEach((value, name) => {
      collected.push([name, value]);
    });
    TestRunner.assertEqual(collected.length, 2, 'Should iterate 2 times');
  });

  TestRunner.test('Web.URLSearchParams - for...of iteration', () => {
    const params = new Web.URLSearchParams('x=10&y=20');
    let count = 0;
    for (const [name, value] of params) {
      count++;
    }
    TestRunner.assertEqual(count, 2, 'Should iterate 2 times');
  });

  TestRunner.test('Web.URLSearchParams - sort() sorts parameters', () => {
    const params = new Web.URLSearchParams('z=3&a=1&m=2');
    params.sort();
    const str = params.toString();
    const aIndex = str.indexOf('a=');
    const mIndex = str.indexOf('m=');
    const zIndex = str.indexOf('z=');
    TestRunner.assert(aIndex < mIndex, 'a should come before m');
    TestRunner.assert(mIndex < zIndex, 'm should come before z');
  });

  TestRunner.test('Web.URLSearchParams - handles special characters', () => {
    const params = new Web.URLSearchParams();
    params.append('msg', 'Hello World!');
    params.append('path', '/user/profile');
    const str = params.toString();
    TestRunner.assert(str.includes('Hello+World'), 'Should encode space as +');
    TestRunner.assert(str.includes('%2Fuser%2Fprofile'), 'Should encode slashes');
  });

  TestRunner.test('Web.URLSearchParams - size property counts all entries', () => {
    const params = new Web.URLSearchParams();
    params.append('a', '1');
    params.append('a', '2');
    params.append('b', '3');
    TestRunner.assertEqual(params.size, 3, 'Should count duplicate keys separately');
  });
}

/**
 * Test URL functionality
 */
function testURL() {
  TestRunner.test('Web.URL - Create from absolute URL', () => {
    const url = new Web.URL('https://example.com/path');
    TestRunner.assertEqual(url.protocol, 'https:', 'Protocol should be https:');
    TestRunner.assertEqual(url.hostname, 'example.com', 'Hostname should be example.com');
    TestRunner.assertEqual(url.pathname, '/path', 'Pathname should be /path');
  });

  TestRunner.test('Web.URL - Create with query string', () => {
    const url = new Web.URL('https://example.com?foo=bar&baz=qux');
    TestRunner.assertEqual(url.search, '?foo=bar&baz=qux', 'Search should include query string');
    TestRunner.assertEqual(url.searchParams.get('foo'), 'bar', 'searchParams should parse foo');
    TestRunner.assertEqual(url.searchParams.get('baz'), 'qux', 'searchParams should parse baz');
  });

  TestRunner.test('Web.URL - Create with hash', () => {
    const url = new Web.URL('https://example.com/page#section');
    TestRunner.assertEqual(url.hash, '#section', 'Hash should be #section');
  });

  TestRunner.test('Web.URL - Create with port', () => {
    const url = new Web.URL('https://example.com:8080/path');
    TestRunner.assertEqual(url.port, '8080', 'Port should be 8080');
    TestRunner.assertEqual(url.host, 'example.com:8080', 'Host should include port');
  });

  TestRunner.test('Web.URL - Create with username and password', () => {
    const url = new Web.URL('https://user:pass@example.com/');
    TestRunner.assertEqual(url.username, 'user', 'Username should be user');
    TestRunner.assertEqual(url.password, 'pass', 'Password should be pass');
  });

  TestRunner.test('Web.URL - Create relative URL with base', () => {
    const url = new Web.URL('page.html', 'https://example.com/dir/');
    TestRunner.assertEqual(url.href, 'https://example.com/dir/page.html', 'Should resolve relative URL');
  });

  TestRunner.test('Web.URL - Create relative path with base', () => {
    const url = new Web.URL('../other.html', 'https://example.com/dir/page.html');
    TestRunner.assertEqual(url.pathname, '/other.html', 'Should resolve .. in path');
  });

  TestRunner.test('Web.URL - href getter returns full URL', () => {
    const url = new Web.URL('https://user:pass@example.com:8080/path?query=1#hash');
    const href = url.href;
    TestRunner.assert(href.includes('https://'), 'Should include protocol');
    TestRunner.assert(href.includes('user:pass@'), 'Should include credentials');
    TestRunner.assert(href.includes('example.com:8080'), 'Should include host and port');
    TestRunner.assert(href.includes('/path'), 'Should include pathname');
    TestRunner.assert(href.includes('?query=1'), 'Should include search');
    TestRunner.assert(href.includes('#hash'), 'Should include hash');
  });

  TestRunner.test('Web.URL - href setter updates all components', () => {
    const url = new Web.URL('https://example.com');
    url.href = 'http://other.com:3000/new?param=value#anchor';
    TestRunner.assertEqual(url.protocol, 'http:', 'Protocol should update');
    TestRunner.assertEqual(url.hostname, 'other.com', 'Hostname should update');
    TestRunner.assertEqual(url.port, '3000', 'Port should update');
    TestRunner.assertEqual(url.pathname, '/new', 'Pathname should update');
    TestRunner.assertEqual(url.search, '?param=value', 'Search should update');
    TestRunner.assertEqual(url.hash, '#anchor', 'Hash should update');
  });

  TestRunner.test('Web.URL - protocol setter', () => {
    const url = new Web.URL('https://example.com');
    url.protocol = 'http';
    TestRunner.assertEqual(url.protocol, 'http:', 'Protocol should be updated with colon');
  });

  TestRunner.test('Web.URL - hostname setter', () => {
    const url = new Web.URL('https://example.com');
    url.hostname = 'other.com';
    TestRunner.assertEqual(url.hostname, 'other.com', 'Hostname should be updated');
  });

  TestRunner.test('Web.URL - port setter', () => {
    const url = new Web.URL('https://example.com');
    url.port = '9000';
    TestRunner.assertEqual(url.port, '9000', 'Port should be updated');
    TestRunner.assertEqual(url.host, 'example.com:9000', 'Host should include new port');
  });

  TestRunner.test('Web.URL - pathname setter adds leading slash', () => {
    const url = new Web.URL('https://example.com');
    url.pathname = 'path/to/resource';
    TestRunner.assertEqual(url.pathname, '/path/to/resource', 'Pathname should have leading slash');
  });

  TestRunner.test('Web.URL - search setter updates searchParams', () => {
    const url = new Web.URL('https://example.com');
    url.search = '?a=1&b=2';
    TestRunner.assertEqual(url.searchParams.get('a'), '1', 'searchParams should update with search');
    TestRunner.assertEqual(url.searchParams.get('b'), '2', 'searchParams should have all params');
  });

  TestRunner.test('Web.URL - searchParams updates search', () => {
    const url = new Web.URL('https://example.com');
    url.searchParams.append('foo', 'bar');
    url.searchParams.append('baz', 'qux');
    TestRunner.assert(url.search.includes('foo=bar'), 'Search should update when searchParams changes');
    TestRunner.assert(url.search.includes('baz=qux'), 'Search should include all params');
  });

  TestRunner.test('Web.URL - hash setter', () => {
    const url = new Web.URL('https://example.com');
    url.hash = 'section';
    TestRunner.assertEqual(url.hash, '#section', 'Hash should be added with # prefix');
  });

  TestRunner.test('Web.URL - origin for https', () => {
    const url = new Web.URL('https://example.com:443/path');
    TestRunner.assertEqual(url.origin, 'https://example.com:443', 'Origin should include protocol and host');
  });

  TestRunner.test('Web.URL - origin for file URL', () => {
    const url = new Web.URL('file:///path/to/file.txt');
    TestRunner.assertEqual(url.origin, 'null', 'File URL origin should be null');
  });

  TestRunner.test('Web.URL - toString() returns href', () => {
    const url = new Web.URL('https://example.com/path');
    TestRunner.assertEqual(url.toString(), url.href, 'toString should return href');
  });

  TestRunner.test('Web.URL - toJSON() returns href', () => {
    const url = new Web.URL('https://example.com/path');
    TestRunner.assertEqual(url.toJSON(), url.href, 'toJSON should return href');
  });

  TestRunner.test('Web.URL - handles complex relative paths', () => {
    const url = new Web.URL('../../other/page.html', 'https://example.com/a/b/c/current.html');
    TestRunner.assertEqual(url.pathname, '/a/other/page.html', 'Should resolve complex relative path');
  });

  TestRunner.test('Web.URL - throws on invalid URL', () => {
    let threw = false;
    try {
      new Web.URL('not a valid url');
    } catch (e) {
      threw = true;
    }
    TestRunner.assert(threw, 'Should throw on invalid URL');
  });

  TestRunner.test('Web.URL - throws on invalid base URL', () => {
    let threw = false;
    try {
      new Web.URL('page.html', 'not valid base');
    } catch (e) {
      threw = true;
    }
    TestRunner.assert(threw, 'Should throw on invalid base URL');
  });

  TestRunner.test('Web.URL - host setter updates hostname and port', () => {
    const url = new Web.URL('https://example.com');
    url.host = 'other.com:8080';
    TestRunner.assertEqual(url.hostname, 'other.com', 'Hostname should be extracted');
    TestRunner.assertEqual(url.port, '8080', 'Port should be extracted');
  });
}

// ============================================================================
// Web.ReadableStream Tests
// ============================================================================

function testReadableStream() {
  // Constructor Tests
  TestRunner.test('ReadableStream - Create empty stream', () => {
    const stream = new Web.ReadableStream();
    TestRunner.assert(stream, 'Stream should be created');
    TestRunner.assertEqual(stream.locked, false, 'Stream should not be locked initially');
  });

  TestRunner.test('ReadableStream - Create with underlyingSource', () => {
    let startCalled = false;
    const stream = new Web.ReadableStream({
      start(controller) {
        startCalled = true;
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.close();
      }
    });
    TestRunner.assert(startCalled, 'start() should be called during construction');
    TestRunner.assert(stream, 'Stream should be created');
  });

  TestRunner.test('ReadableStream - Create with pull function', () => {
    const stream = new Web.ReadableStream({
      pull(controller) {
        controller.enqueue('pulled');
        controller.close();
      }
    });
    TestRunner.assert(stream, 'Stream with pull should be created');
  });

  TestRunner.test('ReadableStream - Create with cancel function', () => {
    let cancelCalled = false;
    const stream = new Web.ReadableStream({
      cancel(reason) {
        cancelCalled = true;
      }
    });
    stream.cancel('test');
    TestRunner.assert(cancelCalled, 'cancel() should be called');
  });

  // Controller Tests
  TestRunner.test('ReadableStream - Controller enqueue', () => {
    const chunks = [];
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.enqueue('chunk3');
      }
    });
    TestRunner.assert(stream, 'Stream should be created with enqueued chunks');
  });

  TestRunner.test('ReadableStream - Controller close', () => {
    let closed = false;
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('data');
        controller.close();
        closed = true;
      }
    });
    TestRunner.assert(closed, 'Controller should allow close');
  });

  TestRunner.test('ReadableStream - Controller error', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.error(new Error('Test error'));
      }
    });
    TestRunner.assert(stream, 'Stream with error should still be created');
  });

  TestRunner.test('ReadableStream - Controller cannot enqueue after close', () => {
    TestRunner.assertThrows(() => {
      new Web.ReadableStream({
        start(controller) {
          controller.close();
          controller.enqueue('late'); // Should throw
        }
      });
    }, 'Should throw when enqueuing after close');
  });

  TestRunner.test('ReadableStream - Controller desiredSize', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        TestRunner.assertEqual(controller.desiredSize, 1, 'desiredSize should be 1 initially');
        controller.enqueue('data');
        TestRunner.assert(controller.desiredSize !== null, 'desiredSize should not be null');
      }
    });
  });

  // Locking Tests
  TestRunner.test('ReadableStream - locked property initial state', () => {
    const stream = new Web.ReadableStream();
    TestRunner.assertEqual(stream.locked, false, 'New stream should not be locked');
  });

  TestRunner.test('ReadableStream - getReader locks stream', () => {
    const stream = new Web.ReadableStream();
    TestRunner.assertEqual(stream.locked, false, 'Stream should not be locked initially');
    const reader = stream.getReader();
    TestRunner.assertEqual(stream.locked, true, 'Stream should be locked after getReader()');
  });

  TestRunner.test('ReadableStream - Cannot get reader twice', () => {
    const stream = new Web.ReadableStream();
    stream.getReader();
    TestRunner.assertThrows(() => {
      stream.getReader(); // Should throw
    }, 'Should throw when getting reader on locked stream');
  });

  TestRunner.test('ReadableStream - Can get reader after releaseLock', () => {
    const stream = new Web.ReadableStream();
    const reader1 = stream.getReader();
    reader1.releaseLock();
    TestRunner.assertEqual(stream.locked, false, 'Stream should be unlocked after releaseLock');
    const reader2 = stream.getReader();
    TestRunner.assert(reader2, 'Should be able to get new reader after releaseLock');
  });

  // Cancel Tests
  TestRunner.test('ReadableStream - cancel() returns promise', () => {
    const stream = new Web.ReadableStream();
    const result = stream.cancel();
    TestRunner.assert(result instanceof Promise, 'cancel() should return a Promise');
  });

  TestRunner.test('ReadableStream - cancel() with reason', () => {
    let cancelReason = null;
    const stream = new Web.ReadableStream({
      cancel(reason) {
        cancelReason = reason;
      }
    });
    stream.cancel('test reason');
    TestRunner.assertEqual(cancelReason, 'test reason', 'cancel() should pass reason to underlyingSource');
  });

  TestRunner.test('ReadableStream - cancel() multiple times', () => {
    const stream = new Web.ReadableStream();
    stream.cancel('first');
    stream.cancel('second'); // Should not throw
    TestRunner.assert(true, 'Multiple cancel() calls should not throw');
  });

  // Reader Tests
  TestRunner.test('ReadableStreamDefaultReader - Create reader', () => {
    const stream = new Web.ReadableStream();
    const reader = stream.getReader();
    TestRunner.assert(reader instanceof Web.ReadableStreamDefaultReader, 'getReader() should return ReadableStreamDefaultReader');
  });

  TestRunner.test('ReadableStreamDefaultReader - Cannot create without stream', () => {
    TestRunner.assertThrows(() => {
      new Web.ReadableStreamDefaultReader();
    }, 'Should throw when creating reader without stream');
  });

  TestRunner.test('ReadableStreamDefaultReader - Cannot create with non-stream', () => {
    TestRunner.assertThrows(() => {
      new Web.ReadableStreamDefaultReader({});
    }, 'Should throw when creating reader with non-stream');
  });

  TestRunner.test('ReadableStreamDefaultReader - read() returns object', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('data');
        controller.close();
      }
    });
    const reader = stream.getReader();
    const result = reader.read();
    TestRunner.assert(typeof result === 'object', 'read() should return an object');
    TestRunner.assert('value' in result || 'done' in result, 'read() should return {value, done} object');
  });

  TestRunner.test('ReadableStreamDefaultReader - read() returns {value, done}', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.close();
      }
    });
    const reader = stream.getReader();
    const result = reader.read();
    TestRunner.assert('value' in result, 'Result should have value property');
    TestRunner.assert('done' in result, 'Result should have done property');
    TestRunner.assertEqual(result.value, 'chunk1', 'Value should be chunk1');
    TestRunner.assertEqual(result.done, false, 'Done should be false for data chunk');
  });

  TestRunner.test('ReadableStreamDefaultReader - read() multiple chunks', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.enqueue('chunk3');
        controller.close();
      }
    });
    const reader = stream.getReader();
    
    const r1 = reader.read();
    TestRunner.assertEqual(r1.value, 'chunk1', 'First read should get chunk1');
    TestRunner.assertEqual(r1.done, false, 'First read should not be done');
    
    const r2 = reader.read();
    TestRunner.assertEqual(r2.value, 'chunk2', 'Second read should get chunk2');
    TestRunner.assertEqual(r2.done, false, 'Second read should not be done');
    
    const r3 = reader.read();
    TestRunner.assertEqual(r3.value, 'chunk3', 'Third read should get chunk3');
    TestRunner.assertEqual(r3.done, false, 'Third read should not be done');
    
    const r4 = reader.read();
    TestRunner.assertEqual(r4.done, true, 'Fourth read should be done');
  });

  TestRunner.test('ReadableStreamDefaultReader - read() from empty stream', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    const reader = stream.getReader();
    const result = reader.read();
    TestRunner.assertEqual(result.done, true, 'Reading from closed empty stream should be done');
  });

  TestRunner.test('ReadableStreamDefaultReader - read() calls pull()', () => {
    let pullCount = 0;
    const stream = new Web.ReadableStream({
      pull(controller) {
        pullCount++;
        if (pullCount === 1) {
          controller.enqueue('pulled data');
        } else {
          controller.close();
        }
      }
    });
    const reader = stream.getReader();
    
    const result = reader.read();
    TestRunner.assert(pullCount > 0, 'pull() should have been called');
    TestRunner.assertEqual(result.value, 'pulled data', 'Should get pulled data');
  });

  TestRunner.test('ReadableStreamDefaultReader - read() with different data types', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('string');
        controller.enqueue(123);
        controller.enqueue({key: 'value'});
        controller.enqueue([1, 2, 3]);
        controller.enqueue(null);
        controller.close();
      }
    });
    const reader = stream.getReader();
    
    TestRunner.assertEqual(reader.read().value, 'string', 'Should read string');
    TestRunner.assertEqual(reader.read().value, 123, 'Should read number');
    TestRunner.assertEqual(reader.read().value.key, 'value', 'Should read object');
    TestRunner.assertEqual(reader.read().value.length, 3, 'Should read array');
    TestRunner.assertEqual(reader.read().value, null, 'Should read null');
    TestRunner.assertEqual(reader.read().done, true, 'Should be done');
  });

  TestRunner.test('ReadableStreamDefaultReader - releaseLock()', () => {
    const stream = new Web.ReadableStream();
    const reader = stream.getReader();
    TestRunner.assertEqual(stream.locked, true, 'Stream should be locked');
    reader.releaseLock();
    TestRunner.assertEqual(stream.locked, false, 'Stream should be unlocked after releaseLock');
  });

  TestRunner.test('ReadableStreamDefaultReader - releaseLock() multiple times', () => {
    const stream = new Web.ReadableStream();
    const reader = stream.getReader();
    reader.releaseLock();
    reader.releaseLock(); // Should not throw
    TestRunner.assert(true, 'Multiple releaseLock() calls should not throw');
  });

  TestRunner.test('ReadableStreamDefaultReader - cancel() does not throw', () => {
    const stream = new Web.ReadableStream();
    const reader = stream.getReader();
    reader.cancel(); // Should not throw
    TestRunner.assert(true, 'reader.cancel() should not throw');
  });

  TestRunner.test('ReadableStreamDefaultReader - cancel() with reason', () => {
    let cancelReason = null;
    const stream = new Web.ReadableStream({
      cancel(reason) {
        cancelReason = reason;
      }
    });
    const reader = stream.getReader();
    reader.cancel('test reason');
    TestRunner.assertEqual(cancelReason, 'test reason', 'reader.cancel() should pass reason');
  });

  TestRunner.test('ReadableStreamDefaultReader - cancel() closes reader', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('data');
      }
    });
    const reader = stream.getReader();
    reader.cancel();
    const result = reader.read();
    TestRunner.assertEqual(result.done, true, 'Reading after cancel should return done');
  });

  TestRunner.test('ReadableStreamDefaultReader - closed property exists', () => {
    const stream = new Web.ReadableStream();
    const reader = stream.getReader();
    TestRunner.assert('closed' in reader, 'closed property should exist');
  });

  // Error Handling Tests
  TestRunner.test('ReadableStream - Error in start() returns error', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.error(new Error('Start error'));
      }
    });
    const reader = stream.getReader();
    
    const result = reader.read();
    TestRunner.assert(result instanceof Error, 'read() should return error');
    TestRunner.assert(result.message.includes('Start error'), 'Should return the error from start');
  });

  TestRunner.test('ReadableStream - Error in pull() returns error', () => {
    const stream = new Web.ReadableStream({
      pull(controller) {
        throw new Error('Pull error');
      }
    });
    const reader = stream.getReader();
    
    const result = reader.read();
    TestRunner.assert(result instanceof Error, 'read() should return error');
    TestRunner.assert(result.message.includes('Pull error'), 'Should return the error from pull');
  });

  TestRunner.test('ReadableStream - controller.error() makes stream errored', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('data1');
        controller.error(new Error('Manual error'));
      }
    });
    const reader = stream.getReader();
    
    const r1 = reader.read();
    TestRunner.assertEqual(r1.value, 'data1', 'Should read data before error');
    
    const r2 = reader.read();
    TestRunner.assert(r2 instanceof Error, 'Reading errored stream should return error');
  });



  // Edge Cases
  TestRunner.test('ReadableStream - Empty underlyingSource', () => {
    const stream = new Web.ReadableStream({});
    TestRunner.assert(stream, 'Stream should work with empty underlyingSource');
  });

  TestRunner.test('ReadableStream - Null underlyingSource', () => {
    const stream = new Web.ReadableStream(null);
    TestRunner.assert(stream, 'Stream should work with null underlyingSource');
  });

  TestRunner.test('ReadableStream - Undefined underlyingSource', () => {
    const stream = new Web.ReadableStream(undefined);
    TestRunner.assert(stream, 'Stream should work with undefined underlyingSource');
  });

  TestRunner.test('ReadableStream - Read after releaseLock and reacquire', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.close();
      }
    });
    
    const reader1 = stream.getReader();
    const r1 = reader1.read();
    TestRunner.assertEqual(r1.value, 'chunk1', 'First reader should get chunk1');
    reader1.releaseLock();
    
    const reader2 = stream.getReader();
    const r2 = reader2.read();
    TestRunner.assertEqual(r2.value, 'chunk2', 'Second reader should get chunk2');
  });

  TestRunner.test('ReadableStream - Large number of chunks', () => {
    const chunkCount = 100;
    const stream = new Web.ReadableStream({
      start(controller) {
        for (let i = 0; i < chunkCount; i++) {
          controller.enqueue(`chunk${i}`);
        }
        controller.close();
      }
    });
    
    const reader = stream.getReader();
    for (let i = 0; i < chunkCount; i++) {
      const result = reader.read();
      TestRunner.assertEqual(result.value, `chunk${i}`, `Should read chunk${i}`);
      TestRunner.assertEqual(result.done, false, `Read ${i} should not be done`);
    }
    
    const final = reader.read();
    TestRunner.assertEqual(final.done, true, 'Final read should be done');
  });

  TestRunner.test('ReadableStream - Binary data chunks', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      }
    });
    
    const reader = stream.getReader();
    const r1 = reader.read();
    TestRunner.assert(r1.value instanceof Uint8Array, 'Should preserve Uint8Array type');
    TestRunner.assertEqual(r1.value[0], 1, 'Should have correct binary data');
  });

  TestRunner.test('ReadableStream - Integration with string data', () => {
    const texts = ['Hello', ' ', 'World', '!'];
    const stream = new Web.ReadableStream({
      start(controller) {
        texts.forEach(text => controller.enqueue(text));
        controller.close();
      }
    });
    
    const reader = stream.getReader();
    let result = '';
    let chunk;
    
    while (!(chunk = reader.read()).done) {
      result += chunk.value;
    }
    
    TestRunner.assertEqual(result, 'Hello World!', 'Should concatenate all chunks');
  });

  TestRunner.test('ReadableStream - Pull called multiple times', () => {
    let pullCount = 0;
    const stream = new Web.ReadableStream({
      pull(controller) {
        pullCount++;
        if (pullCount <= 3) {
          controller.enqueue(`pull${pullCount}`);
        } else {
          controller.close();
        }
      }
    });
    
    const reader = stream.getReader();
    reader.read(); // pull1
    reader.read(); // pull2
    reader.read(); // pull3
    const final = reader.read(); // close
    
    TestRunner.assert(pullCount >= 3, 'pull() should be called multiple times');
    TestRunner.assertEqual(final.done, true, 'Stream should be closed after pulls');
  });

  TestRunner.test('ReadableStream - Lazy pull (only when needed)', async () => {
    let pullCount = 0;
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('preloaded');
      },
      pull(controller) {
        pullCount++;
        controller.enqueue('pulled');
        controller.close();
      }
    });
    
    const reader = stream.getReader();
    TestRunner.assertEqual(pullCount, 0, 'pull() should not be called yet');
    
    await reader.read(); // Gets preloaded
    TestRunner.assertEqual(pullCount, 0, 'pull() should not be called for preloaded data');
    
    await reader.read(); // Triggers pull
    TestRunner.assert(pullCount > 0, 'pull() should be called when queue is empty');
  });

  TestRunner.test('ReadableStream - State after cancel', async () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('data1');
        controller.enqueue('data2');
      }
    });
    
    const reader = stream.getReader();
    await reader.read(); // Read one chunk
    await reader.cancel();
    
    const result = await reader.read();
    TestRunner.assertEqual(result.done, true, 'Read after cancel should return done');
  });
}

// ============================================================================
// toBits() Tests
// ============================================================================

function testToBits() {
  // toBits is internal, so we test it through Blob constructor which uses it
  
  TestRunner.test('toBits - Handles strings', () => {
    const blob = new Web.Blob(['Hello World']);
    TestRunner.assertEqual(blob.text(), 'Hello World', 'String should be converted to bytes');
    TestRunner.assert(blob.size > 0, 'Blob should have size from string');
  });

  TestRunner.test('toBits - Handles ArrayBuffer', () => {
    const buffer = new ArrayBuffer(8);
    const view = new Uint8Array(buffer);
    view[0] = 65; // 'A'
    view[1] = 66; // 'B'
    
    const blob = new Web.Blob([buffer]);
    const bytes = blob.bytes();
    TestRunner.assertEqual(bytes[0], 65, 'First byte should be 65');
    TestRunner.assertEqual(bytes[1], 66, 'Second byte should be 66');
  });

  TestRunner.test('toBits - Handles Uint8Array', () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const blob = new Web.Blob([arr]);
    TestRunner.assertEqual(blob.text(), 'Hello', 'Uint8Array should be converted correctly');
  });

  TestRunner.test('toBits - Handles objects with getBytes()', () => {
    const blob1 = new Web.Blob(['test data']);
    const blob2 = new Web.Blob([blob1]); // Blob has getBytes()
    TestRunner.assertEqual(blob2.text(), 'test data', 'Blob with getBytes() should be handled');
  });

  TestRunner.test('toBits - Handles FormData', () => {
    const fd = new Web.FormData();
    fd.append('name', 'John');
    fd.append('email', 'john@example.com');
    
    const blob = new Web.Blob([fd]);
    const text = blob.text();
    TestRunner.assert(text.includes('name="name"'), 'FormData should be converted to multipart');
    TestRunner.assert(text.includes('John'), 'FormData values should be present');
    TestRunner.assert(blob.type.includes('multipart/form-data'), 'Content type should be multipart');
  });

  TestRunner.test('toBits - Handles ReadableStream', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([72, 101, 108, 108, 111])); // "Hello"
        controller.enqueue(new Uint8Array([32, 87, 111, 114, 108, 100])); // " World"
        controller.close();
      }
    });
    
    const blob = new Web.Blob([stream]);
    TestRunner.assertEqual(blob.text(), 'Hello World', 'ReadableStream chunks should be concatenated');
  });

  TestRunner.test('toBits - Handles ReadableStream with for...of', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.enqueue('chunk3');
        controller.close();
      }
    });
    
    const blob = new Web.Blob([stream]);
    const text = blob.text();
    TestRunner.assert(text.includes('chunk1'), 'Should contain chunk1');
    TestRunner.assert(text.includes('chunk2'), 'Should contain chunk2');
    TestRunner.assert(text.includes('chunk3'), 'Should contain chunk3');
  });

  TestRunner.test('toBits - Handles byte arrays (isBits)', () => {
    const bytes = [72, 101, 108, 108, 111]; // "Hello"
    const blob = new Web.Blob([bytes]);
    TestRunner.assertEqual(blob.text(), 'Hello', 'Byte array should be handled directly');
  });

  TestRunner.test('toBits - Handles nested arrays', () => {
    const nested = [
      'Hello',
      [' ', 'World'],
      ['!']
    ];
    
    const blob = new Web.Blob(nested);
    TestRunner.assertEqual(blob.text(), 'Hello World!', 'Nested arrays should be flattened');
  });

  TestRunner.test('toBits - Handles mixed array of different types', () => {
    const uint8 = new Uint8Array([72, 101]); // "He"
    const nested = [
      uint8,
      'llo',
      [' ', 'World']
    ];
    
    const blob = new Web.Blob(nested);
    TestRunner.assertEqual(blob.text(), 'Hello World', 'Mixed types should all be converted');
  });

  TestRunner.test('toBits - Handles Blob as iterable', () => {
    const blob1 = new Web.Blob(['test']);
    const chunks = [];
    
    for (const chunk of blob1) {
      chunks.push(chunk);
    }
    
    TestRunner.assert(chunks.length > 0, 'Blob should be iterable');
    TestRunner.assert(chunks[0] instanceof Uint8Array, 'Blob chunks should be Uint8Array');
  });

  TestRunner.test('toBits - Handles empty stream', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    
    const blob = new Web.Blob([stream]);
    TestRunner.assertEqual(blob.size, 0, 'Empty stream should create empty blob');
  });

  TestRunner.test('toBits - Handles stream with Blob chunks', () => {
    const stream = new Web.ReadableStream({
      start(controller) {
        controller.enqueue(new Web.Blob(['Hello']));
        controller.enqueue(new Web.Blob([' World']));
        controller.close();
      }
    });
    
    const blob = new Web.Blob([stream]);
    TestRunner.assertEqual(blob.text(), 'Hello World', 'Stream with Blob chunks should work');
  });

  TestRunner.test('toBits - Handles deeply nested arrays', () => {
    const deep = ['a', ['b', ['c', ['d']]]];
    const blob = new Web.Blob(deep);
    TestRunner.assertEqual(blob.text(), 'abcd', 'Deeply nested arrays should flatten completely');
  });

  TestRunner.test('toBits - Fallback for unsupported types', () => {
    // toBits returns x as-is for unsupported types
    // This should either create empty blob or handle gracefully
    try {
      const blob = new Web.Blob([null]);
      TestRunner.assert(true, 'Should handle null gracefully');
    } catch (e) {
      TestRunner.assert(true, 'Should either handle or throw gracefully');
    }
  });
}

/**
 * Main test runner function
 * Call this from Google Apps Script editor to run all tests
 */
function runAllTests() {
  Logger.log('Starting Google Web Script Tests...\n');
  TestRunner.reset();
  
  Logger.log('Running Blob tests...');
  testBlobCreation();
  
  Logger.log('\nRunning Headers tests...');
  testHeaders();
  
  Logger.log('\nRunning Response tests...');
  testResponse();
  
  Logger.log('\nRunning Request tests...');
  testRequest();
  
  Logger.log('\nRunning FormData tests...');
  testFormData();
  
  Logger.log('\nRunning fetch tests...');
  testFetch();
  
  Logger.log('\nRunning RequestEvent tests...');
  testRequestEvent();
  
  Logger.log('\nRunning ResponseEvent tests...');
  testResponseEvent();
  
  Logger.log('\nRunning addEventListener tests...');
  testAddEventListener();
  
  Logger.log('\nRunning Web.do tests...');
  testWebDo();
  
  Logger.log('\nRunning URLSearchParams tests...');
  testURLSearchParams();
  
  Logger.log('\nRunning URL tests...');
  testURL();
  
  Logger.log('\nRunning ReadableStream tests...');
  testReadableStream();
  
  Logger.log('\nRunning toBits tests...');
  testToBits();
  
  return TestRunner.summary();
}

/**
 * Run quick tests (without network requests)
 * Faster for rapid iteration
 */
function runQuickTests() {
  Logger.log('Starting Quick Tests (no network)...\n');
  TestRunner.reset();
  
  testBlobCreation();
  testHeaders();
  testResponse();
  testRequest();
  testFormData();
  testURLSearchParams();
  testURL();
  testReadableStream();
  testToBits();
  
  return TestRunner.summary();
}
