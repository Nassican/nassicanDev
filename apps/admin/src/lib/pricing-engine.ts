import type {
  PricingInput,
  PricingParameters,
  PricingResult,
  PricingOrigin,
} from "@nassican/shared";

export const defaultPricingParameters: PricingParameters = {
  targetIncome: 6000000,
  fixedCosts: 1000000,
  billableHours: 100,
  margin: 0.3,
  familyDiscount: 0.2,
  projectWeight: 0.5,
  capacityWeight: 0.25,
  marketWeight: 0.25,
  rounding: 100000,
  familyRounding: 1000000,
  confidenceHigh: 0.75,
  confidenceMedium: 0.5,
  outlierMultiplier: 3,
  profitCap: 0.2,
  debtLow: 0.6,
  debtHigh: 0.8,
  debtMediumFactor: 0.85,
  debtHighFactor: 0.7,
  negativeEquityFactor: 0.5,
  marginLow: 0.05,
  marginHigh: 0.15,
  negativeMarginFactor: 0.7,
  lowMarginFactor: 0.85,
  highMarginFactor: 1.1,
  liquidityThreshold: 1,
  liquidityFactor: 0.85,
  healthMinimum: 0.5,
  useInventory: true,
  usePurchases: true,
  useClass7: true,
  quoteMaxMonths: 18,
  transport: 0,
  lodging: 0,
  food: 0,
};

// Decimal fractions and integer cents preserve annual division and fractional
// weights without shipping Prisma to the browser. Rounding happens in cents,
// not in the rate: rounding 1/12 first loses pesos on large annual revenues.
function fraction(n: number): [bigint, bigint] {
  if (!Number.isFinite(n)) throw new Error("El importe debe ser finito.");
  const [mantissa, exponent = "0"] = n.toString().split("e");
  const decimalPlaces = (mantissa.split(".")[1]?.length ?? 0) - Number(exponent);
  const numerator = BigInt(mantissa.replace(".", ""));
  return decimalPlaces >= 0
    ? [numerator, BigInt(10) ** BigInt(decimalPlaces)]
    : [numerator * BigInt(10) ** BigInt(-decimalPlaces), BigInt(1)];
}
function rounded(n: bigint, d: bigint): bigint {
  if (d <= BigInt(0)) throw new Error("El divisor debe ser positivo.");
  return (n + (n < BigInt(0) ? BigInt(-1) : BigInt(1)) * (d / BigInt(2))) / d;
}
const cents = (n: number) => {
  const [a, b] = fraction(n);
  return rounded(a * BigInt(100), b);
};
export const addMoney = (...values: number[]) =>
  Number(values.reduce((sum, n) => sum + cents(n), BigInt(0))) / 100;
export function scaleMoney(amount: number, factor: number): number {
  const [a, b] = fraction(factor);
  return Number(rounded(cents(amount) * a, b)) / 100;
}
export function divideMoney(amount: number, divisor: number): number {
  const [a, b] = fraction(divisor);
  return Number(rounded(cents(amount) * b, a)) / 100;
}

/** Use a smaller commercial step for small amounts, without losing cents. */
export function roundPricingAmount(amount: number, configuredStep: number, down = false) {
  if (!Number.isFinite(configuredStep) || configuredStep < 0.01)
    throw new Error("El paso de redondeo debe ser al menos 0,01 COP.");
  if (amount < 0) throw new Error("El importe para redondear debe ser positivo.");
  const step =
    amount > 0 && amount < configuredStep
      ? Math.min(configuredStep, Math.max(0.01, 10 ** (Math.floor(Math.log10(amount)) - 1)))
      : configuredStep;
  const units = cents(step);
  const value = cents(amount);
  return {
    step,
    amount: Number(((value + (down ? BigInt(0) : units - BigInt(1))) / units) * units) / 100,
  };
}

