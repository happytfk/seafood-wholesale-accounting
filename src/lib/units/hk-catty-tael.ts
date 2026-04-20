/**
 * 港式斤兩：16 兩為 1 斤（司馬斤）。
 * 公制常數請與公司磅秤／合約一致；報表匯總至 kg 時應統一經此模組。
 */

export const TAELS_PER_HK_CATTY = 16 as const;

/** 1 司馬斤對應公克（常見 604.8g） */
export const HK_CATTY_GRAMS = 604.8 as const;

export const HK_TAEL_GRAMS = HK_CATTY_GRAMS / TAELS_PER_HK_CATTY;

export type CattyTaelParts = { catties: number; taels: number };

function roundTo(value: number, fractionDigits: number): number {
  const m = 10 ** fractionDigits;
  return Math.round((value + Number.EPSILON) * m) / m;
}

/** 整斤 + 零兩 → 小數斤（例：3 斤 4 兩 → 3.25 斤） */
export function cattyAndTaelToDecimalCatty(parts: CattyTaelParts): number {
  const { catties, taels } = parts;
  if (!Number.isFinite(catties) || !Number.isFinite(taels)) {
    throw new TypeError("斤、兩必須為有效數字");
  }
  if (catties < 0 || taels < 0) {
    throw new RangeError("斤、兩不可為負");
  }
  if (taels >= TAELS_PER_HK_CATTY) {
    throw new RangeError(
      `兩數必須小於 ${TAELS_PER_HK_CATTY}（滿 16 兩請進位到斤）`,
    );
  }
  return catties + taels / TAELS_PER_HK_CATTY;
}

/** 小數斤 → 整斤 + 零兩 */
export function decimalCattyToCattyAndTael(
  decimalCatty: number,
  taelFractionDigits = 6,
): CattyTaelParts {
  if (!Number.isFinite(decimalCatty) || decimalCatty < 0) {
    throw new RangeError("小數斤必須為非負有限數字");
  }
  const catties = Math.floor(decimalCatty);
  const taels = (decimalCatty - catties) * TAELS_PER_HK_CATTY;
  return { catties, taels: roundTo(taels, taelFractionDigits) };
}

export function decimalCattyToKg(
  decimalCatty: number,
  gramsPerCatty: number = HK_CATTY_GRAMS,
): number {
  if (gramsPerCatty <= 0) throw new RangeError("gramsPerCatty 必須為正數");
  return (decimalCatty * gramsPerCatty) / 1000;
}

export function kgToDecimalCatty(
  kg: number,
  gramsPerCatty: number = HK_CATTY_GRAMS,
): number {
  if (gramsPerCatty <= 0) throw new RangeError("gramsPerCatty 必須為正數");
  if (!Number.isFinite(kg) || kg < 0) {
    throw new RangeError("公斤必須為非負有限數字");
  }
  return (kg * 1000) / gramsPerCatty;
}

export function taelToDecimalCatty(taels: number): number {
  if (!Number.isFinite(taels) || taels < 0) {
    throw new RangeError("兩必須為非負有限數字");
  }
  return taels / TAELS_PER_HK_CATTY;
}

export function decimalCattyToTaels(decimalCatty: number): number {
  if (!Number.isFinite(decimalCatty) || decimalCatty < 0) {
    throw new RangeError("小數斤必須為非負有限數字");
  }
  return decimalCatty * TAELS_PER_HK_CATTY;
}

/**
 * 淨重 = 毛重 − 籃重（容器皮重）− 水份等扣減。
 * 開單必填籃重，與資料庫 sales_invoice_lines 欄位對齊。
 */
export function computeNetWeight(input: {
  grossWeight: number;
  basketTare: number;
  moistureDeduction?: number;
}): number {
  const moisture = input.moistureDeduction ?? 0;
  const { grossWeight, basketTare } = input;
  if (![grossWeight, basketTare, moisture].every((n) => Number.isFinite(n))) {
    throw new TypeError("重量必須為有效數字");
  }
  if (grossWeight < 0 || basketTare < 0 || moisture < 0) {
    throw new RangeError("重量不可為負");
  }
  const net = grossWeight - basketTare - moisture;
  if (net < 0) {
    throw new RangeError("淨重不可為負：請檢查毛重、籃重與水份扣減");
  }
  return net;
}

/** 計重計價行金額：淨重 × 單價，四捨五入至分 */
export function lineTotalFromNetWeight(params: {
  netWeight: number;
  unitPrice: number;
  netWeightFractionDigits?: number | null;
}): number {
  const { unitPrice } = params;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new RangeError("單價必須為非負有限數字");
  }
  let w = params.netWeight;
  if (!Number.isFinite(w) || w < 0) {
    throw new RangeError("淨重必須為非負有限數字");
  }
  const fd = params.netWeightFractionDigits;
  if (fd != null) w = roundTo(w, fd);
  return roundTo(w * unitPrice, 2);
}
