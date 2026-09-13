'use client';
/**
 * localStorage（F-26）を React から読むためのフック。
 * 読み込みは端末側でしかできないので、サーバー描画中は null を返し、
 * 画面側で「読み込んでいます」を出す。
 */
import { useSyncExternalStore } from 'react';
import { STORAGE_KEY, loadState } from '@/shared/storage';
import type { ReserveState } from '@/shared/types';

export type StoredState = { data: ReserveState; error: string | null };

let cachedRaw: string | null = null;
let cached: StoredState | null = null;

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function getSnapshot(): StoredState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (cached === null || raw !== cachedRaw) {
    cachedRaw = raw;
    cached = loadState();
  }
  return cached;
}

function getServerSnapshot(): null {
  return null;
}

export function useStoredState(): StoredState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
