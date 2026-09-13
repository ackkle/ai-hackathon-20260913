/**
 * 機能モード一覧（F-35）。
 * 発表前にここを見れば、何が本物で何がサンプルかを全員が同じように説明できる
 * （mvp-spec 第14章）。
 *
 * featureModes を直接読むと AI_MODE の切り替えが反映されず、本物のAIで動いて
 * いる機能まで「サンプル」と出ていた。判定は getFeatureMode に任せる。
 */
import { featureModes, getFeatureMode, type FeatureId } from '@/config/features';

const labels = { real: '本実装', simple: '簡易実装', mock: 'サンプル', concept: '構想デモ', off: '非表示' };

export function ModeList() {
  return (
    <details className="feature-list">
      <summary>機能の実装状況</summary>
      <ul>
        {Object.keys(featureModes).map(id => (
          <li key={id}>
            <span>{id}</span>
            <span>{labels[getFeatureMode(id as FeatureId)]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
