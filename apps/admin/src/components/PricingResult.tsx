import type { PricingResult as Result, PricingSnapshot } from "@nassican/shared";
import { confidenceLabels, originLabels, pricingMoney as money } from "@/lib/pricing-draft";
import { marketStats } from "@/lib/pricing-market";

export default function PricingResult({
  result: r,
  snapshot,
}: {
  result: Result;
  snapshot?: PricingSnapshot;
}) {
  const market = marketStats(
    snapshot?.marketEvidence.map((q) => q.adjusted) ?? [],
    snapshot?.parameters.outlierMultiplier,
  );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-neutral-500">
          Precio sugerido{r.family ? " familiar" : ""}, COP (estimado)
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          {money(r.suggested)}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Confianza {confidenceLabels[r.confidence].toLowerCase()}: {Math.round(r.evidence * 100)} %
          de evidencia observada o declarada.
        </p>
      </div>
      {r.family ? (
        <p className="rounded border border-neutral-800 p-3 text-xs text-neutral-300">
          Tarifa familiar: {Math.round(r.family.percent * 10000) / 100} % sobre honorarios. Sugerido
          normal: {money(r.family.normal)}. Descuento efectivo: {money(r.family.discount)}.
          {r.family.unrestricted
            ? " Descuento completo, sin límite por costos ni redondeo adicional."
            : r.family.limitedByFloor
              ? " Limitado por el piso de costos."
              : " Se conserva el redondeo configurado."}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Piso por costos</dt>
          <dd className="tabular-nums">{money(r.floor)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Mercado</dt>
          <dd>
            {r.market === null
              ? (snapshot?.service.selectedServices?.length ?? 0) > 1
                ? "Sin referencia conjunta"
                : "Sin dato"
              : money(r.market)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Rango de referencias, antes del redondeo</dt>
          <dd>
            {money(r.range[0])} a {money(r.range[1])}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Tarifa efectiva sugerida</dt>
          <dd>{money(r.effectiveHourly)} / hora</dd>
        </div>
      </dl>
      {snapshot?.service.components?.length ? (
        <div className="text-xs text-neutral-500">
          <p className="font-medium">
            {(snapshot.service.selectedServices?.length ?? 0) > 1
              ? "Servicios incluidos en la cotización"
              : "Servicios incluidos en el paquete"}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {snapshot.service.components.map((p) => (
              <li key={p.id}>
                {p.name}: {p.hours} h, mínimo {money(p.minimum)}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {snapshot ? (
        <p className="text-xs text-neutral-500">
          Origen del piso y del proyecto: horas{" "}
          {originLabels[snapshot.inputs.hoursOrigin].toLowerCase()}, costos directos{" "}
          {originLabels[snapshot.inputs.costsOrigin].toLowerCase()} y parámetros declarados.
          Viáticos: días estimados y gastos diarios configurados. La tarifa efectiva se deriva del
          precio y las horas.
        </p>
      ) : null}
      {snapshot ? (
        <p className="text-xs text-neutral-500">
          Ubicación: factor {snapshot.geography.factor.toLocaleString("es-CO")} (
          {originLabels[snapshot.geography.origin]}, {snapshot.geography.level}
          ). {snapshot.geography.explanation}
        </p>
      ) : null}
      {market.count ? (
        <p className="text-xs text-neutral-500">
          Mercado: {market.count} comparables ({originLabels[snapshot!.inputs.marketOrigin]}).
          Mínimo {money(market.minimum!)}, máximo {money(market.maximum!)}.
          {market.outlier ? ` Valor atípico: mediana ${money(market.median!)}.` : ""}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="mb-2 text-left font-medium text-neutral-200">
            Aportes al sugerido antes del piso y redondeo
          </caption>
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2">Criterio</th>
              <th>Referencia</th>
              <th>Peso</th>
              <th>Aporte</th>
            </tr>
          </thead>
          <tbody>
            {r.contributions.map((c) => (
              <tr key={c.criterion} className="border-t border-neutral-900">
                <td className="py-2">
                  {
                    {
                      project: "Proyecto",
                      capacity: "Capacidad",
                      market: "Mercado",
                    }[c.criterion]
                  }
                  <span className="block text-neutral-500">{originLabels[c.origin]}</span>
                </td>
                <td>{money(c.reference)}</td>
                <td>{Math.round(c.weight * 100)} %</td>
                <td>{money(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {[...r.warnings, ...(snapshot?.notes ?? [])].map((w, i) => (
        <p key={i} className="rounded border border-amber-900 p-3 text-xs text-amber-300">
          {w}
        </p>
      ))}
      <details>
        <summary className="cursor-pointer text-xs text-neutral-300">Cómo se calculó</summary>
        <ul className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-neutral-500">
          {r.explanation.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
