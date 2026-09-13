'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { loadState, saveState } from '@/shared/storage';
import type { ReserveState } from '@/shared/types';
import { createTreeState } from './logic';
import { withSampleAnswers } from './sample';
import styles from './tree.module.css';

type SourcedValue = { value: number | null; source: 'user' | 'stat' | 'ai_estimate'; assumed?: boolean };
const labels: Record<string, string> = {
  target: '目標額', months: '月数', perMonth: '月の回数', perVisit: '1回の費用',
  hoursPerSession: '1回の時間', sessionsPerMonth: '月の回数', initialCost: '初期費用',
  monthlyCost: '月額', weeklyHours: '週の時間',
};

function NumberValue({ item, unit = '', demo }: { item: SourcedValue; unit?: string; demo: boolean }) {
  if (item.source === 'stat' && getFeatureMode('F-11') === 'off') {
    return <span className={styles.caption}>統計の参照値は未確認のため表示していません</span>;
  }
  const source = { user: '本人の回答', stat: '統計の参照値', ai_estimate: 'AIの推定' }[item.source];
  return <><strong>{item.value === null ? '未設定' : `${item.value.toLocaleString('ja-JP')}${unit}`}</strong>{' '}<span className={styles.badge}>{source}{demo ? '・サンプル' : ''}</span>{item.assumed && <span className={`${styles.badge} ${styles.first}`}>仮</span>}</>;
}

function SavedTree({ state }: { state: ReserveState }) {
  const { tree, futureLife } = state;
  if (!tree || !futureLife) return <p>保存済みのツリーを表示できません。<Link href="/home" className={styles.link}>ホームへ</Link></p>;
  const plan = state.plans.find(p => p.closedAt === null);
  const actions = (plan ? plan.actionIds.map(id => state.actions.find(a => a.id === id)).filter(a => a !== undefined) : []).slice(0, 3);
  return <div aria-label="未来から今週までの5段の道筋">
    <section className={`${styles.level} ${styles.future}`}>
      <h2>1. 10年後の生活</h2><p className={styles.futureText}>{futureLife.text}</p>
      <p className={styles.caption}>こんな毎日を、少しずつ試してみる。</p>
      <dl>{([['初期費用', futureLife.priceTag.initialCost, '円'], ['月額', futureLife.priceTag.monthlyCost, '円'], ['週の時間', futureLife.priceTag.weeklyHours, '時間']] as const).map(([label, item, unit]) => <div className={styles.number} key={label}><dt>{label}</dt><dd><NumberValue item={item} unit={unit} demo={state.isDemo} /></dd></div>)}</dl>
      <p className={styles.caption}>金額は目安です。実際の料金は、行き先を決めてから確認してください。</p>
    </section>
    <section className={styles.level}><h2>2. 1年後・3年後の目指す姿</h2><ul className={styles.list}>
      {[...tree.goals].sort((a, b) => a.horizon.localeCompare(b.horizon)).map((goal, i) => <li className={styles.item} key={`${goal.horizon}-${i}`}><span className={styles.badge}>{goal.horizon === '1y' ? '1年後' : '3年後'} · {goal.deadline}</span><p>{goal.text}</p></li>)}
    </ul></section>
    <section className={styles.level}><h2>3. 必要な数字の目安</h2><ul className={styles.list}>
      {tree.metrics.map(metric => <li className={styles.item} key={metric.id}><h3>{metric.label}</h3><dl>{Object.entries(metric.inputs ?? {}).map(([key, item]) => <div className={styles.number} key={key}><dt>{labels[key] ?? key}</dt><dd><NumberValue item={item} demo={state.isDemo} /></dd></div>)}</dl>
        {metric.result && !Object.values(metric.inputs ?? {}).some(v => v.source === 'stat' && getFeatureMode('F-11') === 'off') && <p><strong>{metric.result.value.toLocaleString('ja-JP')}{metric.result.unit}</strong><span className={styles.badge}>{state.isDemo ? '計算例・サンプル' : '入力からの計算'}</span><br /><span className={styles.caption}>{metric.result.formula}</span></p>}
        {metric.note && <p className={styles.caption}>{metric.note}</p>}</li>)}
    </ul><p className={styles.caption}>「仮」はまだ決まっていない数字です。金額は目安です。</p></section>
    <section className={styles.level}><h2>4. 今月の行動</h2><ul className={styles.list}>{tree.monthly.map(item => <li className={styles.item} key={item.id}>{item.text}</li>)}</ul></section>
    <section className={styles.level}><h2>5. 今週の小さな一歩</h2><p className={styles.caption}>まずは1つ選び、できそうな日時を決めましょう。</p>
      {actions.map(action => <article className={styles.action} key={action.id}>
        {action.isFirstDay && <span className={`${styles.badge} ${styles.first}`}>最初の1日</span>}<h3>{action.title}</h3>
        <p>{action.durationMin}分 · {action.place}</p><p>準備：{action.prep.join('、') || '特になし'}</p>
        <p>気が重いときは：{action.fallback}</p><p className={styles.caption}>{action.startMessage}</p>
        {action.status === 'unscheduled' ? <Link className={styles.button} href={`/schedule?actionId=${encodeURIComponent(action.id)}`}>この一歩の日時を決める</Link> : <Link className={styles.link} href="/home">予定・記録をホームで見る</Link>}
      </article>)}
      {!actions.length && <Link className={styles.link} href="/home">計画の続きをホームで見る</Link>}
      <p className={styles.caption}>日時が決まる前の「最初の1日」は、始める一歩の候補です。</p>
    </section>
  </div>;
}

