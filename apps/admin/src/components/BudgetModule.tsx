"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsArchive, BsPencil, BsPlus, BsTags } from "react-icons/bs";
import QuickField from "@/components/QuickField";
import Toast from "@/components/Toast";
import type { ActionResult } from "@/app/(panel)/presupuesto/actions";
import type { BudgetCard, BudgetView } from "@/lib/budget";
import { monthName, type Pace } from "@/lib/budget-draft";
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

const typeLabel: Record<string, string> = {
  BUDGET_INTERVAL_MONTH: "mensual",
  BUDGET_INTERVAL_WEEK: "semanal",
  BUDGET_INTERVAL_YEAR: "anual",
  BUDGET_CUSTOM: "personalizado",
};

type Actions = {
  create: (name: string, limit: string, categoryIds: string[]) => Promise<ActionResult>;
  limit: (id: string, limit: string) => Promise<ActionResult>;
  rename: (id: string, name: string) => Promise<ActionResult>;
  categories: (id: string, categoryIds: string[]) => Promise<ActionResult>;
  close: (id: string) => Promise<ActionResult>;
  reopen: (id: string) => Promise<ActionResult>;
};

function Bar({ card }: { card: BudgetCard }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-900" aria-hidden>
      <div className={`h-full rounded-full ${paceText[card.pace].bar}`} style={{ width: `${Math.min(1, card.ratio) * 100}%` }} />
      {/* Where the period is: spending left of this line is on pace. */}
      {card.elapsed > 0 && card.elapsed < 1 ? (
        <div className="absolute top-0 h-full w-0.5 bg-neutral-100" style={{ left: `${card.elapsed * 100}%` }} />
      ) : null}
    </div>
  );
}

/**
 * Categories grouped the way Wallet groups them. A group's box selects all of
 * its categories at once, which is how most budgets are actually drawn; the
 * categories inside are there for the budget that needs to be narrower.
 * Nothing selected means every category — Wallet's own convention.
 */
