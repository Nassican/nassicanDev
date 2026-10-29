import type {
  PricingFinancial,
  PricingInput,
  PricingParameters,
  PricingTierInput,
} from "@nassican/shared";
import { companyCapacity, financialAnalysis, financialOrigin } from "./pricing-financial";
import {
  regionalIncomeForLocation,
  type IncomeEstimateInput,
  type RegionFactorInput,
} from "./pricing-geography";

/** Match the server's income priority before the market-comparables review. */
export function livePricingInput(
  input: PricingInput,
  client: {
    type: string;
    country: string;
    department: string | null;
    municipality: string | null;
    stratum: number | null;
  },
  financial: PricingFinancial | null,
  parameters: PricingParameters,
  tiers: PricingTierInput[],
  geography: { incomes: IncomeEstimateInput[]; factors: RegionFactorInput[] },
  serviceId: string,
) {
  const result = { ...input };
  if (client.type === "company") {
    result.monthlyIncome = null;
    result.incomeOrigin = "missing";
    if (financial) {
      const capacity = companyCapacity(financial, tiers, parameters);
      result.capacity = capacity.amount;
      result.capacityOrigin = capacity.origin;
    }
    return { input: result, estimate: null };
  }
  if (result.monthlyIncome === null && financial) {
    result.monthlyIncome = financialAnalysis(financial, parameters).monthlyRevenue;
    result.incomeOrigin = financialOrigin(financial);
  }
  if (result.monthlyIncome !== null) return { input: result, estimate: null };
  const reference = regionalIncomeForLocation(
    geography.incomes,
    geography.factors,
    {
      country: client.country,
      department: client.department ?? "",
      municipality: client.municipality ?? "",
    },
    client.stratum,
    serviceId,
    input.mode,
  );
  if (reference) {
    result.monthlyIncome = reference.income;
    result.incomeOrigin = "estimated";
  }
  return { input: result, estimate: reference?.estimate ?? null };
}
