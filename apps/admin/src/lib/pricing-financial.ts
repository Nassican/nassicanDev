import type {
  PricingFinancial,
  PricingOrigin,
  PricingParameters,
  PricingTierInput,
} from "@nassican/shared";
import { addMoney, divideMoney, scaleMoney } from "./pricing-engine";
import { fieldProblems, parseNumber } from "./draft-fields";
import {
  financialFields,
  grouped,
  type PricingFinancialDraft,
  type FinancialField,
} from "./pricing-draft";

export function financialToDraft(
  f: PricingFinancial & { id: string; clientId: string },
): PricingFinancialDraft {
  const amounts = Object.fromEntries(financialFields.map((k) => [k, grouped(f[k])])) as Record<
    FinancialField,
    string
  >;
  return { ...f, ...amounts };
}

export const financialLabels: Record<FinancialField, string> = {
  assets: "1 · Activo total / patrimonio bruto",
  currentAssets: "Activo corriente",
  liabilities: "2 · Pasivo total / deudas",
  currentLiabilities: "Pasivo corriente",
  equity: "3 · Patrimonio",
  revenue41: "41 · Ingresos operacionales",
  revenue42: "42 · Otros ingresos",
  expense51: "51 · Administración",
  expense52: "52 · Ventas",
  expense53: "53 · No operacionales",
  expense54: "54 · Impuesto de renta",
  cost61: "61 · Costo de ventas y servicios",
  purchases62: "62 · Compras",
  class7: "7 · Costos de producción",
  depreciation: "Depreciaciones y amortizaciones (5160, 5165, 5260, 5265)",
  inventoryStart: "14 · Inventario inicial",
  inventoryEnd: "14 · Inventario final",
  combinedDeductions: "210 · Costos y deducciones (un solo renglón)",
};
export const niifLabels: Partial<Record<FinancialField, string>> = {
  revenue41: "Ingresos de actividades ordinarias (41)",
  revenue42: "Otros ingresos (42)",
  cost61: "Costo de ventas (61)",
  expense51: "Gastos de administración (51)",
  expense52: "Gastos de distribución o ventas (52)",
  expense53: "Otros gastos y gastos financieros (53)",
  expense54: "Impuesto a las ganancias (54)",
  assets: "Activo total (1)",
  liabilities: "Pasivo total (2)",
  equity: "Patrimonio total (3)",
};
export const financialSourceLabels: Record<PricingFinancial["source"], string> = {
  statements: "Estados financieros",
  tax_return: "Declaración de renta",
  declared: "Declarado por el cliente",
  estimated: "Estimado",
};
export function emptyFinancial(clientId: string): PricingFinancialDraft {
  return {
    id: "",
    clientId,
    start: "",
    end: "",
    annual: true,
    source: "statements",
    format: "puc",
    ...Object.fromEntries(financialFields.map((k) => [k, ""])),
  } as PricingFinancialDraft;
}
export function financialProblems(d: PricingFinancialDraft): string[] {
  const problems = fieldProblems([
    { label: "inicio", value: d.start, kind: "date" },
    { label: "fin", value: d.end, kind: "date" },
    ...financialFields
      .filter((k) => k !== "equity")
      .map((k) => ({ label: financialLabels[k], value: d[k], kind: "amount" as const })),
  ]);
  if (!d.start || !d.end || d.start > d.end || !d.clientId)
    problems.push("Indica cliente y periodo válido, con inicio anterior o igual al fin.");
  if (parseNumber(d.revenue41) === null)
    problems.push("Registra los ingresos operacionales (41); cero es un dato válido.");
  if (d.equity.trim() && parseNumber(d.equity) === null)
    problems.push("El patrimonio debe ser un número, puede ser negativo.");
  return problems;
}
export function readFinancial(d: PricingFinancialDraft): PricingFinancial {
  return {
    start: d.start,
    end: d.end,
    annual: d.annual,
    source: d.source,
    format: d.format,
    ...Object.fromEntries(financialFields.map((k) => [k, parseNumber(d[k])])),
  } as PricingFinancial;
}
export const financialOrigin = (f: PricingFinancial): PricingOrigin =>
  f.source === "estimated" ? "estimated" : f.source === "declared" ? "declared" : "observed";

