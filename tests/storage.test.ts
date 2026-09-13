import { describe, expect, it } from 'vitest';
import { createEmptyState, ReserveStateSchema, ActionStatusSchema } from '../src/shared/types';
import { load, save, clear, STORAGE_KEY } from '../src/shared/storage';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('browser persistence boundary', () => {
  it('starts without a wish when no saved record exists', () => {
    const result = load(memoryStorage());
    expect(result.error).toBeNull();
    expect(result.data.wish).toBeNull();
    expect(result.data.schemaVersion).toBe(2);
  });
  it('retains a wish, unknown answer and demo identity across a reload', () => {
    const store = memoryStorage();
    const state = createEmptyState();
    state.isDemo = true;
    state.demoPersona = 'kenta';
    state.wish = { id: 'wish_01', text: '何かしたい', reason: null, category: 'unknown', createdAt: '2026-09-13T13:00:00+09:00' };
    state.answers = [{ questionId: 'budget', value: null, isUnknown: true }];
    expect(save(state, store).ok).toBe(true);
    expect(load(store).data).toEqual(state);
  });
  it('reports corrupted JSON without overwriting the saved bytes', () => {
    const store = memoryStorage();
    store.setItem(STORAGE_KEY, '{broken');
    expect(load(store).error).toBe('保存データを読めませんでした');
    expect(store.getItem(STORAGE_KEY)).toBe('{broken');
  });
  it('refuses to replace unreadable saved records until the user clears them', () => {
    const store = memoryStorage();
    store.setItem(STORAGE_KEY, '{broken');
    const fallback = load(store).data;
    expect(save(fallback, store).ok).toBe(false);
    expect(store.getItem(STORAGE_KEY)).toBe('{broken');
    clear(store);
    expect(save(fallback, store).ok).toBe(true);
  });
  it('restores the documented minimal saved proposal without losing the rest of the state', () => {
    const store = memoryStorage();
    const state = { ...createEmptyState(), proposals: [{
      id: 'prop_01', recordId: 'rec_01', type: 'next', title: 'もう一度試す', durationMin: 30,
      state: 'approved', createdActionId: 'act_04', decidedAt: '2026-09-14T20:31:00+09:00',
    }] };
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    const loaded = load(store);
    expect(loaded.error).toBeNull();
    expect(loaded.data.proposals[0].title).toBe('もう一度試す');
  });
  it('rejects a wrong schema version and malformed saved fields', () => {
    const store = memoryStorage();
    for (const invalid of [{ ...createEmptyState(), schemaVersion: 1 }, { ...createEmptyState(), records: 'wrong' }]) {
      store.setItem(STORAGE_KEY, JSON.stringify(invalid));
      expect(load(store).error).not.toBeNull();
    }
  });
  it('does not destroy an existing record when saving invalid data', () => {
    const store = memoryStorage();
    save(createEmptyState(), store);
    const before = store.getItem(STORAGE_KEY);
    expect(save({ schemaVersion: 2 } as never, store).ok).toBe(false);
    expect(store.getItem(STORAGE_KEY)).toBe(before);
  });
  it('returns a useful failure when browser quota is exhausted', () => {
    const store = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(save(createEmptyState(), store)).toEqual({ ok: false, error: 'この端末に保存できませんでした' });
  });
  it('clears only this application record', () => {
    const store = memoryStorage();
    store.setItem('other-app', 'keep');
    save(createEmptyState(), store);
    expect(clear(store).ok).toBe(true);
    expect(store.getItem(STORAGE_KEY)).toBeNull();
    expect(store.getItem('other-app')).toBe('keep');
  });
  it('produces independent fresh arrays for each empty session', () => {
    const first = createEmptyState();
    first.answers.push({ questionId: 'x', value: null, isUnknown: true });
    expect(createEmptyState().answers).toEqual([]);
  });
});

describe('shared state compatibility', () => {
  it('normalizes issue aliases to the documented lifecycle', () => {
    expect(ActionStatusSchema.parse('proposed')).toBe('unscheduled');
    expect(ActionStatusSchema.parse('reserved')).toBe('scheduled');
    expect(ActionStatusSchema.parse('registered')).toBe('registered');
  });
  it('rejects invalid nested records instead of silently accepting them', () => {
    expect(ReserveStateSchema.safeParse({ ...createEmptyState(), records: [{ result: 'success' }] }).success).toBe(false);
  });
});
