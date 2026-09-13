// デモデータ（demo/<人物>/*.json）の検算スクリプト。担当②。
//
//   node demo/verify-demo.mjs            … 整合性・禁止表現の検算だけ
//   npx tsx demo/verify-demo.mjs         … 上に加えて src/shared/types の zod スキーマで検証
//
// 失敗が1件でもあれば終了コード1。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const STATES = ['before', 'waiting', 'recorded', 'next-week'];
const BANNED = ['不要', '堕落', '怠け', 'ダメ', '負け組', '必ず叶う', '確実に増える', '絶対に続く', 'やらなければならない', 'サボった', '御社'];
const STATUSES = ['unscheduled', 'scheduled', 'registered', 'done', 'partial', 'not_done', 'skipped'];
const SLOT_HOURS = { weekday_night: [19, 22], holiday_morning: [9, 12], holiday_afternoon: [13, 18], holiday_night: [19, 22] };

let failures = 0;
const fail = (file, msg) => { failures++; console.log(`  NG ${file}: ${msg}`); };

// 日付は +09:00 で書く前提。曜日と時刻は文字列から読む（実行環境のタイムゾーンに依存しない）
const parts = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+09:00$/.exec(s ?? '');
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return { y, mo, d, h, mi, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), ms: Date.parse(s) };
};
const isHoliday = (p) => p.dow === 0 || p.dow === 6;

async function loadSchema() {
  const path = join(root, '..', 'src', 'shared', 'types', 'index.ts');
  if (!existsSync(path)) return { schema: null, reason: 'src/shared/types が無い' };
  try {
    const mod = await import(path);
    return { schema: mod.ReserveStateSchema, reason: null };
  } catch (e) {
    return { schema: null, reason: `読み込めない（tsx で実行してください）: ${e.message}` };
  }
}

