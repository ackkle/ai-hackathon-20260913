import { featureModes } from '@/config/features';
const labels = { real: '本実装', simple: '簡易実装', mock: 'サンプル', concept: '構想デモ', off: '非表示' };
export function ModeList() {
  return <details className="feature-list"><summary>機能の実装状況</summary><ul>{Object.entries(featureModes).map(([id, mode]) => <li key={id}><span>{id}</span><span>{labels[mode]}</span></li>)}</ul></details>;
}