function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: BudgetView["categories"];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const groups = [...new Set(categories.map((c) => c.group))];
  const selected = new Set(value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>Categorías {value.length === 0 ? "· ninguna marcada = todas" : `· ${value.length}`}</span>
      <div className="grid max-h-72 gap-1 overflow-y-auto rounded border border-neutral-900 p-2 sm:grid-cols-2">
        {groups.map((group) => {
          const ids = categories.filter((c) => c.group === group).map((c) => c.id);
          const count = ids.filter((id) => selected.has(id)).length;
          return (
            <details key={group} className="rounded px-1 py-0.5" open={count > 0 && count < ids.length}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={count === ids.length}
                  ref={(el) => {
                    if (el) el.indeterminate = count > 0 && count < ids.length;
                  }}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...new Set([...value, ...ids])] : value.filter((id) => !ids.includes(id)))
                  }
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Todo ${group}`}
                />
                <span>{group}</span>
                <span className="font-mono text-[10px] text-neutral-500">
                  {count}/{ids.length}
                </span>
              </summary>
              <ul className="mt-1 flex flex-col gap-0.5 pl-6">
                {categories
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((id) => id !== c.id))}
                        />
                        {c.name}
                      </label>
                    </li>
                  ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The month's budget: Wallet's own budgets, edited here and saved there.
 *
 * Wallet computes what was spent; the panel adds the pace — each bar marks how
 * far into the period it is, and says what the period closes at if spending
 * keeps its rate. That is the warning that still arrives in time.
 */
export default function BudgetModule({ view, actions }: { view: BudgetView; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState<{ name: string; limit: string; categoryIds: string[] } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [recategorising, setRecategorising] = useState<{ id: string; categoryIds: string[] } | null>(null);

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

  const totalLimit = view.cards.filter((c) => c.currencyCode === "COP").reduce((n, c) => n + c.limit, 0);
  const totalSpent = view.cards.filter((c) => c.currencyCode === "COP").reduce((n, c) => n + c.spent, 0);
  const renewalsCop = view.renewals.reduce((n, r) => n + (r.cop ?? 0), 0);
  const stale = view.syncDays === null || view.syncDays > 3;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Presupuesto</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Tus presupuestos de Wallet en {monthName(view.month)}. Lo que cambies aquí —límite, nombre, categorías— se guarda
            en Wallet. El panel añade el ritmo: avisa cuando, al paso que llevas, el mes cerraría por encima.
          </p>
        </div>
        <button
          type="button"
          className={`${small} border-neutral-700 text-neutral-200`}
          onClick={() => setCreating({ name: "", limit: "", categoryIds: [] })}
        >
          <BsPlus className="h-4 w-4" aria-hidden />
          Nuevo presupuesto
        </button>
      </header>

      {view.source === "mirror" ? (
        <p className="rounded border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-300" role="status">
          Wallet no respondió ({view.error}). Se muestran los presupuestos de la última sincronización, con el gasto calculado
          aquí: puede faltar lo que anotaste después. Editar necesita a Wallet.
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          Gasto y límites leídos de Wallet ahora mismo.
          {view.unbudgeted.length > 0 && stale
            ? ` «Sin presupuesto» sale de los movimientos sincronizados ${view.lastSync ? sinceLabel(new Date(view.lastSync)) : "nunca"}.`
            : ""}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen del mes">
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
          <span className={labelClass}>Gastado en presupuestos</span>
          <span className="font-mono text-xl tabular-nums text-neutral-100">{cop(totalSpent)}</span>
          <span className="text-[11px] text-neutral-500">de {cop(totalLimit)} sumando los límites</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
          <span className={labelClass}>Renovaciones que faltan</span>
          <span className="font-mono text-xl tabular-nums text-neutral-100">{cop(renewalsCop)}</span>
          <span className="text-[11px] text-neutral-500">
            {view.renewals.length === 0 ? "ninguna este mes" : `${view.renewals.length} este mes`}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
          <span className={labelClass}>Si compraras lo que quieres</span>
          <span className="font-mono text-xl tabular-nums text-neutral-100">{cop(view.wishlist)}</span>
          <span className="text-[11px] text-neutral-500">juegos, libros y cursos en «lo quiero»</span>
        </div>
      </section>

      {creating ? (
        <form
          className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => actions.create(creating.name, creating.limit, creating.categoryIds), () => setCreating(null));
          }}
        >
          <h2 className="text-sm font-semibold">Nuevo presupuesto mensual en Wallet</h2>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className={labelClass}>Nombre</span>
              <input
                className={field}
                value={creating.name}
                maxLength={80}
                placeholder="Comer fuera"
                onChange={(e) => setCreating({ ...creating, name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Límite al mes (COP)</span>
              <input
                className={`${field} w-40`}
                inputMode="decimal"
                value={creating.limit}
                placeholder="400.000"
                onChange={(e) => setCreating({ ...creating, limit: e.target.value })}
              />
            </label>
          </div>
          <CategoryPicker
            categories={view.categories}
            value={creating.categoryIds}
            onChange={(categoryIds) => setCreating({ ...creating, categoryIds })}
          />
          <div className="flex gap-2">
            <button type="submit" className={`${small} border-neutral-600 text-neutral-100`} disabled={pending}>
              {pending ? "Creando…" : "Crear en Wallet"}
            </button>
            <button type="button" className={small} onClick={() => setCreating(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="presupuestos">
        <h2 id="presupuestos" className="text-sm font-semibold">
          Presupuestos abiertos
        </h2>
        {view.cards.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-800 px-6 py-10 text-center text-sm text-neutral-500">
            No hay presupuestos abiertos en Wallet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {view.cards.map((card) => {
              const pace = paceText[card.pace];
              return (
                <li key={card.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {renaming?.id === card.id ? (
                        <form
                          className="flex gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(() => actions.rename(card.id, renaming.name), () => setRenaming(null));
                          }}
                        >
                          <input
                            autoFocus
                            className={`${field} w-56`}
                            value={renaming.name}
                            maxLength={80}
                            aria-label="Nombre del presupuesto"
                            onChange={(e) => setRenaming({ id: card.id, name: e.target.value })}
                            onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                          />
                          <button type="submit" className={small} disabled={pending}>
                            Guardar
                          </button>
                        </form>
                      ) : (
                        <span className="truncate text-sm text-neutral-100">{card.name}</span>
                      )}
                      <span className="truncate text-[11px] text-neutral-500" title={card.categories.join(", ")}>
                        {typeLabel[card.type] ?? card.type} ·{" "}
                        {card.categories.length > 3
                          ? `${card.categories.slice(0, 3).join(", ")} y ${card.categories.length - 3} más`
                          : card.categories.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-end gap-2">
                      {card.currencyCode === "COP" ? (
                        <QuickField
                          key={`limit:${card.limit}`}
                          label="Límite desde este mes"
                          value={String(card.limit)}
                          width="w-28"
                          onSave={async (raw) => {
                            const outcome = await actions.limit(card.id, raw);
                            if (outcome.ok) router.refresh();
                            setResult(outcome);
                            return outcome;
                          }}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
                        aria-label={`Renombrar ${card.name}`}
                        onClick={() => setRenaming({ id: card.id, name: card.name })}
                      >
                        <BsPencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
                        aria-label={`Cambiar las categorías de ${card.name}`}
                        onClick={() => setRecategorising({ id: card.id, categoryIds: card.categoryIds })}
                      >
                        <BsTags className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-neutral-500 transition-colors hover:text-amber-400"
                        aria-label={`Cerrar ${card.name}`}
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`¿Cerrar «${card.name}» en Wallet? Se queda con su historial y se puede reabrir desde aquí.`)) {
                            run(() => actions.close(card.id));
                          }
                        }}
                      >
                        <BsArchive className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <Bar card={card} />
                  <p className="flex flex-wrap justify-between gap-x-3 text-xs">
                    <span className="tabular-nums text-neutral-300">
                      {cop(card.spent)} de {cop(card.limit)} · {Math.round(card.ratio * 100)} %
                    </span>
                    <span className={pace.tone}>
                      {pace.word}
                      {card.pace === "over" ? `: cerraría en ${cop(card.projected)}` : ""}
                      {card.pace === "exceeded" ? ` por ${cop(card.spent - card.limit)}` : ""}
                      {card.pace === "ok" && card.limit > card.spent ? ` · quedan ${cop(card.limit - card.spent)}` : ""}
                    </span>
                  </p>
                  {recategorising?.id === card.id ? (
                    <div className="flex flex-col gap-2 rounded border border-neutral-800 p-3">
                      <CategoryPicker
                        categories={view.categories}
                        value={recategorising.categoryIds}
                        onChange={(categoryIds) => setRecategorising({ id: card.id, categoryIds })}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={small}
                          disabled={pending}
                          onClick={() => run(() => actions.categories(card.id, recategorising.categoryIds), () => setRecategorising(null))}
                        >
                          Guardar en Wallet
                        </button>
                        <button type="button" className={small} onClick={() => setRecategorising(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-neutral-500">
          La línea blanca de cada barra es el día del mes: lo que queda a su izquierda va al ritmo. El ritmo solo avisa desde el
          día 5. Cambiar un límite vale desde este mes: Wallet deja los meses pasados como estaban.
        </p>
      </section>

      {view.unbudgeted.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="sin-presupuesto">
          <h2 id="sin-presupuesto" className="text-sm font-semibold">
            Gasto sin presupuesto este mes
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
                    onClick={() =>
                      setCreating({
                        name: g.group,
                        limit: "",
                        categoryIds: view.categories.filter((c) => c.group === g.group).map((c) => c.id),
                      })
                    }
                  >
                    Crear presupuesto
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.closed.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="cerrados">
          <h2 id="cerrados" className="text-sm font-semibold">
            Cerrados
          </h2>
          <ul className="flex flex-wrap gap-2">
            {view.closed.map((b) => (
              <li key={b.id}>
                <button type="button" className={small} disabled={pending} onClick={() => run(() => actions.reopen(b.id))}>
                  Reabrir «{b.name}»
                </button>
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
                <Link href="/suscripciones" className="text-neutral-300 hover:underline">
                  {r.name} <span className="text-[11px] text-neutral-500">· {formatPartialDate(r.on)}</span>
                </Link>
                <span className="font-mono text-xs tabular-nums text-neutral-400">
                  {r.cop !== null ? cop(r.cop) : `${r.price} ${r.currency}`}
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