function checkState(file, s) {
  const check = (cond, msg) => { if (!cond) fail(file, msg); };

  check(s.schemaVersion === 2, 'schemaVersion が 2 ではない');
  check(s.isDemo === true, 'isDemo が true ではない');
  check(typeof s.demoPersona === 'string' && s.demoPersona.length > 0, 'demoPersona が無い');

  // 空白：年日数 × 8時間 × 10年
  if (s.blank) check(s.blank.daysPerYear * 8 * 10 === s.blank.hoursPer10Years, `空白の10年分が合わない（${s.blank.daysPerYear}日×8時間×10年 ≠ ${s.blank.hoursPer10Years}）`);

  // ID の重複
  const ids = [s.wish?.id, ...s.plans.map(x => x.id), ...s.actions.map(x => x.id), ...s.records.map(x => x.id),
    ...s.proposals.map(x => x.id), ...s.history.map(x => x.id), ...(s.tree?.metrics ?? []).map(x => x.id),
    ...(s.tree?.monthly ?? []).map(x => x.id)].filter(Boolean);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  check(dup.length === 0, `ID が重複: ${dup.join(', ')}`);
  const resNos = s.actions.map(a => a.reservationNo).filter(Boolean);
  check(new Set(resNos).size === resNos.length, '予約番号が重複');

  const actionById = new Map(s.actions.map(a => [a.id, a]));
  const planById = new Map(s.plans.map(p => [p.id, p]));
  const recordById = new Map(s.records.map(r => [r.id, r]));
  const metricIds = new Set((s.tree?.metrics ?? []).map(m => m.id));
  const monthlyIds = new Set((s.tree?.monthly ?? []).map(m => m.id));

  // 値札の週の時間 ＝ 1回の時間 × 週の回数（週3日）
  const wh = s.futureLife?.priceTag?.weeklyHours?.value;
  if (wh != null) check(wh === 3 * 3, `値札の週の時間が 3時間×週3日 と合わない: ${wh}`);

  for (const m of s.tree?.metrics ?? []) {
    if (m.monthlyId) check(monthlyIds.has(m.monthlyId), `${m.id}: monthlyId の参照先が無い`);
    if (m.kind === 'frequency') {
      const h = m.inputs?.hoursPerSession?.value, n = m.inputs?.sessionsPerMonth?.value;
      check(h * n === m.result?.value, `${m.id}: 頻度型の計算が合わない（${h}×${n} ≠ ${m.result?.value}）`);
      check(m.result?.formula === `${h}時間 × 月${n}回 ＝ 月${h * n}時間`, `${m.id}: 式の文字列が値と合わない`);
    }
  }
  for (const mo of s.tree?.monthly ?? []) if (mo.metricId) check(metricIds.has(mo.metricId), `${mo.id}: metricId の参照先が無い`);
  for (const g of s.tree?.goals ?? []) {
    const yearsAhead = { '1y': 1, '3y': 3 }[g.horizon];
    check(g.deadline === `${2026 + yearsAhead}-09`, `goal ${g.horizon}: 期限 ${g.deadline} が基準日 2026-09 から合わない`);
  }

  // 行動
  const slots = s.availableSlots ?? s.answers.find(a => a.questionId === 'fixed_slots')?.value ?? [];
  for (const a of s.actions) {
    const tag = `${a.id}（${a.title}）`;
    check(STATUSES.includes(a.status), `${tag}: 状態 ${a.status} は正式な状態名ではない`);
    check(planById.has(a.planId), `${tag}: planId ${a.planId} の参照先が無い`);
    check(planById.get(a.planId)?.actionIds.includes(a.id), `${tag}: plan の actionIds に入っていない`);
    if (a.monthlyId) check(monthlyIds.has(a.monthlyId), `${tag}: monthlyId の参照先が無い`);
    if (a.status === 'unscheduled') {
      check(a.start === null && a.end === null, `${tag}: 日時未設定なのに日時がある`);
      check(a.reservationNo === null, `${tag}: 日時未設定なのに予約番号がある`);
    } else {
      const st = parts(a.start), en = parts(a.end);
      check(st && en, `${tag}: 日時の形式が +09:00 付き ISO ではない`);
      if (st && en) {
        check(en.ms - st.ms === a.durationMin * 60000, `${tag}: 終了 ≠ 開始 + ${a.durationMin}分`);
        const inSlot = slots.some(k => {
          const [from, to] = SLOT_HOURS[k] ?? [];
          const dayOk = k.startsWith('holiday') ? isHoliday(st) : !isHoliday(st);
          return dayOk && st.h >= from && (en.h < to || (en.h === to && en.mi === 0));
        });
        check(inSlot, `${tag}: ${a.start} が回答した時間帯 ${slots.join('/')} に入っていない`);
        const plan = planById.get(a.planId);
        const ps = parts(plan?.startedAt);
        if (ps) check(st.ms >= ps.ms && st.ms < ps.ms + 7 * 86400000, `${tag}: 計画の週（${plan.startedAt}〜7日）の外`);
      }
    }
    const cal = a.calendar ?? {};
    if (a.status === 'registered') check(cal.method && cal.confirmedAt, `${tag}: 登録済みなのに calendar.method / confirmedAt が無い`);
    if (a.status === 'scheduled' || a.status === 'unscheduled') check(cal.method === null && cal.confirmedAt === null, `${tag}: 未登録なのに calendar に登録の情報がある`);
    if (cal.confirmedAt && a.createdAt) check(Date.parse(cal.confirmedAt) >= Date.parse(a.createdAt), `${tag}: 登録が作成より前`);

    const recs = s.records.filter(r => r.actionId === a.id);
    if (['done', 'partial', 'not_done'].includes(a.status)) {
      check(recs.length === 1 && recs[0].result === a.status, `${tag}: 状態 ${a.status} と記録が一致しない`);
    } else {
      check(recs.length === 0, `${tag}: 記録があるのに状態が ${a.status}`);
    }
    if (a.origin === 'proposal') check(s.proposals.some(p => p.createdActionId === a.id && p.state === 'approved'), `${tag}: origin=proposal なのに承認済みの提案が無い`);
  }

  // 計画：週は月曜始まり、1週最大3件、最初の1日は最も早い日時の行動に1件
  for (const p of s.plans) {
    const ps = parts(p.startedAt);
    check(ps && ps.dow === 1, `${p.id}: 計画の開始が月曜ではない`);
    check(p.actionIds.length <= 3, `${p.id}: 行動が3件を超える（${p.actionIds.length}件）`);
    for (const id of p.actionIds) check(actionById.get(id)?.planId === p.id, `${p.id}: actionIds の ${id} が無い、または planId が違う`);
    const acts = p.actionIds.map(id => actionById.get(id)).filter(Boolean);
    const firsts = acts.filter(a => a.isFirstDay);
    check(firsts.length <= 1, `${p.id}: 最初の1日が複数`);
    if (p.closedAt) {
      check(acts.every(a => ['done', 'partial', 'not_done', 'skipped'].includes(a.status)), `${p.id}: 閉じた計画に未完了の行動が残っている`);
    } else {
      const dated = acts.filter(a => a.origin === 'tree' && a.start).sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
      if (dated.length) check(firsts.length === 1 && firsts[0].id === dated[0].id, `${p.id}: 最初の1日が最も早い日時の行動に付いていない`);
    }
  }
  check(s.plans.filter(p => p.closedAt === null).length <= 1, '開いている計画が複数');

  for (const r of s.records) {
    const a = actionById.get(r.actionId);
    check(a, `${r.id}: actionId ${r.actionId} の参照先が無い`);
    if (a?.end) check(Date.parse(r.recordedAt) >= Date.parse(a.end), `${r.id}: 終了時刻より前に記録している`);
  }
  for (const p of s.proposals) {
    check(recordById.has(p.recordId), `${p.id}: recordId ${p.recordId} の参照先が無い`);
    if (p.createdActionId) check(actionById.has(p.createdActionId), `${p.id}: createdActionId ${p.createdActionId} の参照先が無い`);
    const rec = recordById.get(p.recordId);
    if (rec && (rec.result === 'not_done' || rec.feeling === 'tired')) check(p.type !== 'next', `${p.id}: できなかった／しんどかったのに「次へ進む」`);
    if (rec) check(Date.parse(p.decidedAt) >= Date.parse(rec.recordedAt), `${p.id}: 記録より前に決定している`);
  }
  for (const h of s.history) {
    check(actionById.has(h.actionId), `${h.id}: actionId ${h.actionId} の参照先が無い`);
    if (h.change === 'reschedule') {
      for (const side of ['before', 'after']) {
        const st = parts(h[side]?.start), en = parts(h[side]?.end);
        check(st && en && en.ms - st.ms === actionById.get(h.actionId)?.durationMin * 60000, `${h.id}: ${side} の終了 ≠ 開始 + 所要時間`);
      }
      const a = actionById.get(h.actionId);
      if (a?.start) check(h.after.start === a.start, `${h.id}: 変更後の日時が行動の日時と違う`);
    }
  }
}

