import type { PricingMode, PricingScope, PricingUnit } from "@nassican/shared";
import type { DivipolaPlace } from "./divipola";
import { marketRegionComparison, type MarketQuoteInput } from "./pricing-market";
import { pricingDepartmentCode, pricingMunicipalityCode, pricingMapGeometry } from "./pricing-map";
import { fold } from "./list-filters";

export type MarketComparisonFilters = {
  serviceId: string;
  scope: PricingScope | "all";
  unit: PricingUnit | "all";
  mode: PricingMode | "all";
  departmentCode: string;
  municipalityCode: string;
};
export function marketComparisonFromParams(
  services: { id: string }[],
  params: Record<string, string | string[] | undefined>,
  places: DivipolaPlace[] = [],
): MarketComparisonFilters {
  const one = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const serviceId = one("serviceId");
  const scope = one("scope"),
    unit = one("unit"),
    mode = one("mode"),
    department = one("departmentCode"),
    municipality = one("municipalityCode");
  return {
    serviceId: serviceId && services.some((s) => s.id === serviceId) ? serviceId : "all",
    scope: scope === "basic" || scope === "standard" || scope === "advanced" ? scope : "all",
    unit: unit === "project" || unit === "monthly" || unit === "hour" ? unit : "all",
    mode: mode === "remote" || mode === "onsite" || mode === "hybrid" ? mode : "all",
    departmentCode:
      department === "national" || pricingMapGeometry.departments.some((d) => d.code === department)
        ? department!
        : "",
    municipalityCode: places.some((p) => p.code === municipality && p.departmentCode === department)
      ? municipality!
      : "",
  };
}
export function marketComparisonOverview(
  quotes: MarketQuoteInput[],
  filters: MarketComparisonFilters,
  settings: { today: string; maxMonths: number; outlierMultiplier: number },
  trm: { value: number; date: string } | null,
  places: DivipolaPlace[],
) {
  const matching = quotes.filter(
    (q) =>
      (filters.serviceId === "all" || q.serviceId === filters.serviceId) &&
      (filters.scope === "all" || q.scope === filters.scope) &&
      (filters.unit === "all" || q.unit === filters.unit) &&
      (filters.mode === "all" || q.mode === filters.mode),
  );
  const buckets = new Map<string, MarketQuoteInput[]>();
  for (const q of matching) {
    const key = `${q.serviceId}:${q.scope}:${q.unit}:${q.mode}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(q);
    else buckets.set(key, [q]);
  }
  const results = [...buckets.entries()].map(([key, bucket]) => {
    const selection = {
      serviceId: bucket[0].serviceId,
      scope: bucket[0].scope,
      unit: bucket[0].unit,
      mode: bucket[0].mode,
    };
    const comparison = marketRegionComparison(bucket, { ...selection, ...settings }, trm);
    return { key, selection, bucket, comparison };
  });
  const allRows = results.flatMap(({ key, selection, bucket, comparison }) =>
    comparison.groups.map((group) => {
      const rows = bucket.filter((q) => group.evidenceIds.includes(q.id));
      return {
        ...selection,
        ...group,
        key: `${key}:${group.key}`,
        quotes: rows,
        providers: new Set(rows.map((q) => fold(q.provider))).size,
        departmentCode: pricingDepartmentCode(group.location, places),
        municipalityCode: pricingMunicipalityCode(group.location, places),
      };
    }),
  );
  const departmentRows = allRows.filter(
    (row) =>
      !filters.departmentCode ||
      (filters.departmentCode === "national"
        ? fold(row.location.country) === "colombia" &&
          !row.location.department &&
          !row.location.municipality
        : row.departmentCode === filters.departmentCode),
  );
  const rows = departmentRows.filter(
    (row) => !filters.municipalityCode || row.municipalityCode === filters.municipalityCode,
  );
  return {
    rows,
    allRows,
    count: rows.reduce((sum, row) => sum + row.count, 0),
    nationalCount: allRows
      .filter(
        (row) =>
          fold(row.location.country) === "colombia" &&
          !row.location.department &&
          !row.location.municipality,
      )
      .reduce((sum, row) => sum + row.count, 0),
    excluded: matching.length - allRows.reduce((sum, row) => sum + row.count, 0),
    notes: [...new Set(results.flatMap((result) => result.comparison.notes))],
  };
}

export function marketMunicipalityOptions(
  rows: { departmentCode: string; municipalityCode: string; count: number }[],
  departmentCode: string,
  places: DivipolaPlace[],
) {
  const counts = new Map<string, number>();
  for (const row of rows)
    if (row.departmentCode === departmentCode && row.municipalityCode)
      counts.set(row.municipalityCode, (counts.get(row.municipalityCode) ?? 0) + row.count);
  return places
    .filter((p) => p.departmentCode === departmentCode && (counts.get(p.code) ?? 0) > 0)
    .map((p) => ({
      value: p.code,
      label: `${p.municipality}: ${counts.get(p.code)} ${counts.get(p.code) === 1 ? "comparable" : "comparables"}`,
      count: counts.get(p.code)!,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