export function financialAnalysis(f: PricingFinancial, p: PricingParameters) {
  const warnings: string[] = [];
  const explanation: string[] = [];
  let cost: number | null = null;
  let costOrigin = financialOrigin(f);
  if (f.format === "210") {
    cost = f.combinedDeductions;
    explanation.push(
      "Formulario 210: costos y deducciones se restan una sola vez; no se vuelven a restar 51, 52 ni 61.",
    );
  } else if (f.cost61 !== null) {
    cost = f.cost61;
    explanation.push("Costo tomado de 61. No se restan 62 ni clase 7: ya terminan en 61.");
  } else {
    costOrigin = "estimated";
    if (
      p.useInventory &&
      f.inventoryStart !== null &&
      f.purchases62 !== null &&
      f.inventoryEnd !== null
    ) {
      cost = addMoney(f.inventoryStart, f.purchases62, -f.inventoryEnd);
      explanation.push("Sin 61: costo estimado = inventario inicial + 62 menos inventario final.");
    } else if (p.usePurchases && f.purchases62 !== null) {
      cost = f.purchases62;
      explanation.push("Sin 61 ni inventarios completos: 62 es una aproximación del costo.");
    } else if (p.useClass7 && f.purchases62 === null && f.class7 !== null) {
      cost = f.class7;
      explanation.push("Sin 61 ni 62: clase 7 es una aproximación del costo.");
    }
    if (cost === null)
      warnings.push(
        "Falta el costo y no hay una alternativa habilitada con datos. La utilidad y su tope quedan sin dato.",
      );
    else warnings.push("El costo es estimado porque falta 61. La confianza baja.");
  }
  if (cost !== null && cost < 0) {
    cost = null;
    warnings.push(
      "El inventario final supera al inicial más las compras. Revisa los inventarios; el costo queda sin dato.",
    );
  }
  const expensesKnown = f.format === "210" || (f.expense51 !== null && f.expense52 !== null);
  const profit =
    f.revenue41 !== null && cost !== null && expensesKnown
      ? addMoney(
          f.revenue41,
          -cost,
          ...(f.format === "210" ? [] : [-(f.expense51 ?? 0), -(f.expense52 ?? 0)]),
        )
      : null;
  if (!expensesKnown)
    warnings.push(
      "Faltan gastos 51 o 52: escribe cero cuando no existen para poder calcular la utilidad operacional.",
    );
  const net =
    profit !== null && f.revenue42 !== null && f.expense53 !== null && f.expense54 !== null
      ? addMoney(profit, f.revenue42, -f.expense53, -f.expense54)
      : null;
  const ebitda =
    profit !== null && f.depreciation !== null ? addMoney(profit, f.depreciation) : null;
  const margin =
    profit !== null && f.revenue41 !== null && f.revenue41 > 0 ? profit / f.revenue41 : null;
  const derivedEquity =
    f.assets !== null && f.liabilities !== null ? addMoney(f.assets, -f.liabilities) : null;
  if (
    derivedEquity !== null &&
    f.equity !== null &&
    Math.abs(addMoney(derivedEquity, -f.equity)) > 0.01
  )
    warnings.push(
      "El patrimonio no cuadra con activo menos pasivo. Para salud financiera se usa el patrimonio calculado.",
    );
  const debt =
    f.assets !== null && f.assets > 0 && f.liabilities !== null ? f.liabilities / f.assets : null;
  const liquidity =
    f.currentAssets !== null && f.currentLiabilities !== null && f.currentLiabilities > 0
      ? f.currentAssets / f.currentLiabilities
      : null;
  const multipliers: { reason: string; factor: number }[] = [];
  if ((derivedEquity ?? f.equity ?? 0) < 0) {
    multipliers.push({ reason: "Patrimonio negativo", factor: p.negativeEquityFactor });
    warnings.push("Patrimonio negativo: cobrar por hitos con anticipo.");
  } else if (debt !== null && debt > p.debtHigh) {
    multipliers.push({ reason: "Endeudamiento alto", factor: p.debtHighFactor });
    warnings.push("Endeudamiento alto: pide anticipo.");
  } else if (debt !== null && debt > p.debtLow)
    multipliers.push({ reason: "Endeudamiento medio", factor: p.debtMediumFactor });
  else if (debt !== null) multipliers.push({ reason: "Endeudamiento bajo", factor: 1 });
  if (margin !== null)
    multipliers.push({
      reason: "Margen operacional",
      factor:
        margin < 0
          ? p.negativeMarginFactor
          : margin < p.marginLow
            ? p.lowMarginFactor
            : margin <= p.marginHigh
              ? 1
              : p.highMarginFactor,
    });
  if (liquidity !== null && liquidity < p.liquidityThreshold) {
    multipliers.push({ reason: "Liquidez baja", factor: p.liquidityFactor });
    warnings.push("Liquidez baja: acuerda pagos por hitos.");
  }
  const health = Math.max(
    0.5,
    p.healthMinimum,
    multipliers.reduce((value, m) => value * m.factor, 1),
  );
  const divisor = f.annual ? 12 : 1;
  const monthlyRevenue = f.revenue41 === null ? null : divideMoney(f.revenue41, divisor);
  const monthlyProfit = profit === null ? null : divideMoney(profit, divisor);
  explanation.push(
    `Periodo ${f.start} a ${f.end}: ${f.annual ? "anual, se divide entre 12" : "mensual"}. Ingresos mensuales: ${monthlyRevenue ?? "sin dato"}.`,
  );
  explanation.push(
    `Utilidad operacional = 41 menos 51, 52 y costo, sin doble conteo: ${profit ?? "sin dato"}.`,
  );
  explanation.push(
    `Salud financiera: ${multipliers.map((m) => `${m.reason} × ${m.factor}`).join(", ") || "sin indicadores"}; producto con mínimo ${Math.max(0.5, p.healthMinimum)} = ${health}.`,
  );
  return {
    cost,
    costOrigin,
    profit,
    net,
    ebitda,
    margin,
    debt,
    liquidity,
    equity: derivedEquity ?? f.equity,
    health,
    multipliers,
    monthlyRevenue,
    monthlyProfit,
    warnings,
    explanation,
  };
}

