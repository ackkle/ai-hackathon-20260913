/**
 * S-09・S-10 を単体で開いたとき（/schedule、/ticket/demo）に使う見本。
 * デモデータ（#4）が入る前でも画面の動きを確認できるようにするもので、保存はしない。
 * 画面には「サンプル」と表示し続ける。
 */
import { sampleAction } from '@/features/reflection/sample';
import type { Action } from '@/shared/types';
import { addMinutes, toJstIso } from './logic';

export const SAMPLE_ACTION_ID = 'demo';

/** 見本の行動。日時は「開いた日の翌日10:00」にして、過去日時にならないようにする */
export function sampleReservation(id: string = SAMPLE_ACTION_ID, now: Date = new Date()): Action {
  const base = sampleAction(id);
  const tomorrow = toJstIso(new Date(now.getTime() + 24 * 60 * 60 * 1000)).slice(0, 11);
  const start = `${tomorrow}10:00:00+09:00`;
  return {
    ...base,
    reservationNo: `RM-${tomorrow.replaceAll('-', '').slice(0, 8)}-001`,
    status: 'scheduled',
    start,
    end: addMinutes(start, base.durationMin),
  };
}
