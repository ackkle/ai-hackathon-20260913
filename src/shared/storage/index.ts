import { createEmptyState, ReserveStateSchema, type ReserveState } from '../types';

export const STORAGE_KEY = 'reserve-machine:v2';
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type StorageResult = { ok: true; error: null } | { ok: false; error: string };
export type LoadResult = { data: ReserveState; error: string | null };

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  return storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
}

export function load(storage?: StorageLike): LoadResult {
  try {
    const raw = resolveStorage(storage)?.getItem(STORAGE_KEY);
    if (raw == null) return { data: createEmptyState(), error: null };
    const data = ReserveStateSchema.parse(JSON.parse(raw));
    return { data, error: null };
  } catch {
    // Leave the original bytes untouched so a user can recover them.
    return { data: createEmptyState(), error: '保存データを読めませんでした' };
  }
}

export function save(data: ReserveState, storage?: StorageLike): StorageResult {
  try {
    const validated = ReserveStateSchema.parse(data);
    const target = resolveStorage(storage);
    if (!target) return { ok: false, error: 'この端末に保存できませんでした' };
    const previous = target.getItem(STORAGE_KEY);
    if (previous !== null) {
      try { ReserveStateSchema.parse(JSON.parse(previous)); }
      catch { return { ok: false, error: '保存データを読めませんでした。記録を確認してから削除してください' }; }
    }
    target.setItem(STORAGE_KEY, JSON.stringify(validated));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'この端末に保存できませんでした' };
  }
}

export function clear(storage?: StorageLike): StorageResult {
  try {
    const target = resolveStorage(storage);
    if (!target) return { ok: false, error: 'この端末の記録を削除できませんでした' };
    target.removeItem(STORAGE_KEY);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'この端末の記録を削除できませんでした' };
  }
}

export { load as loadState, save as saveState, clear as clearState };
