import type { PricingUnit } from "@nassican/shared";
import { addMoney } from "./pricing-engine";

export type PricingPackagePart = {
  id: string;
  name: string;
  unit: PricingUnit;
  typicalHours: number;
  minimum: number;
  incomePercent: number;
  recommendedPrice: number | null;
  active: boolean;
  componentIds: string[];
};

export type PricingQuoteService = PricingPackagePart & {
  description?: string | null;
  components: PricingPackagePart[];
};

/** A quote can combine catalog packages and leaves without charging a leaf twice. */
export function composeQuoteServices(ids: string[], services: PricingQuoteService[]) {
  if (!ids.length) throw new Error("Selecciona al menos un servicio.");
  if (new Set(ids).size !== ids.length) throw new Error("Elige cada servicio una sola vez.");
  const selectedServices = ids.map((id) => {
    const service = services.find((s) => s.id === id);
    if (!service || !service.active) throw new Error("Uno de los servicios ya no está disponible.");
    return service;
  });
  const first = selectedServices[0];
  if (selectedServices.some((s) => s.unit !== first.unit))
    throw new Error("Combina servicios con la misma unidad de cobro: proyecto, mes u hora.");
  const components = selectedServices.flatMap((s) => (s.components.length ? s.components : [s]));
  const seen = new Set<string>();
  for (const part of components) {
    if (!part.active || part.unit !== first.unit || part.componentIds.length)
      throw new Error("Revisa los componentes activos y la unidad de los servicios seleccionados.");
    if (seen.has(part.id))
      throw new Error(`${part.name} ya está incluido en otro servicio seleccionado.`);
    seen.add(part.id);
  }
  if (selectedServices.length === 1) return { ...first, selectedServices };
  return {
    id: first.id,
    name: selectedServices.map((s) => s.name).join(" + "),
    unit: first.unit,
    // An hourly quote remains one combined hourly rate, as for catalog packages.
    typicalHours:
      first.unit === "hour" ? 1 : addMoney(...selectedServices.map((s) => s.typicalHours)),
    minimum: addMoney(...selectedServices.map((s) => s.minimum)),
    incomePercent: Math.max(...selectedServices.map((s) => s.incomePercent)),
    recommendedPrice: selectedServices.every((s) => s.recommendedPrice !== null)
      ? addMoney(...selectedServices.map((s) => s.recommendedPrice!))
      : null,
    description: selectedServices.map((s) => `${s.name}: ${s.description ?? ""}`).join("\n\n"),
    active: true,
    componentIds: components.map((p) => p.id),
    components,
    selectedServices,
  };
}

/** A package is a flat, same-unit deliverable with one customer budget. */
export function composePricingPackage(
  parts: PricingPackagePart[],
  unit: PricingUnit,
  packageId?: string,
) {
  if (parts.length < 2) throw new Error("Un paquete necesita al menos dos servicios.");
  if (new Set(parts.map((p) => p.id)).size !== parts.length)
    throw new Error("Un servicio no puede repetirse en el paquete.");
  if (
    parts.some((p) => p.id === packageId || p.componentIds.length || !p.active || p.unit !== unit)
  )
    throw new Error(
      "Usa servicios activos, de la misma unidad y que no sean paquetes ni el propio servicio.",
    );
  return {
    typicalHours: addMoney(...parts.map((p) => p.typicalHours)),
    minimum: addMoney(...parts.map((p) => p.minimum)),
    incomePercent: Math.max(...parts.map((p) => p.incomePercent)),
    recommendedPrice: parts.every((p) => p.recommendedPrice !== null)
      ? addMoney(...parts.map((p) => p.recommendedPrice!))
      : null,
  };
}
