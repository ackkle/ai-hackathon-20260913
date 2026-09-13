import { Suspense } from 'react';
import { HomeScreen } from '@/features/home';

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">読み込んでいます…</p>}>
      <HomeScreen />
    </Suspense>
  );
}
