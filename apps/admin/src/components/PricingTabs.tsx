import Link from "next/link";

export const pricingTabs = [
  ["calculate", "Calcular", "/precios"],
  ["quotes", "Cotizaciones", "/precios/cotizaciones"],
  ["billing", "Cuotas y cobros", "/precios/cobros"],
  ["market", "Mercado", "/precios/mercado"],
  ["regions", "Regiones", "/precios/regiones"],
  ["settings", "Parámetros", "/precios/parametros"],
] as const;
export default function PricingTabs({ current }: { current: (typeof pricingTabs)[number][0] }) {
  return (
    <nav
      aria-label="Secciones de Precios"
      className="flex gap-1 overflow-x-auto border-b border-neutral-900"
    >
      {pricingTabs.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={key === current ? "page" : undefined}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${key === current ? "border-neutral-200 font-medium text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-200"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
