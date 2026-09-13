'use client';
/**
 * S-03 願いの入力（F-03）。曖昧な願いでも進める。願いは1件だけ持つ（B案 §1.3）。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { useStoredState } from '@/features/reflection/use-stored-state';
import { saveState } from '@/shared/storage';
import { SEND_NOTICE, WISH_EXAMPLES, WISH_MAX, applyWish, canRewriteWish, createWish } from './logic';

export function WishScreen() {
  const router = useRouter();
  const stored = useStoredState();
  const [text, setText] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (stored === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  const state = stored.data;
  // 回答や道のりができるまでは書き直せる。できたあとは設定から始め直す
  const locked = !canRewriteWish(state);
  // 保存済みの願いがあれば、それを直せるように入れておく
  const value = text ?? state.wish?.text ?? '';
  const trimmed = value.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    const wish = createWish({ id: `wish_${crypto.randomUUID()}`, text: trimmed, now: new Date().toISOString() });
    try {
      const saved = saveState(applyWish(state, wish));
      if (!saved.ok) { setSaveError(saved.error); return; }
      window.dispatchEvent(new Event('storage'));
      router.push('/questions');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'この端末に保存できませんでした');
    }
  }

  return (
    <>
      <ModeBanner mode={getFeatureMode('F-03')} mockText="" />
      <section className="screen-panel">
        <ScreenHeading screenId="S-03" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        {locked ? (
          <div className="ticket-preview">
            <p className="!text-base !mb-2">{state.wish!.text}</p>
            <small className="!border-0 !pt-0">
              この願いはすでに保存されています。
              <Link href="/settings" className="underline">設定</Link>
              から新しい願いを始められます。
            </small>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className="mb-2 block">
              <span className="sr-only">どんなことを願っていますか</span>
              <textarea
                value={value}
                onChange={event => setText(event.target.value.slice(0, WISH_MAX))}
                maxLength={WISH_MAX}
                rows={4}
                placeholder="なんか、このままじゃまずい気がする。何かしたい"
                className="w-full rounded-xl border border-[#d8e1d3] bg-white p-3 text-base"
              />
            </label>
            <p className="mb-4 text-right text-xs text-[var(--muted)]">{value.length} / {WISH_MAX}</p>

            <div className="mb-6 flex flex-wrap gap-2">
              {WISH_EXAMPLES.map(example => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setText(example)}
                  className="min-h-[44px] rounded-full border border-[#d8e1d3] bg-white px-4 py-2 text-sm"
                >
                  {example}
                </button>
              ))}
            </div>

            {saveError && <p className="notice mb-3">{saveError}</p>}
            <button
              type="submit"
              disabled={!trimmed}
              className="primary-link w-full justify-center border-0 disabled:cursor-not-allowed disabled:bg-[#b7c3bb]"
            >
              次へ
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-[var(--muted)]">{SEND_NOTICE}</p>
        {/* 「やっぱり、まだ分からない」（/tomorrow）は画面が未実装なので出さない */}
        {locked && (
          <div className="secondary-links">
            <Link href="/questions">質問へ進む</Link>
          </div>
        )}
      </section>
    </>
  );
}
