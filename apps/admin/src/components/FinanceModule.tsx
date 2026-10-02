"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  formatMoney,
  isCreditCard,
  paramsFromFilters,
  sortLabels,
  typeLabels,
  understatesDebt,
  type FinanceFilters,
  type FinanceSummary,
  type SortColumn,
} from "@/lib/wallet-draft";
import type { ActionResult } from "@/app/(panel)/finanzas/actions";

const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 focus:border-neutral-600 focus:outline-none";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

const num = new Intl.NumberFormat("es-CO");
const day = (iso: string) => iso.slice(0, 10);

export default function FinanceModule({
  summary,
  filters,
  sync,
}: {
  summary: FinanceSummary;
  filters: FinanceFilters;
  sync: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.search ?? "");

  const { records, total, page, perPage, totals, accounts, categories, budgets } =
    summary;

  const pages = Math.max(1, Math.ceil(total / perPage));

  /**
   * Filters live in the URL, not in component state. A filtered view is then a
   * link you can bookmark or send, and the back button behaves — which is the
   * difference between a report and a toy.
   */
  const go = (next: Partial<FinanceFilters>) => {
    const merged = { ...filters, ...next };
    // Any change but the page itself returns to the first page: staying on
    // page 7 of a narrower result shows an empty table and looks broken.
    if (next.page === undefined) merged.page = 1;
    router.push(`/finanzas${paramsFromFilters(merged)}`);
  };

  const sortBy = (column: SortColumn) =>
    go({
      sort: column,
      direction:
        filters.sort === column && filters.direction === "desc" ? "asc" : "desc",
    });

  const arrow = (column: SortColumn) =>
    filters.sort === column ? (filters.direction === "desc" ? " ↓" : " ↑") : "";

  const base = accounts[0]?.currencyCode ?? "COP";
  const net = totals.income + totals.expense;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Finanzas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Espejo de solo lectura de Wallet. El panel nunca escribe en Wallet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary.lastSync ? (
            <span className="text-[11px] text-neutral-600">
              {summary.lastSync.at.slice(0, 16).replace("T", " ")}
            </span>
          ) : null}
          <button
            type="button"
            className={primary}
            disabled={pending || !summary.configured}
            onClick={() => {
              setResult(null);
              startTransition(async () => {
                const outcome = await sync();
                setResult(outcome);
                if (outcome.ok) router.refresh();
              });
            }}
          >
            {pending ? "Sincronizando…" : "Sincronizar"}
          </button>
        </div>
      </header>

      {result ? (
        <p
          role="status"
          className={`rounded border px-4 py-3 text-sm ${
            result.ok
              ? "border-green-900/60 bg-green-950/30 text-green-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {!summary.configured ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          Falta <span className="font-mono">WALLET_API_TOKEN</span>. Se genera en
          los ajustes de la app web de Wallet y necesita plan Premium.
        </p>
      ) : null}

      {summary.lastSync?.note ? (
        <p className="rounded border border-neutral-800 bg-neutral-950 px-4 py-2 text-[12px] text-neutral-400">
          {summary.lastSync.note}
        </p>
      ) : null}

      {/* ------------------------------ cuentas ----------------------------- */}
      {accounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className={labelStyle}>Cuentas</h2>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 bg-neutral-950 p-3">
                <button
                  type="button"
                  onClick={() =>
                    go({ accountId: filters.accountId === a.id ? null : a.id })
                  }
                  className={`text-left text-[11px] uppercase tracking-wide transition-colors ${
                    filters.accountId === a.id
                      ? "text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {a.name}
                  {a.archived ? " · archivada" : ""}
                </button>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    isCreditCard(a) && a.currentBalance < 0 ? "text-amber-400" : ""
                  }`}
                >
                  {/* A card's negative balance is a debt, so it says so. A bare
                      minus sign next to a savings balance invites exactly the
                      wrong reading. */}
                  {isCreditCard(a) && a.currentBalance < 0
                    ? `debes ${formatMoney(Math.abs(a.currentBalance), a.currencyCode)}`
                    : formatMoney(a.currentBalance, a.currencyCode)}
                </span>
                <span className="text-[11px] text-neutral-600">
                  {a.accountType} · {num.format(a.recordCount)} mov.
                  {a.excludeFromStats ? " · fuera de estadísticas" : ""}
                </span>
                {understatesDebt(a) ? (
                  <span
                    className="text-[10px] text-amber-400/80"
                    title="Wallet calcula esta tarjeta como la suma de sus movimientos. Con saldo inicial 0, lo que debías antes del primero no está contado."
                  >
                    saldo inicial 0 · puede quedarse corto
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {accounts.some(understatesDebt) ? (
            <p className="text-[11px] text-neutral-600">
              Las tarjetas marcadas tienen saldo inicial 0 en Wallet, así que su
              saldo es solo la suma de los movimientos registrados: lo que
              debías antes del primero no está contado. Se corrige ajustando el
              saldo inicial en Wallet, no aquí — este módulo no escribe.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------ filtros ----------------------------- */}
      <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Desde</span>
            <input
              type="date"
              className={field}
              value={filters.from ?? ""}
              onChange={(e) => go({ from: e.target.value || null })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Hasta</span>
            <input
              type="date"
              className={field}
              value={filters.to ?? ""}
              onChange={(e) => go({ to: e.target.value || null })}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Tipo</span>
            <select
              className={field}
              value={filters.type ?? ""}
              onChange={(e) => go({ type: e.target.value || null })}
            >
              <option value="">Todos</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Categoría</span>
            <select
              className={field}
              value={filters.categoryId ?? ""}
              onChange={(e) => go({ categoryId: e.target.value || null })}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.groupName ? `${c.groupName} · ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <span className={labelStyle}>Buscar</span>
            <input
              className={field}
              value={search}
              placeholder="nota, contraparte, cuenta…"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") go({ search: search.trim() || null });
              }}
              onBlur={() => {
                if ((filters.search ?? "") !== search.trim()) {
                  go({ search: search.trim() || null });
                }
              }}
            />
          </label>

          <Link href="/finanzas" className={ghost}>
            Limpiar
          </Link>
        </div>

        <p className="text-[11px] text-neutral-600">
          Los filtros viven en la dirección, así que una vista filtrada es un
          enlace que puedes guardar. Ordenar y cruzar cuatro filtros a la vez es
          exactamente lo que la API no deja hacer y el espejo sí.
        </p>
      </section>

      {/* ------------------------------ totales ----------------------------- */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
        <div className="flex flex-col gap-1 bg-neutral-950 p-3">
          <dt className={labelStyle}>Ingresos</dt>
          <dd className="text-xl font-semibold tabular-nums text-green-400">
            {formatMoney(totals.income, base)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-neutral-950 p-3">
          <dt className={labelStyle}>Gastos</dt>
          <dd className="text-xl font-semibold tabular-nums text-red-400">
            {formatMoney(totals.expense, base)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-neutral-950 p-3">
          <dt className={labelStyle}>Neto</dt>
          <dd
            className={`text-xl font-semibold tabular-nums ${net >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {formatMoney(net, base)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-neutral-950 p-3">
          <dt className={labelStyle}>Movimientos</dt>
          <dd className="text-xl font-semibold tabular-nums">{num.format(total)}</dd>
          <p className="text-[11px] text-neutral-600">con los filtros puestos</p>
        </div>
      </dl>

      {/* --------------------------- movimientos ---------------------------- */}
      <section className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border border-neutral-900">
          <table className="w-full min-w-[42rem] text-[12px]">
            <thead>
              <tr className="border-b border-neutral-900 text-left text-neutral-500">
                {(["date", "account", "category", "amount"] as SortColumn[]).map(
                  (column) => (
                    <th
                      key={column}
                      className={`px-3 py-2 font-normal ${column === "amount" ? "text-right" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(column)}
                        className="transition-colors hover:text-neutral-200"
                      >
                        {sortLabels[column]}
                        {arrow(column)}
                      </button>
                    </th>
                  ),
                )}
                <th className="px-3 py-2 font-normal">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">
                    {summary.lastSync
                      ? "Ningún movimiento con estos filtros."
                      : "Sin sincronizar todavía. Pulsa «Sincronizar»."}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-900/40">
                    <td className="px-3 py-2 font-mono text-[11px] text-neutral-400">
                      {day(r.recordDate)}
                    </td>
                    <td className="px-3 py-2 text-neutral-300">{r.accountName}</td>
                    <td className="px-3 py-2 text-neutral-400">
                      {r.categoryName ?? "—"}
                      {r.categoryGroup ? (
                        <span className="block text-[10px] text-neutral-600">
                          {r.categoryGroup}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.amount < 0 ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {formatMoney(r.amount, r.currencyCode)}
                    </td>
                    <td className="max-w-[18rem] px-3 py-2 text-neutral-500">
                      <span className="block truncate" title={r.note ?? undefined}>
                        {r.note ?? ""}
                      </span>
                      {r.counterParty ? (
                        <span className="block truncate text-[10px] text-neutral-600">
                          {r.counterParty}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] text-neutral-600">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de{" "}
              {num.format(total)}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={ghost}
                disabled={page <= 1}
                onClick={() => go({ page: page - 1 })}
              >
                ‹
              </button>
              <span className="px-1 font-mono text-[10px] tabular-nums text-neutral-500">
                {page} / {pages}
              </span>
              <button
                type="button"
                className={ghost}
                disabled={page >= pages}
                onClick={() => go({ page: page + 1 })}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* --------------------------- presupuestos --------------------------- */}
      {budgets.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
          <h2 className="text-sm font-semibold">Presupuestos</h2>
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {budgets.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-neutral-300">{b.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                  {b.type.replace("BUDGET_INTERVAL_", "").toLowerCase()}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-400">
                  {formatMoney(b.limitAmount, b.currencyCode)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-neutral-600">
            Solo el límite, que es lo que Wallet expone. Cuánto se ha consumido
            se calcularía cruzando movimientos y categorías, y prefiero no
            inventar una cifra que discrepe de la que ves en Wallet.
          </p>
        </section>
      ) : null}
    </div>
  );
}
