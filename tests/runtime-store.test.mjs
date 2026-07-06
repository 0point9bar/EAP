// Tests for the EAP-Runtime clean-room offload store.
// Run: node --test tests/runtime-store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeStore, chunk, OFFLOAD_THRESHOLD_BYTES } from '../layers/eap-runtime/src/store.mjs';

test('chunk packs small paragraphs and caps oversized ones', () => {
  // Small paragraphs pack together up to maxChars (fewer, denser FTS rows).
  assert.deepEqual(chunk('a\n\nb\n\nc'), ['a\n\nb\n\nc']);
  // A tiny cap forces one paragraph per chunk.
  assert.deepEqual(chunk('a\n\nb\n\nc', 1), ['a', 'b', 'c']);
  // A single oversized paragraph is hard-split at the cap.
  const capped = chunk('x'.repeat(5000), 2000);
  assert.equal(capped.length, 3);
  assert.ok(capped.every(p => p.length <= 2000));
});

test('index + search returns exact (lossless) matching chunks, not summaries', () => {
  const s = new RuntimeStore(':memory:');
  const log = 'GET /health 200 4ms\n\nPOST /login 500 db timeout\n\nGET /users 200 12ms';
  const p = s.index('access.log', log);
  assert.ok(p.chunks >= 1);
  const hits = s.search('timeout');
  assert.equal(hits.length, 1);
  assert.match(hits[0].body, /db timeout/);        // exact bytes, not a summary
  assert.equal(hits[0].docId, p.id);
  s.close();
});

test('offload: small content stays inline, large content becomes a pointer', () => {
  const s = new RuntimeStore(':memory:');
  const small = s.offload('note', 'short');
  assert.equal(small.inline, true);
  assert.equal(small.body, 'short');

  const big = 'error line\n\n' + 'noise\n\n'.repeat(30000); // > threshold
  assert.ok(Buffer.byteLength(big.repeat(1)) > OFFLOAD_THRESHOLD_BYTES);
  const off = s.offload('huge.log', big);
  assert.equal(off.inline, false);
  assert.match(off.hint, /kept out of context/);
  // The offloaded content is still retrievable losslessly by pointer.
  const hits = s.search('error', { docId: off.pointer });
  assert.ok(hits.length >= 1);
  assert.match(hits[0].body, /error line/);
  s.close();
});

test('indexing identical content is idempotent (deterministic id, no clock)', () => {
  const s = new RuntimeStore(':memory:');
  const a = s.index('x', 'same content here');
  const b = s.index('x', 'same content here');
  assert.equal(a.id, b.id);
  assert.equal(b.deduped, true);
  assert.equal(s.stats().docs, 1);
  s.close();
});

test('stats reports measured bytes kept out of context (a real sum, not a %)', () => {
  const s = new RuntimeStore(':memory:');
  s.index('a', 'hello world');
  s.index('b', 'another document body');
  const st = s.stats();
  assert.equal(st.docs, 2);
  assert.equal(st.bytesKeptOut, Buffer.byteLength('hello world') + Buffer.byteLength('another document body'));
  s.close();
});

test('search query with FTS punctuation is treated as data, not syntax', () => {
  const s = new RuntimeStore(':memory:');
  s.index('code', 'call foo() then bar()');
  // A raw `foo()` would be an FTS syntax error if not escaped.
  const hits = s.search('foo()');
  assert.ok(hits.length >= 1);
  s.close();
});
