"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsChevronLeft, BsChevronRight, BsTrash } from "react-icons/bs";
import type { BudgetScope } from "@nassican/db";
import QuickField from "@/components/QuickField";
import Toast from "@/components/Toast";
import type { ActionResult } from "@/app/(panel)/presupuesto/actions";
import type { BudgetLineView, BudgetView } from "@/lib/budget";
import { monthName, scopeLabels, shiftMonth, type Pace } from "@/lib/budget-draft";
import { formatPartialDate } from "@/lib/draft-fields";
import { sinceLabel } from "@/lib/sync-health";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";

const cop = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** Status words travel with the colour, so the colour is never the only signal. */
const paceText: Record<Pace, { word: string; tone: string; bar: string }> = {
  exceeded: { word: "Superado", tone: "text-red-400", bar: "bg-red-400" },
  over: { word: "Al ritmo actual se pasa", tone: "text-amber-400", bar: "bg-amber-400" },
  ok: { word: "Dentro", tone: "text-green-400", bar: "bg-neutral-300" },
  idle: { word: "Sin gastos", tone: "text-neutral-500", bar: "bg-neutral-600" },
};

/** Days since the last Wallet sync past which the numbers are worth a warning. */
const STALE_SYNC_DAYS = 3;

function Bar({ line }: { line: BudgetLineView }) {
  const filled = Math.min(1, line.ratio) * 100;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-900" aria-hidden>
      <div className={`h-full rounded-full ${paceText[line.pace].bar}`} style={{ width: `${filled}%` }} />
      {/* Where the month is: spending left of this line is on pace. */}
      {line.elapsed > 0 && line.elapsed < 1 ? (
        <div className="absolute top-0 h-full w-0.5 bg-neutral-100" style={{ left: `${line.elapsed * 100}%` }} />
      ) : null}
    </div>
  );
}

/**
 * The month's budget, against the Wallet mirror.
 *
 * It warns before the money is gone, which is the only time a warning is worth
 * anything: each line shows how far into the month it already is, and what it
 * closes at if this pace holds. Wallet itself is never written to.
 */