export function companyCapacity(
  f: PricingFinancial,
  tiers: PricingTierInput[],
  p: PricingParameters,
) {
  const analysis = financialAnalysis(f, p);
  const warnings = [...analysis.warnings];
  const explanation = [...analysis.explanation];
  const revenue = analysis.monthlyRevenue;
  const tier =
    revenue === null
      ? undefined
      : tiers.find((t) => revenue >= t.fromIncome && (t.toIncome === null || revenue < t.toIncome));
  let amount: number | null = null;
  if (tier && revenue !== null) {
    const base = Math.min(tier.maximum, Math.max(tier.minimum, scaleMoney(revenue, tier.percent)));
    amount = Math.min(tier.maximum, scaleMoney(base, analysis.health));
    explanation.push(
      `Capacidad: ingresos mensuales ${revenue} × ${tier.percent}, limitada entre ${tier.minimum} y ${tier.maximum}, × salud ${analysis.health}, sin superar ${tier.maximum}: ${amount} COP.`,
    );
    if (analysis.monthlyProfit !== null) {
      const cap = Math.max(0, scaleMoney(analysis.monthlyProfit, p.profitCap));
      if (amount > cap) {
        amount = cap;
        warnings.push(
          `Actuó el tope por utilidad: ${analysis.monthlyProfit} × ${p.profitCap} = ${cap} COP mensuales.`,
        );
      }
    } else
      warnings.push(
        "No se pudo aplicar el tope por utilidad; falta información contable. La capacidad queda estimada.",
      );
  } else warnings.push("No hay un tramo de ingresos que corresponda a este periodo.");
  const origin: PricingOrigin =
    amount === null
      ? "missing"
      : analysis.costOrigin === "estimated" || analysis.monthlyProfit === null
        ? "estimated"
        : financialOrigin(f);
  return { amount, origin, analysis, warnings, explanation };
}