// 状態をまたいだ整合：前の状態で確定したものが、後の状態で消えたり変わったりしない
function checkAcross(persona, states) {
  const order = STATES.filter(n => states[n]);
  for (let i = 1; i < order.length; i++) {
    const prev = states[order[i - 1]], cur = states[order[i]];
    const file = `${persona}/${order[i]}.json`;
    for (const key of ['blank', 'wish', 'answers', 'futureLife', 'tree']) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(cur[key])) fail(file, `${key} が前の状態（${order[i - 1]}）と違う`);
    }
    for (const r of prev.records) if (JSON.stringify(cur.records.find(x => x.id === r.id)) !== JSON.stringify(r)) fail(file, `記録 ${r.id} が消えた／変わった`);
    for (const h of prev.history) if (JSON.stringify(cur.history.find(x => x.id === h.id)) !== JSON.stringify(h)) fail(file, `履歴 ${h.id} が消えた／変わった`);
    for (const a of prev.actions) {
      if (!cur.actions.some(x => x.id === a.id) && !cur.history.some(h => h.change === 'replace' && h.before?.replacedAction?.id === a.id)) {
        fail(file, `行動 ${a.id} が履歴に残らずに消えた`);
      }
    }
  }
}

const { schema, reason } = await loadSchema();
console.log(schema ? 'スキーマ検証: ReserveStateSchema を使う' : `スキーマ検証: 未実施（${reason}）`);

const personas = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
for (const persona of personas) {
  const states = {};
  for (const name of STATES) {
    const path = join(root, persona, `${name}.json`);
    const file = `${persona}/${name}.json`;
    if (!existsSync(path)) { fail(file, 'ファイルが無い'); continue; }
    const text = readFileSync(path, 'utf8');
    for (const w of BANNED) if (text.includes(w)) fail(file, `使わない表現「${w}」が含まれる`);
    let json;
    try { json = JSON.parse(text); } catch (e) { fail(file, `JSON として読めない: ${e.message}`); continue; }
    states[name] = json;
    const before = failures;
    if (json.demoPersona !== persona) fail(file, `demoPersona が ${persona} ではない`);
    checkState(file, json);
    if (schema) {
      const r = schema.safeParse(json);
      if (!r.success) fail(file, `スキーマ不一致: ${JSON.stringify(r.error.issues.slice(0, 5))}`);
    }
    console.log(`${failures === before ? 'OK' : 'NG'} ${file}`);
  }
  checkAcross(persona, states);
}

console.log(failures === 0 ? '\nすべて OK' : `\n失敗 ${failures} 件`);
process.exit(failures === 0 ? 0 : 1);
