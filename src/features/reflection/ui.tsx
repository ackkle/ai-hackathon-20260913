'use client';
/**
 * S-13・S-14 の中だけで使う小さな部品。
 * 共通UI部品（shared/ui、担当②・#4）が入ったら、そちらへ寄せる。
 */
import { screenRoutes, type ScreenId } from '@/config/routes';
import type { FeatureMode } from '@/config/features';

export function ScreenHeading({ screenId }: { screenId: ScreenId }) {
  const screen = screenRoutes.find(item => item.id === screenId)!;
  return (
    <>
      <p className="eyebrow">
        RESERVE MACHINE <span>{screenId}</span>
      </p>
      <h1>{screen.title}</h1>
      <p className="intro">{screen.description}</p>
    </>
  );
}

/** 機能モードが mock のときだけ「サンプル」の帯を出す（第10.1節） */
export function ModeBanner({
  mode,
  sample,
  sampleText,
  mockText,
}: {
  mode: FeatureMode;
  sample?: boolean;
  sampleText?: string;
  mockText?: string;
}) {
  const text = sample
    ? sampleText ?? 'サンプル：実際のデータではありません。'
    : mode === 'mock'
      ? mockText ?? 'サンプル：AIの応答は固定のモックです。'
      : null;
  if (text === null) return null;
  return (
    <div className="mode-banner" role="status">
      {text}
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  required,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="mb-6 border-0 p-0 m-0">
      <legend className="text-sm font-semibold mb-2">
        {legend}
        {required && <span className="ml-1 text-[var(--accent)]">（必須）</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`min-h-[44px] cursor-pointer rounded-full border px-4 py-2 text-sm flex items-center ${
                selected
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[#d8e1d3] bg-white text-[var(--ink)]'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
