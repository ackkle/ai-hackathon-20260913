/**
 * S-13・S-14 を単体で開いたとき（/reflect/demo など）に使うサンプルの行動。
 * デモデータ（#4）が入る前でも画面の動きを確認できるようにするためのもので、
 * 保存はしない。画面には「サンプル」と表示し続ける。
 */
import type { Action } from '@/shared/types';

export const SAMPLE_ACTION_ID = 'demo';

export function sampleAction(id: string = SAMPLE_ACTION_ID): Action {
  return {
    id,
    planId: 'sample_plan',
    monthlyId: null,
    title: '陶芸体験の空きを調べる',
    durationMin: 30,
    place: '自宅',
    prep: ['スマートフォン'],
    fallback: '教室の名前を検索するだけでも大丈夫です',
    startMessage: '申し込まなくて大丈夫。見るだけ。',
    reservationNo: null,
    isFirstDay: true,
    status: 'scheduled',
    start: null,
    end: null,
    calendar: { method: null, eventId: null, htmlLink: null, confirmedAt: null },
    origin: 'tree',
  };
}
