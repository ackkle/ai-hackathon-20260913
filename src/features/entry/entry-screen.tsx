'use client';
/**
 * S-02 入口（F-01・F-33）。最初に開く画面なので、
 * 「何をしてくれるアプリか」が分かってから始められるようにしている。
 *
 * 書いてよいのは、実際にこのアプリがやることだけ。
 * 利用者数や満足度のような数字、体験談は作らない（仕様書 第14.1節）。
 */
import Link from 'next/link';
import { useStoredState } from '@/features/reflection/use-stored-state';
import styles from './entry.module.css';
import { SEND_NOTICE } from './logic';

/** 願いの例。S-03 の入力欄にも近いものを出している */
const VOICES = [
  'なんか、このままじゃまずい気がする',
  '何かしたい、でも何かは分からない',
  '英語を話せるようになりたい',
];

const STEPS = [
  { n: '1', title: '思っていることを書く', body: 'ひとことでかまいません。まとまっていなくても大丈夫です。' },
  { n: '2', title: 'いくつかの質問に答える', body: 'AIがあなたの言葉に合わせて質問を作ります。「分からない」も選べます。' },
  { n: '3', title: '今週の一歩を予約する', body: '10年後の暮らしから逆算した、15分ほどでできる行動が出ます。' },
];

const FEATURES = [
  {
    title: '10年後の暮らしが、文章で出てくる',
    body: 'その暮らしに、はじめいくら・毎月いくら・週に何時間かかるかの目安も一緒に出ます。',
  },
  {
    title: '遠い願いが、今週やることまで小さくなる',
    body: '1年後・3年後の目標、今月の行動、今週の15分。段階をとばさずにつながります。',
  },
  {
    title: 'カレンダーに入れて、予定にできる',
    body: 'できなかった日のための「気が重いときは」も、行動ごとに用意されます。',
  },
];

export function EntryScreen() {
  const stored = useStoredState();
  const state = stored?.data ?? null;
  const started = Boolean(state?.wish);
  const hasPlan = Boolean(state?.tree || (state?.actions.length ?? 0) > 0);
  // 始めた人には同じ言葉を出す。上と下でボタン名が違うと迷う
  const ctaLabel = hasPlan ? '続きを見る' : started ? '続きから始める' : 'はじめる';
  const ctaHref = hasPlan ? '/home' : '/wish';

  return (
    <div className={styles.lp}>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          明日が、
          <br />
          少し楽しみになる。
        </h1>
        <p className={styles.lead}>
          「なんとなく、このままじゃまずい」から始めて大丈夫です。
          その気持ちを、今週できる小さな一歩に変えます。
        </p>

        <Link className={styles.cta} href={ctaHref}>
          <span>{ctaLabel}</span>
          <span aria-hidden="true">→</span>
        </Link>
        <p className={styles.note}>登録もログインもありません。無料で使えます。</p>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>こんな言葉から始められます</h2>
        <ul className={styles.voices}>
          {VOICES.map(voice => (
            <li key={voice} className={styles.voice}>
              「{voice}」
            </li>
          ))}
        </ul>
        <p className={styles.caption}>
          はっきりした目標がなくても進みます。むしろ、そこから始める人のためのアプリです。
        </p>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>進みかた</h2>
        <ol className={styles.steps}>
          {STEPS.map(step => (
            <li key={step.n} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {step.n}
              </span>
              <div>
                <p className={styles.stepTitle}>{step.title}</p>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.caption}>ここまで、だいたい3分です。</p>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>できること</h2>
        {FEATURES.map(feature => (
          <div key={feature.title} className={styles.card}>
            <p className={styles.cardTitle}>{feature.title}</p>
            <p className={styles.cardBody}>{feature.body}</p>
          </div>
        ))}
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>安心して使えるように</h2>
        <ul className={styles.facts}>
          <li>記録はこの端末の中だけに残ります。ほかの人には見えません。</li>
          <li>設定から、いつでもすべて消せます。</li>
          <li>カレンダーに入れるかどうかは、あなたが決めます。勝手には登録しません。</li>
          <li>金額は目安です。投資や金融商品の話は出しません。</li>
        </ul>
      </section>

      <section className={styles.closing}>
        <p className={styles.closingText}>今日でなくても、いつでも始められます。</p>
        <Link className={styles.cta} href={ctaHref}>
          <span>{ctaLabel}</span>
          <span aria-hidden="true">→</span>
        </Link>
        <p className={styles.note}>{SEND_NOTICE}</p>
      </section>
    </div>
  );
}
