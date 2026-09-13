'use client';
import { useEffect, useState } from 'react';
import { load } from '@/shared/storage';

export function StorageNotice() {
  const [state, setState] = useState<{ error: string | null; isDemo: boolean }>({ error: null, isDemo: false });
  useEffect(() => {
    const result = load();
    // An effect reads browser-only persisted state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ error: result.error, isDemo: result.data.isDemo });
  }, []);
  return <>{state.error && <p role="alert" className="notice">{state.error}。元の記録は消していません。</p>}{state.isDemo && <p className="mode-banner">デモ用のデータで表示しています</p>}</>;
}
