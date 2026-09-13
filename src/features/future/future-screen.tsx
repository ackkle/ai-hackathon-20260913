'use client';
/**
 * S-07 10年後の生活と値札（F-07、AI-03）。
 *
 * AI-03 は「10年後の生活・値札・逆算ツリー・今週の行動」をまとめて返す（mvp-spec 第8章）。
 * この画面はそのうち 10年後の生活と値札だけを見せ、続きの道筋は S-08 に渡す。
 * 生成と保存は S-08 と同じ tree/logic.ts の createTreeState を使うので、
 * どちらの画面から作っても保存の形は同じになる。
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { MONEY_NOTE, SOURCE_LABEL, formatHours, formatYen } from '@/features/safety/money';
import { createTreeState } from '@/features/tree/logic';
import { loadState, saveState } from '@/shared/storage';
import styles from './future.module.css';
import type { FutureLife, ReserveState } from '@/shared/types';

/** 値札の1項目。金額と時間で書式だけを変える */
function PriceRow({
  label,
  amount,
  kind,
}: {
  label: string;
  amount: FutureLife['priceTag']['initialCost'];
  kind: 'yen' | 'hours';
}) {
  const text = kind === 'yen' ? formatYen(amount.value) : formatHours(amount.value);
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>
        <strong>{text}</strong>
        <span className={styles.badge}>
          {SOURCE_LABEL[amount.source]}
          {amount.assumed ? '（仮）' : ''}
        </span>
      </dd>
    </div>
  );
}

function FutureLifeView({ futureLife }: { futureLife: FutureLife }) {
  return (
    <>
      <div className={styles.future}>
        <p className={styles.futureText}>{futureLife.text}</p>
      </div>
      <h2>この暮らしの値札</h2>
      <dl className={styles.priceTag}>
        <PriceRow label="はじめに必要なお金" amount={futureLife.priceTag.initialCost} kind="yen" />
        <PriceRow label="毎月のお金" amount={futureLife.priceTag.monthlyCost} kind="yen" />
        <PriceRow label="週に使う時間" amount={futureLife.priceTag.weeklyHours} kind="hours" />
      </dl>
      <p className="notice">{MONEY_NOTE}</p>
      <p className={styles.caption}>
        「仮」は、まだ決まっていない数字です。決めるときに確かめてください。
      </p>
    </>
  );
}

export function FutureScreen() {
  const [state, setState] = useState<ReserveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    // 保存はブラウザ側の仕組みなので、画面が出てから読む
    const refresh = () => {
      const result = loadState();
      setState(result.data);
      setError(result.error);
      setStorageError(Boolean(result.error));
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => {
      controller.current?.abort();
      window.removeEventListener('storage', refresh);
    };
  }, []);

  /**
   * AI-03 を呼んで保存する。
   * 送信中はボタンを無効にして二重送信を防ぎ、失敗しても入力は消さない（F-28）。
   */
  async function generate() {
    if (pending.current || !state || storageError) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 45000);
    try {
      const original = loadState();
      if (original.error) throw new Error(original.error);
      const response = await fetch('/api/ai/tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          wish: original.data.wish,
          answers: original.data.answers,
          blank: original.data.blank,
        }),
      });
      if (!response.ok) {
        throw new Error('10年後の生活を作れませんでした。回答は残っています。もう一度お試しください');
      }
      const updated = createTreeState(original.data, await response.json(), new Date().toISOString());
      const latest = loadState();
      if (latest.error || JSON.stringify(latest.data) !== JSON.stringify(original.data)) {
        throw new Error('保存内容が変わりました。再読み込みして続きを開いてください');
      }
      const saved = saveState(updated);
      if (!saved.ok) throw new Error(saved.error);
      setState(updated);
      window.dispatchEvent(new Event('storage'));
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === 'AbortError'
          ? '時間がかかっています。回答は残っています。もう一度お試しください'
          : cause instanceof Error
            ? cause.message
            : '応答を読み取れませんでした。もう一度お試しください',
      );
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      setBusy(false);
    }
  }

  const canGenerate = Boolean(state?.wish && state.answers.length > 0);

  // 開いたら作り始める。ボタンを押させると、初めての人は止まってしまう。
  useEffect(() => {
    if (!canGenerate || state?.futureLife || busy || error) return;
    // AI を呼び始めるのは「外の仕組みとの同期」。送信中の表示のために状態を1つ変える
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
    // generate は毎回 loadState で最新を読むので、依存は下の4つで足りる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate, state?.futureLife, busy, error]);

  return (
    <>
      <ModeBanner
        mode={getFeatureMode('F-07')}
        sample={Boolean(state?.isDemo)}
        sampleText="デモ用・サンプルの10年後です。"
        mockText="サンプル：10年後の生活は固定のモック応答です。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-07" />

        {error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            {storageError && <Link href="/settings">設定で保存内容を確認する</Link>}
          </div>
        )}

        {!state ? (
          <p role="status">保存内容を読み込んでいます…</p>
        ) : state.futureLife ? (
          <>
            <FutureLifeView futureLife={state.futureLife} />
            <Link className="primary-link" href="/tree">
              ここまでの道のりを見る <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : canGenerate ? (
          <div className={styles.start}>
            <p>{state.wish?.text}</p>
            <p className={styles.caption}>
              いまの回答から、10年後の暮らしと、その暮らしにかかるお金と時間を考えます。
            </p>
            <button
              type="button"
              className={styles.button}
              disabled={busy || storageError}
              onClick={generate}
            >
              {busy ? '10年後を考えています…（30秒ほどかかります）' : error ? 'もう一度つくる' : '10年後の生活を見る'}
            </button>
            {busy && (
              <p role="status" className={styles.caption}>
                少しお待ちください。回答は保存されています。
              </p>
            )}
          </div>
        ) : (
          <>
            <p>先に願いと質問への回答が必要です。</p>
            <Link className="primary-link" href={state.wish ? '/questions' : '/wish'}>
              {state.wish ? '質問の続きを答える' : '願いを書く'}
            </Link>
          </>
        )}

        <div className="secondary-links">
          <Link href="/home">ホームにもどる</Link>
        </div>
      </section>
    </>
  );
}