export function TreeScreen() {
  const [state, setState] = useState<ReserveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    // Storage is an external browser system; load only after hydration.
    const refresh = () => { const result = loadState(); setState(result.data); setError(result.error); setStorageError(Boolean(result.error)); };
    refresh(); window.addEventListener('storage', refresh);
    return () => { controller.current?.abort(); window.removeEventListener('storage', refresh); };
  }, []);

  async function generate(sample: boolean) {
    if (pending.current || !state || storageError) return;
    pending.current = true; setBusy(true); setError(null);
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const original = loadState();
      if (original.error) throw new Error(original.error);
      const input = sample ? withSampleAnswers(original.data, new Date().toISOString()) : original.data;
      const response = await fetch('/api/ai/tree', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ wish: input.wish, answers: input.answers, blank: input.blank }),
      });
      if (!response.ok) throw new Error('道筋を作れませんでした。入力は残っています。もう一度お試しください');
      const updated = createTreeState(input, await response.json(), new Date().toISOString());
      const latest = loadState();
      if (latest.error || JSON.stringify(latest.data) !== JSON.stringify(original.data)) throw new Error('保存内容が変わりました。再読み込みして続きを開いてください');
      const saved = saveState(updated);
      if (!saved.ok) throw new Error(saved.error);
      setState(updated);
      window.dispatchEvent(new Event('storage'));
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'AbortError' ? '時間がかかっています。入力は残っています。もう一度お試しください' : cause instanceof Error && cause.name !== 'ZodError' ? cause.message : '応答を読み取れませんでした。もう一度お試しください');
    } finally { clearTimeout(timeout); pending.current = false; setBusy(false); }
  }

  const hasSavedPlan = state && (state.tree || state.actions.length || state.plans.length || state.records.length || state.proposals.length || state.history.length);
  const canSample = state && !state.wish && state.answers.length === 0 && !hasSavedPlan;
  return <div className={styles.screen}>
    {(state?.isDemo || getFeatureMode('F-08') === 'mock') && <div className="mode-banner" role="status">{state?.isDemo ? 'デモ用・サンプルの道筋です' : 'サンプル：現在のAIは固定の道筋を提案します'}</div>}
    <p className="eyebrow">RESERVE MACHINE <span>S-08</span></p><h1>未来を、今週の一歩に。</h1>
    <p className={styles.intro}>遠くの願いから、今日選べる小さな行動へ。自分のペースで始めましょう。</p>
    {error && <div className={styles.error} role="alert"><p>{error}</p>{storageError && <Link className={styles.link} href="/settings">設定で保存内容を確認する</Link>}</div>}
    {!state ? <p role="status">保存内容を読み込んでいます…</p> : state.tree ? <SavedTree state={state} /> : hasSavedPlan ? <Link className={styles.link} href="/home">保存済みの計画をホームで見る</Link> : <div className={styles.start}>
      {state.wish && <><h2>{state.wish.text}</h2><p className={styles.caption}>回答をもとに、10年後から今週までの道筋を作ります。</p></>}
      {state.wish && state.answers.length > 0 ? <button className={styles.button} disabled={busy || storageError} onClick={() => generate(false)}>{busy ? '道筋を作っています…' : error ? 'もう一度つくる' : '回答から道筋をつくる'}</button> : canSample ? <><p>木工を始めたい人のサンプル回答で、道筋を試せます。</p><p className={styles.caption}>サンプルの計画をこの端末に保存します。</p><button className={styles.button} disabled={busy || storageError} onClick={() => generate(true)}>{busy ? '道筋を作っています…' : error ? 'サンプルでもう一度試す' : 'サンプルで試す'}</button></> : <Link className={styles.button} href="/questions">質問の続きを答える</Link>}
      {busy && <p role="status" className={styles.caption}>準備しています。少しお待ちください。</p>}
      <Link className={styles.link} href={state.wish ? '/questions' : '/wish'}>自分の願い・回答を入力する</Link>
    </div>}
  </div>;
}