export function calculatePricing(input: PricingInput, settings: PricingParameters): PricingResult {
  if (
    input.family &&
    (!Number.isFinite(settings.familyDiscount) ||
      settings.familyDiscount < 0 ||
      settings.familyDiscount > 1)
  ) {
    throw new Error("El descuento familiar debe estar entre 0 y 100 %.");
  }
  if (settings.billableHours <= 0 || settings.rounding <= 0 || input.hours <= 0) {
    throw new Error("Las horas y el redondeo deben ser mayores que cero.");
  }
  const hourlyCost = divideMoney(
    addMoney(settings.targetIncome, settings.fixedCosts),
    settings.billableHours,
  );
  const targetRate = scaleMoney(hourlyCost, 1 + settings.margin);
  const travel =
    input.mode === "remote"
      ? 0
      : scaleMoney(addMoney(settings.transport, settings.lodging, settings.food), input.travelDays);
  const rawFloor = addMoney(scaleMoney(hourlyCost, input.hours), input.directCosts, travel);
  const floor = Math.max(input.minimum, rawFloor);
  const project = addMoney(scaleMoney(targetRate, input.hours), input.directCosts);
  const monthlyCapacity =
    input.capacity ??
    (input.monthlyIncome === null ? null : scaleMoney(input.monthlyIncome, input.incomePercent));
  const capacity =
    monthlyCapacity === null
      ? null
      : input.unit === "hour"
        ? divideMoney(monthlyCapacity, settings.billableHours)
        : monthlyCapacity;
  const capacityOrigin = input.capacity === null ? input.incomeOrigin : input.capacityOrigin;
  const projectOrigin: PricingOrigin =
    input.hoursOrigin === "missing" || input.costsOrigin === "missing"
      ? "missing"
      : input.hoursOrigin === "estimated" || input.costsOrigin === "estimated"
        ? "estimated"
        : input.hoursOrigin === "declared" || input.costsOrigin === "declared"
          ? "declared"
          : "observed";
  const refs = [
    {
      criterion: "project" as const,
      reference: project,
      weight: settings.projectWeight,
      origin: projectOrigin,
    },
    {
      criterion: "capacity" as const,
      reference: capacity,
      weight: settings.capacityWeight,
      origin: capacityOrigin,
    },
    {
      criterion: "market" as const,
      reference: input.market,
      weight: settings.marketWeight,
      origin: input.marketOrigin,
    },
  ];
  const available = refs.filter((r): r is typeof r & { reference: number } => r.reference !== null);
  const weightSum = available.reduce((s, r) => s + r.weight, 0);
  const contributions = available.map((r) => {
    const weight = weightSum > 0 ? r.weight / weightSum : 1 / available.length;
    return {
      ...r,
      weight,
      amount:
        weightSum > 0
          ? divideMoney(scaleMoney(r.reference, r.weight), weightSum)
          : divideMoney(r.reference, available.length),
    };
  });
  const weighted = addMoney(...contributions.map((r) => r.amount));
  // Rounding upward preserves the floor even when it is between two steps.
  const normalRounding = roundPricingAmount(Math.max(floor, weighted), settings.rounding);
  const normal = normalRounding.amount;
  // Apply the full discount, then a downward commercial adjustment. Direct
  // costs and travel remain payable even when the fees are completely waived.
  const fee = Math.max(0, addMoney(normal, -input.directCosts, -travel));
  const requestedDiscount = input.family ? scaleMoney(fee, settings.familyDiscount) : 0;
  const discounted = addMoney(normal, -requestedDiscount);
  const familyRounding = input.family
    ? roundPricingAmount(discounted, settings.familyRounding ?? 1000000, true)
    : null;
  const suggested = familyRounding
    ? Math.max(addMoney(input.directCosts, travel), familyRounding.amount)
    : normal;
  const family = input.family
    ? {
        percent: settings.familyDiscount,
        normal,
        fee,
        discount: addMoney(normal, -suggested),
        limitedByFloor: false,
        unrestricted: true,
        percentageDiscount: requestedDiscount,
        roundingStep: familyRounding!.step,
        roundingDiscount: addMoney(discounted, -suggested),
      }
    : undefined;
  const minimumReference = Math.min(...available.map((r) => r.reference));
  const range: [number, number] = [
    Math.max(floor, minimumReference),
    Math.max(floor, ...available.map((r) => r.reference)),
  ];
  const origins = [input.hoursOrigin, input.costsOrigin, capacityOrigin, input.marketOrigin];
  const evidence =
    origins.filter((o) => o === "observed" || o === "declared").length / origins.length;
  const confidence =
    evidence >= settings.confidenceHigh
      ? "high"
      : evidence >= settings.confidenceMedium
        ? "medium"
        : "low";
  const warnings: string[] = [];
  if (family && suggested < floor)
    warnings.push(
      "La tarifa familiar queda por debajo del piso de costos. El descuento se aplica completo.",
    );
  if (capacity !== null && capacity < floor)
    warnings.push(
      family
        ? "La capacidad está por debajo del piso. Revisa el alcance y las condiciones de pago."
        : "La capacidad está por debajo del piso. Reduce el alcance, cobra en cuotas o no tomes el proyecto. El precio no se reduce.",
    );
  if (available.length < refs.length)
    warnings.push(
      "Los pesos de los criterios sin dato se repartieron entre las referencias disponibles.",
    );
  if (weightSum === 0)
    warnings.push("Los pesos disponibles sumaban cero: se usaron partes iguales.");
  if (input.unit === "project" && capacity !== null)
    warnings.push(
      "La capacidad es un presupuesto mensual; para un proyecto representa una cuota de ese presupuesto, sin multiplicar meses.",
    );
  const explanation = [
    `Costo por hora: (${settings.targetIncome} + ${settings.fixedCosts}) ÷ ${settings.billableHours} = ${hourlyCost} COP.`,
    `Piso: máximo entre ${input.minimum} y (${input.hours} × ${hourlyCost} + ${input.directCosts} + ${travel}) = ${floor} COP.`,
    `Proyecto: ${input.hours} × ${targetRate} + ${input.directCosts} = ${project} COP.`,
    `Suma de aportes: ${weighted} COP. Se aplica el piso y se redondea hacia arriba en pasos de ${normalRounding.step} COP: ${normal} COP.${input.family ? " Antes del descuento familiar." : ""}`,
    `Confianza: ${Math.round(evidence * 100)} % de entradas observadas o declaradas (${origins.join(", ")}).`,
  ];
  if (family)
    explanation.push(
      `Tarifa familiar: ${family.percent * 100} % sobre honorarios de ${fee} COP = ${requestedDiscount} COP de descuento, sin límite por piso. Después se redondea hacia abajo en pasos de ${family.roundingStep} COP: ajuste adicional ${family.roundingDiscount} COP. Los ${input.directCosts} COP de costos directos y ${travel} COP de viáticos se conservan. Descuento efectivo total: ${family.discount} COP. Sugerido familiar: ${suggested} COP.`,
    );
  if (input.unit === "hour" && monthlyCapacity !== null)
    explanation.push(
      `Capacidad horaria: presupuesto mensual ${monthlyCapacity} ÷ ${settings.billableHours} horas facturables = ${capacity} COP/hora.`,
    );
  return {
    hourlyCost,
    targetRate,
    travel,
    floor,
    project,
    capacity,
    market: input.market,
    suggested,
    ...(family ? { family } : {}),
    range,
    effectiveHourly: divideMoney(suggested, input.hours),
    confidence,
    evidence,
    contributions,
    warnings,
    explanation,
  };
}