export default function BudgetModule({
  view,
  actions,
}: {
  view: BudgetView;
  actions: {
    save: (scope: BudgetScope, key: string, limit: string) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<BudgetScope>("group");
  const [key, setKey] = useState("");
  const [limit, setLimit] = useState("");

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  const stale = view.syncDays === null || view.syncDays > STALE_SYNC_DAYS;
  const renewalsCop = view.renewals.reduce((n, r) => n + (r.cop ?? 0), 0);
  const unconverted = view.renewals.filter((r) => r.cop === null);
  const hasTotal = view.lines.some((l) => l.scope === "total");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Presupuesto</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Un límite por mes para los grupos o categorías de Wallet que quieras vigilar, comparado con tus movimientos.
            Avisa cuando, al ritmo que llevas, el mes cerraría por encima. Nunca escribe en Wallet.
          </p>
        </div>
        <nav className="flex items-center gap-1" aria-label="Mes">
          <Link href={`/presupuesto?mes=${shiftMonth(view.month, -1)}`} className={small} aria-label="Mes anterior">
            <BsChevronLeft className="h-3 w-3" aria-hidden />
          </Link>
          <span className="min-w-36 text-center text-sm capitalize text-neutral-200">{monthName(view.month)}</span>
          <Link
            href={`/presupuesto?mes=${shiftMonth(view.month, 1)}`}
            className={`${small} ${view.current ? "pointer-events-none opacity-30" : ""}`}
            aria-label="Mes siguiente"
            aria-disabled={view.current}
          >
            <BsChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </nav>
      </header>

      <p className={`text-xs ${stale ? "text-amber-500" : "text-neutral-500"}`}>
        {view.lastSync
          ? `Movimientos de Wallet sincronizados ${sinceLabel(new Date(view.lastSync))}.`
          : "Wallet no se ha sincronizado nunca."}{" "}
        {stale ? (
          <>
            Lo que gastaste después no está contado:{" "}
            <Link href="/finanzas" className="underline underline-offset-2">
              sincroniza en Movimientos
            </Link>
            .
          </>
        ) : null}
      </p>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen del mes">
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
          <span className={labelClass}>Gastado en {monthName(view.month).split(" ")[0]}</span>
          <span className="font-mono text-xl tabular-nums text-neutral-100">{cop(view.monthSpend)}</span>
          <span className="text-[11px] text-neutral-500">
            {view.current ? `día ${view.day} de ${view.daysInMonth}` : "mes cerrado"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
          <span className={labelClass}>Renovaciones que faltan</span>
          <span className="font-mono text-xl tabular-nums text-neutral-100">{cop(renewalsCop)}</span>
          <span className="text-[11px] text-neutral-500">
            {view.renewals.length === 0
              ? "ninguna este mes"
              : `${view.renewals.length} ${view.renewals.length === 1 ? "suscripción" : "suscripciones"}${
                  unconverted.length > 0 ? ` · ${unconverted.length} sin convertir a pesos` : ""
                }`}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
          <span className={labelClass}>Si compraras lo que quieres</span>
          <span className="font-mono text-xl tabular-nums text-neutral-100">{cop(view.wishlist)}</span>
          <span className="text-[11px] text-neutral-500">juegos, libros y cursos en «lo quiero»</span>
        </div>
      </section>

      {/* ------------------------------ los límites ------------------------------ */}
      <section className="flex flex-col gap-3" aria-labelledby="limites">
        <h2 id="limites" className="text-sm font-semibold">
          Límites
        </h2>
        {view.lines.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-800 px-6 py-10 text-center text-sm text-neutral-500">
            Ningún límite todavía. Empieza por el grupo donde más se te va el dinero — abajo están, de mayor a menor.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {view.lines.map((line) => {
              const pace = paceText[line.pace];
              return (
                <li key={line.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-neutral-100">{line.label}</span>
                      <span className="text-[11px] text-neutral-500">{scopeLabels[line.scope]}</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <QuickField
                        key={`limit:${line.limit}`}
                        label="Límite"
                        value={String(line.limit)}
                        width="w-28"
                        onSave={async (raw) => {
                          const outcome = await actions.save(line.scope, line.key, raw);
                          if (outcome.ok) router.refresh();
                          return outcome;
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Quitar el límite de ${line.label}`}
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`¿Quitar el límite de «${line.label}»?`)) run(() => actions.remove(line.id));
                        }}
                        className="rounded p-1.5 text-neutral-600 transition-colors hover:text-red-400"
                      >
                        <BsTrash className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <Bar line={line} />
                  <p className="flex flex-wrap justify-between gap-x-3 text-xs">
                    <span className="tabular-nums text-neutral-300">
                      {cop(line.spent)} de {cop(line.limit)} · {Math.round(line.ratio * 100)} %
                    </span>
                    <span className={pace.tone}>
                      {pace.word}
                      {line.pace === "over" ? `: cerraría en ${cop(line.projected)}` : ""}
                      {line.pace === "exceeded" ? ` por ${cop(line.spent - line.limit)}` : ""}
                      {line.pace === "ok" && view.current && line.limit > line.spent
                        ? ` · quedan ${cop(line.limit - line.spent)}`
                        : ""}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-neutral-500">
          La línea blanca en cada barra es el día del mes: lo que queda a su izquierda va al ritmo. El ritmo solo avisa desde
          el día 5 — con dos días, una cena proyecta un mes que no va a pasar.
        </p>

        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-900 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => actions.save(scope, key, limit),
              () => {
                setKey("");
                setLimit("");
              },
            );
          }}
        >
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Para</span>
            <select
              className={field}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as BudgetScope);
                setKey("");
              }}
            >
              <option value="group">Un grupo</option>
              <option value="category">Una categoría</option>
              {!hasTotal ? <option value="total">Todo el mes</option> : null}
            </select>
          </label>
          {scope !== "total" ? (
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className={labelClass}>{scope === "group" ? "Grupo" : "Categoría"}</span>
              <select className={field} value={key} onChange={(e) => setKey(e.target.value)}>
                <option value="">Elegir…</option>
                {scope === "group"
                  ? view.options.groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))
                  : view.options.groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {view.options.categories
                          .filter((c) => c.group === g)
                          .map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Límite al mes</span>
            <input className={`${field} w-36`} inputMode="decimal" placeholder="400.000" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
          <button type="submit" className={`${small} border-neutral-700 text-neutral-200`} disabled={pending}>
            Añadir límite
          </button>
        </form>
      </section>

      {view.unbudgeted.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="sin-limite">
          <h2 id="sin-limite" className="text-sm font-semibold">
            Sin límite este mes
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {view.unbudgeted.map((g) => (
              <li key={g.group} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-neutral-300">{g.group}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-neutral-400">{cop(g.spent)}</span>
                  <button
                    type="button"
                    className={small}
                    onClick={() => {
                      setScope("group");
                      setKey(g.group);
                      setLimit("");
                    }}
                  >
                    Poner límite
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.renewals.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="renovaciones">
          <h2 id="renovaciones" className="text-sm font-semibold">
            Renovaciones que faltan este mes
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {view.renewals.map((r) => (
              <li key={`${r.name}-${r.on}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-neutral-300">
                  {r.name} <span className="text-[11px] text-neutral-500">· {formatPartialDate(r.on)}</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-neutral-400">
                  {r.cop !== null ? cop(r.cop) : `${r.price} ${r.currency}`}
                  {r.currency !== "COP" && r.cop !== null ? ` (${r.price} ${r.currency})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}
