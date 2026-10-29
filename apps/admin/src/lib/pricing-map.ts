import type { PricingLocation } from "@nassican/shared";
import type { DivipolaPlace } from "./divipola";
import geometry from "./data/pricing-colombia-map.json";

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function pricingMapDepartments(places: DivipolaPlace[]) {
  const names = new Map(places.map((p) => [p.departmentCode, p.department]));
  return geometry.departments
    .map((d) => ({ ...d, name: names.get(d.code) ?? d.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
export function pricingDepartmentCode(location: PricingLocation, places: DivipolaPlace[]): string {
  if (normalized(location.country) !== "colombia" || !location.department) return "";
  const department = normalized(location.department);
  if (department.startsWith("bogota")) return "11";
  return places.find((p) => normalized(p.department) === department)?.departmentCode ?? "";
}
export function pricingMunicipalityCode(
  location: PricingLocation,
  places: DivipolaPlace[],
): string {
  const department = pricingDepartmentCode(location, places);
  if (!department || !location.municipality) return "";
  const municipality = normalized(location.municipality);
  return (
    places.find(
      (p) =>
        p.departmentCode === department &&
        (normalized(p.municipality) === municipality ||
          (p.code === "11001" && ["bogota", "bogotadc"].includes(municipality))),
    )?.code ?? ""
  );
}
export { geometry as pricingMapGeometry };

export type PricingMapEntry = { available: boolean; detail: string; optionLabel?: string };
export type PricingMapViewport = { x: number; y: number; width: number; height: number };
const [, , mapWidth, mapHeight] = geometry.viewBox;
export const PRICING_MAP_MAX_ZOOM = 32;
export const fullPricingMapViewport = (): PricingMapViewport => ({
  x: 0,
  y: 0,
  width: mapWidth,
  height: mapHeight,
});
export function boundedPricingMapViewport(view: PricingMapViewport): PricingMapViewport {
  const width = Math.max(mapWidth / PRICING_MAP_MAX_ZOOM, Math.min(mapWidth, view.width));
  const height = (width * mapHeight) / mapWidth;
  return {
    width,
    height,
    x: Math.max(0, Math.min(mapWidth - width, view.x)),
    y: Math.max(0, Math.min(mapHeight - height, view.y)),
  };
}
export function zoomPricingMap(view: PricingMapViewport, multiplier: number): PricingMapViewport {
  const width = view.width / multiplier,
    height = view.height / multiplier;
  return boundedPricingMapViewport({
    width,
    height,
    x: view.x + (view.width - width) / 2,
    y: view.y + (view.height - height) / 2,
  });
}
export function fitPricingMap(bounds: number[]): PricingMapViewport {
  const width = Math.max(bounds[2] + 16, ((bounds[3] + 16) * mapWidth) / mapHeight);
  const height = (width * mapHeight) / mapWidth;
  return boundedPricingMapViewport({
    width,
    height,
    x: bounds[0] + bounds[2] / 2 - width / 2,
    y: bounds[1] + bounds[3] / 2 - height / 2,
  });
}
export function pricingMapOptions(
  places: DivipolaPlace[],
  entries: Record<string, PricingMapEntry>,
) {
  return pricingMapDepartments(places).map((d) => ({
    ...d,
    available: entries[d.code]?.available ?? false,
    optionLabel: `${d.name}: ${entries[d.code]?.optionLabel ?? (entries[d.code]?.available ? "con datos locales" : "sin datos locales")}`,
  }));
}
