import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REALTIME_SYNC_EVENTS,
  resolveRealtimeToastMessage,
  hasSyncRevisionChanged,
  shouldAutoRefreshOnVisibility,
  reconcileActiveUser,
} from './realtimeSync';
import { UserProfile } from '../types';

test('REALTIME_SYNC_EVENTS includes all CRUD entity events across users, licenses, games, categories, certs, and backups', () => {
  const required = [
    'connected',
    'game:created',
    'game:updated',
    'game:deleted',
    'category:created',
    'category:updated',
    'category:deleted',
    'user:created',
    'user:updated',
    'user:deleted',
    'license:created',
    'license:deleted',
    'certificate:created',
    'certificate:updated',
    'certificate:deleted',
    'backup:imported',
    'stats:updated',
  ];
  for (const evt of required) {
    assert.equal(REALTIME_SYNC_EVENTS.includes(evt as (typeof REALTIME_SYNC_EVENTS)[number]), true);
  }
});

test('hasSyncRevisionChanged detects revision updates and avoids redundant reloads on identical revision', () => {
  assert.equal(hasSyncRevisionChanged(null, 5), true);
  assert.equal(hasSyncRevisionChanged(5, 5), false);
  assert.equal(hasSyncRevisionChanged(5, 6), true);
  assert.equal(hasSyncRevisionChanged(5, undefined), false);
});

test('shouldAutoRefreshOnVisibility only refreshes when tab is visible and min interval elapsed', () => {
  assert.equal(shouldAutoRefreshOnVisibility('hidden', 0, 10000, 2000), false);
  assert.equal(shouldAutoRefreshOnVisibility('visible', 9000, 10000, 2000), false);
  assert.equal(shouldAutoRefreshOnVisibility('visible', 7500, 10000, 2000), true);
});

test('reconcileActiveUser updates changed profile stats from server and logs out deleted accounts', () => {
  const local: UserProfile = {
    id: 'usr-1',
    name: 'Bodhi',
    email: 'bodhi@vihara.id',
    avatar: 'a.png',
    xp: 100,
    badge: 'Pemula',
    level: 1,
    school: 'Vihara A',
    role: 'user',
  };

  const updated = reconcileActiveUser(local, [
    { ...local, xp: 450, level: 3, badge: 'Penjaga Bodhicitta' },
  ]);
  assert.equal(updated.changed, true);
  assert.equal(updated.user?.xp, 450);
  assert.equal(updated.user?.level, 3);

  const unchanged = reconcileActiveUser(local, [{ ...local }]);
  assert.equal(unchanged.changed, false);

  const deleted = reconcileActiveUser(local, []);
  assert.equal(deleted.changed, true);
  assert.equal(deleted.user, null);
});

test('resolveRealtimeToastMessage returns clean Indonesian notices for visible mutations and null for silent events', () => {
  assert.match(resolveRealtimeToastMessage('game:created') || '', /Permainan baru/);
  assert.match(resolveRealtimeToastMessage('backup:imported') || '', /disinkronkan/);
  assert.equal(resolveRealtimeToastMessage('connected'), null);
  assert.equal(resolveRealtimeToastMessage('stats:updated'), null);
});
