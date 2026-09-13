/**
 * AI出力の一部を伏せたときの知らせ（F-30）。
 * 伏せた事実を隠さず、その場で伝える（仕様書 第14.1節）。
 */
export function MaskedNotice({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="rounded-md border border-[#e3d9b8] bg-[#fdf8e8] px-3 py-2 text-xs" role="status">
      使わないことにしている表現が含まれていたため、{count}か所を伏せています。
    </p>
  );
}
