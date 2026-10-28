/** Income is a proxy for purchasing capacity, not an observed software tariff. */
export function studiedRegionalFactor(income: number, national: number): number {
  if (!Number.isFinite(income) || !Number.isFinite(national) || income <= 0 || national <= 0)
    throw new Error("Falta un ingreso regional o nacional válido.");
  // Smoothing and bounds are an explicit commercial policy, not DANE results.
  return Math.round(Math.max(0.8, Math.min(1.2, Math.sqrt(income / national))) * 1000000) / 1000000;
}
