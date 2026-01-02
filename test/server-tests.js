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
  
  return TestRunner.summary();
}
