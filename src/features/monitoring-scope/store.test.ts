import { afterEach, expect, it, vi } from 'vitest';
import { createMonitoringScopeStore, monitoringScopeStorageKey } from './store';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('persists only account-scoped preferences and restores them on reload', () => {
  const store = createMonitoringScopeStore();
  expect(store.getState().scopes[alice] ?? 'mine').toBe('mine');
  store.getState().setScope(alice, 'everyone');
  expect(store.getState().scopes[bob] ?? 'mine').toBe('mine');
  store.getState().setScope(bob, 'mine');
  const restored = createMonitoringScopeStore();
  expect(restored.getState().scopes).toEqual({ [alice]: 'everyone', [bob]: 'mine' });
  expect(JSON.parse(localStorage.getItem(monitoringScopeStorageKey) ?? '{}')).toEqual({
    version: 1,
    state: { scopes: { [alice]: 'everyone', [bob]: 'mine' } },
  });
});

it.each([
  'invalid-json',
  JSON.stringify({ version: 1, state: { scopes: { [alice]: 'invalid' }, setScope: 'tampered' } }),
])('ignores corrupt storage and retains functional actions: %s', (value) => {
  localStorage.setItem(monitoringScopeStorageKey, value);
  const store = createMonitoringScopeStore();
  expect(store.getState().scopes).toEqual({});
  store.getState().setScope(alice, 'everyone');
  expect(store.getState().scopes[alice]).toBe('everyone');
});

it('keeps the view usable when browser storage is denied', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  const store = createMonitoringScopeStore();
  expect(() => store.getState().setScope(alice, 'everyone')).not.toThrow();
  expect(store.getState().scopes[alice]).toBe('everyone');
});
