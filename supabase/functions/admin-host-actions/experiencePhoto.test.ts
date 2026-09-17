// Tests for the experience-photo upload path builder.
//
// Run: node --test supabase/functions/admin-host-actions/experiencePhoto.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_CONTENT_TYPES,
  EXPERIENCE_PREFIX,
  buildExperiencePhotoPath,
} from './experiencePhoto.ts';

const NOW = 1_763_000_000_000;

test('accepts every allowed image type and derives the extension from it', () => {
  const want: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  for (const type of ALLOWED_CONTENT_TYPES) {
    const r = buildExperiencePhotoPath('Wine Tour.HEIC', type, NOW, 'abc123');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.path, `${EXPERIENCE_PREFIX}${NOW}-abc123-Wine-Tour.${want[type]}`,
      'the client extension must not survive');
  }
});

test('rejects content types the bucket is not meant to hold', () => {
  for (const type of ['text/html', 'application/javascript', 'image/svg+xml', 'application/pdf', '', 'image/jpeg ']) {
    const r = buildExperiencePhotoPath('x.jpg', type, NOW, 'abc123');
    assert.equal(r.ok, false, `${type} must be refused`);
  }
  assert.equal(buildExperiencePhotoPath('x.jpg', undefined, NOW, 'abc123').ok, false);
  assert.equal(buildExperiencePhotoPath('x.jpg', { toString: () => 'image/png' }, NOW, 'abc123').ok, false);
});

test('a traversing or absolute filename cannot escape the prefix', () => {
  for (const name of ['../../etc/passwd', '/etc/passwd', '..', '../cover.png', 'a/b/c.png', '....//x']) {
    const r = buildExperiencePhotoPath(name, 'image/png', NOW, 'abc123');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.path.startsWith(EXPERIENCE_PREFIX), `${name} → ${r.path}`);
    assert.equal(r.path.slice(EXPERIENCE_PREFIX.length).includes('/'), false, `${name} → ${r.path}`);
    assert.equal(r.path.includes('..'), false, `${name} → ${r.path}`);
  }
});

test('rejects a missing, empty or absurdly long filename', () => {
  assert.equal(buildExperiencePhotoPath(undefined, 'image/png', NOW, 'abc123').ok, false);
  assert.equal(buildExperiencePhotoPath('', 'image/png', NOW, 'abc123').ok, false);
  assert.equal(buildExperiencePhotoPath(42, 'image/png', NOW, 'abc123').ok, false);
  assert.equal(buildExperiencePhotoPath('x'.repeat(201), 'image/png', NOW, 'abc123').ok, false);
});

test('a name that sanitises away entirely still gets a usable path', () => {
  const r = buildExperiencePhotoPath('!!!.png', 'image/png', NOW, 'abc123');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.path, `${EXPERIENCE_PREFIX}${NOW}-abc123-photo.png`);
});

test('two uploads of the same name never collide', () => {
  const a = buildExperiencePhotoPath('cover.png', 'image/png', NOW, 'aaaaaa');
  const b = buildExperiencePhotoPath('cover.png', 'image/png', NOW + 1, 'bbbbbb');
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.notEqual(a.path, b.path);
});
