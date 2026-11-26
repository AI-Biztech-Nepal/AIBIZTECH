// A round number at or above the largest value, so a chart's top line reads cleanly (1, 2, 2.5, 5 or 10 times a power of ten)
export function niceMax(values: number[]): number {
  const top = Math.max(0, ...values);
  if (!top) return 1;
  const unit = 10 ** Math.floor(Math.log10(top));
  return [1, 2, 2.5, 5, 10].map((step) => step * unit).find((n) => n >= top)!;
}

// Axis labels in Nepali units: thousand, lakh, crore
export function shortAmount(n: number): string {
  const cut = (v: number, suffix: string) => `${Math.round(v * 10) / 10}${suffix}`;
  return n >= 1e7 ? cut(n / 1e7, 'Cr') : n >= 1e5 ? cut(n / 1e5, 'L') : n >= 1e3 ? cut(n / 1e3, 'k') : String(Math.round(n));
}
