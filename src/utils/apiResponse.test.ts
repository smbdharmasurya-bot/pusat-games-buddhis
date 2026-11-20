import test from 'node:test';
import assert from 'node:assert/strict';
import {
  unwrapApiJsonPayload,
  parseDataImageUri,
  isInternalMediaProxyUrl,
  buildMediaVersionTag,
} from './apiResponse';

test('unwrapApiJsonPayload unwraps valid { success, data } and rejects null/non-JSON safely', () => {
  assert.deepEqual(unwrapApiJsonPayload({ success: true, data: [1, 2, 3] }, 200, true, '/games'), [1, 2, 3]);
  assert.deepEqual(unwrapApiJsonPayload({ revision: 7 }, 200, true, '/sync/state'), { revision: 7 });
  assert.deepEqual(unwrapApiJsonPayload([1, 2], 200, true, '/games'), [1, 2]);

  assert.throws(
    () => unwrapApiJsonPayload(null, 200, true, '/games'),
    /Respons server kosong atau bukan JSON valid/i
  );

  assert.throws(
    () => unwrapApiJsonPayload(null, 502, false, '/games'),
    /HTTP 502/i
  );

  assert.throws(
    () => unwrapApiJsonPayload({ success: false, message: 'Database sibuk' }, 500, false, '/games'),
    /Database sibuk/i
  );

  assert.throws(
    () => unwrapApiJsonPayload({ success: false, message: 'Token tidak valid' }, 200, true, '/games'),
    /Token tidak valid/i
  );
});

test('parseDataImageUri decodes valid base64 image URIs and ignores non-data URLs', () => {
  const sampleBase64 = Buffer.from('hello-webp').toString('base64');
  const parsed = parseDataImageUri(`data:image/webp;base64,${sampleBase64}`);
  assert.ok(parsed);
  assert.equal(parsed.mimeType, 'image/webp');
  assert.equal(Buffer.from(parsed.buffer).toString('utf8'), 'hello-webp');

  assert.equal(parseDataImageUri('https://example.com/logo.png'), null);
  assert.equal(parseDataImageUri('🎮'), null);
  assert.equal(parseDataImageUri(''), null);
});

test('isInternalMediaProxyUrl identifies internal binary media proxy paths accurately', () => {
  assert.equal(isInternalMediaProxyUrl('/api/v1/games/17/thumbnail?v=123-abc'), true);
  assert.equal(isInternalMediaProxyUrl('/api/v1/games/17/icon'), true);
  assert.equal(isInternalMediaProxyUrl('/api/v1/settings/hero-image?v=99-xyz'), true);
  assert.equal(isInternalMediaProxyUrl('data:image/png;base64,AAAA'), false);
  assert.equal(isInternalMediaProxyUrl('https://cdn.example.com/img.png'), false);
  assert.equal(isInternalMediaProxyUrl(''), false);
});

test('buildMediaVersionTag produces deterministic tags that change when media changes', () => {
  const tagA = buildMediaVersionTag('data:image/png;base64,AAAAAA', '2026-11-20');
  const tagA2 = buildMediaVersionTag('data:image/png;base64,AAAAAA', '2026-11-20');
  const tagB = buildMediaVersionTag('data:image/png;base64,BBBBBB', '2026-11-20');
  assert.equal(tagA, tagA2);
  assert.notEqual(tagA, tagB);
});
