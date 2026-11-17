import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GAME_ICON,
  DEFAULT_GAME_THUMBNAIL,
  hasCustomThumbnail,
  isImageMediaSource,
  mergeGameMediaPatch,
  normalizeGameMediaValue,
  resolveGameIcon,
  resolveGameThumbnail,
} from './gameMedia';

test('normalizeGameMediaValue trims whitespace and handles empty/null', () => {
  assert.equal(normalizeGameMediaValue(undefined), '');
  assert.equal(normalizeGameMediaValue(null), '');
  assert.equal(normalizeGameMediaValue('   '), '');
  assert.equal(normalizeGameMediaValue('  🪷  '), '🪷');
});

test('isImageMediaSource detects URLs, data URIs, and root-relative paths', () => {
  assert.equal(isImageMediaSource('https://example.com/thumb.png'), true);
  assert.equal(isImageMediaSource('http://localhost:3000/icon.ico'), true);
  assert.equal(isImageMediaSource('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isImageMediaSource('/favicon.ico'), true);
  assert.equal(isImageMediaSource('🪷'), false);
  assert.equal(isImageMediaSource(''), false);
});

test('resolveGameThumbnail returns custom thumbnail or falls back on empty/error', () => {
  assert.equal(resolveGameThumbnail('https://example.com/a.jpg', false), 'https://example.com/a.jpg');
  assert.equal(resolveGameThumbnail('https://example.com/a.jpg', true), DEFAULT_GAME_THUMBNAIL);
  assert.equal(resolveGameThumbnail('', false), DEFAULT_GAME_THUMBNAIL);
  assert.equal(hasCustomThumbnail('  data:image/png;base64,abc  '), true);
  assert.equal(hasCustomThumbnail('   '), false);
});

test('resolveGameIcon distinguishes image sources, text/emoji icons, and default fallback', () => {
  assert.deepEqual(resolveGameIcon(undefined), { kind: 'default', value: DEFAULT_GAME_ICON });
  assert.deepEqual(resolveGameIcon('  '), { kind: 'default', value: DEFAULT_GAME_ICON });
  assert.deepEqual(resolveGameIcon(' 🪷 '), { kind: 'text', value: '🪷' });
  assert.deepEqual(resolveGameIcon('data:image/webp;base64,AAA'), {
    kind: 'image',
    value: 'data:image/webp;base64,AAA',
  });
  assert.deepEqual(resolveGameIcon('https://cdn.example.com/icon.png'), {
    kind: 'image',
    value: 'https://cdn.example.com/icon.png',
  });
});

test('mergeGameMediaPatch preserves existing values when omitted and clears when empty string passed', () => {
  assert.deepEqual(
    mergeGameMediaPatch(
      { thumbnail: 'https://old.png', icon: '🪷' },
      { thumbnail: undefined, icon: undefined }
    ),
    { thumbnail: 'https://old.png', icon: '🪷' }
  );

  assert.deepEqual(
    mergeGameMediaPatch(
      { thumbnail: 'https://old.png', icon: '🪷' },
      { thumbnail: '', icon: '☸️' }
    ),
    { thumbnail: '', icon: '☸️' }
  );

  assert.deepEqual(
    mergeGameMediaPatch(
      { thumbnail: 'https://old.png', icon: '🪷' },
      { thumbnail: '  https://new.png  ', icon: '' }
    ),
    { thumbnail: 'https://new.png', icon: '' }
  );
});
