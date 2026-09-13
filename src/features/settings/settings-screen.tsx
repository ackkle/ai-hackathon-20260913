'use client';
/**
 * S-17 設定（F-27 記録の全削除と置き換え確認、F-35 機能モード一覧）。
 *
 * S-03 が「設定から新しい願いを始められます」と案内しているのに、この画面が
 * 準備中のままで行き止まりになっていた。願いを書き直す道をここで開く。
 *
 * 消すのは取り消せないので、何が消えるかを件数で見せてから、確認を1段はさむ
 * （A案 §7「新しい目標を作るときは現在の目標と履歴が置き換わることを確認する」）。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ModeList } from '@/features/foundation/mode-list';
import { ScreenHeading } from '@/features/reflection/ui';
import { clearState, loadState } from '@/shared/storage';
import type { ReserveState } from '@/shared/types';
import styles from './settings.module.css';

/** 何が消えるかを数える。0件の行は出さない */
function describeSaved(state: ReserveState): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (state.wish) rows.push({ label: '願い', value: state.wish.text });
  if (state.answers.length > 0) rows.push({ label: '質問への回答', value: `${state.answers.length}件` });
  if (state.futureLife) rows.push({ label: '10年後の生活と値札', value: 'あり' });
  if (state.tree) rows.push({ label: '逆算ツリー', value: 'あり' });
  if (state.actions.length > 0) rows.push({ label: '行動', value: `${state.actions.length}件` });
  if (state.records.length > 0) rows.push({ label: '振り返りの記録', value: `${state.records.length}件` });
  if (state.history.length > 0) rows.push({ label: '変更履歴', value: `${state.history.length}件` });
  return rows;
}

export function SettingsScreen() {
  const router = useRouter();
  const [state, setState] = useState<ReserveState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const result = loadState();
      setState(result.data);
      setLoadError(result.error);
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  function reset() {
    const result = clearState();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.dispatchEvent(new Event('storage'));
    router.push('/wish');
  }

  const rows = state ? describeSaved(state) : [];
  const hasSaved = rows.length > 0;

  return (
    <section className="screen-panel">
      <ScreenHeading screenId="S-17" />

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="notice" role="alert">
          {loadError}。元の記録は消していません。
        </p>
      )}

      <h2>この端末に保存されている記録</h2>
      {!state ? (
        <p role="status">読み込んでいます…</p>
      ) : hasSaved ? (
        <dl className={styles.saved}>
          {rows.map(row => (
            <div key={row.label} className={styles.row}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>まだ何も保存されていません。</p>
      )}

      <h2>新しい願いを始める</h2>
      {hasSaved ? (
        confirming ? (
          <div className={styles.confirm} role="group" aria-label="削除の確認">
            <p>
              上の記録をすべて消して、新しい願いから始めます。
              <strong>消した記録は元に戻せません。</strong>
            </p>
            <button type="button" className={styles.danger} onClick={reset}>
              すべて消して、新しい願いを書く
            </button>
            <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
              やめておく
            </button>
          </div>
        ) : (
          <>
            <p className={styles.caption}>
              いまの願い・回答・行動・記録をすべて消してから、新しい願いを書きます。
              端末に保存しているだけなので、消すとこの端末からは見られなくなります。
            </p>
            <button type="button" className={styles.button} onClick={() => setConfirming(true)}>
              記録を消して、願いを書き直す
            </button>
          </>
        )
      ) : (
        <Link className={styles.button} href="/wish">
          願いを書く
        </Link>
      )}

      <h2>機能の実装状況</h2>
      <p className={styles.caption}>
        いま、どの機能が本物のAIで動いていて、どれがサンプルかを確認できます。
      </p>
      <ModeList />

      <div className="secondary-links">
        <Link href="/home">ホームにもどる</Link>
      </div>
    </section>
  );
}
