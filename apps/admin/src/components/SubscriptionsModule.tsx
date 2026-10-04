"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BsBoxArrowUpRight,
  BsCheck2,
  BsChevronLeft,
  BsChevronRight,
  BsPencil,
  BsPlus,
  BsTrash,
} from "react-icons/bs";
import type { Currency, SubscriptionStatus } from "@nassican/db";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import { formatPartialDate } from "@/lib/draft-fields";
import { fold } from "@/lib/list-filters";
import {
  currencies,
  cycleLabel,
  cycleShort,
  cycles,
  emptySubscription,
  expectedPeriods,
  monthlyCost,
  renewalState,
  statuses,
  subscriptionProblems,
  type SubscriptionDraft,
} from "@/lib/subscription-draft";
import type { PaymentRow, SubscriptionRow, SubscriptionsSummary } from "@/lib/subscriptions";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import type { ActionResult } from "@/app/(panel)/suscripciones/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const button =
  "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function money(amount: number, currency: Currency): string {
  return amount.toLocaleString("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  });
}

/** «$ 45.900 + US$ 20» — several currencies side by side, never summed blind. */
function perCurrency(values: Partial<Record<Currency, number>>): string {
  const parts = currencies
    .filter((c) => (values[c] ?? 0) > 0)
    .map((c) => money(values[c]!, c));
  return parts.length > 0 ? parts.join(" + ") : "—";
}

type Actions = {
  save: (draft: SubscriptionDraft) => Promise<ActionResult>;
  remove: (id: string, name: string) => Promise<ActionResult>;
  setStatus: (id: string, status: SubscriptionStatus) => Promise<ActionResult>;
  pay: (id: string) => Promise<ActionResult>;
  toggleMonth: (id: string, period: string) => Promise<ActionResult>;
  savePayment: (
    paymentId: string,
    fields: { amount: string; paidAt: string; note: string },
  ) => Promise<ActionResult>;
};

/**
 * Subscriptions, typed in by hand, and which months were paid.
 *
 * The list is ordered by what needs doing: active plans by how soon they
 * renew, then the paused, then the cancelled — kept, because what you used to
 * pay for is half of deciding the next thing.
 */
export default function SubscriptionsModule({
  summary,
  actions,
}: {
  summary: SubscriptionsSummary;
  actions: Actions;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SubscriptionDraft | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyStatus, setOnlyStatus] = useState<SubscriptionStatus | "">("");
  const [open, setOpen] = useState<string | null>(null);
  const [year, setYear] = useState(() => Number(summary.today.slice(0, 4)));

  const dirty = draft !== null && isDirty(baselineFor(draft, summary), draft);
  useUnsavedChanges(dirty);
  const problems = draft ? subscriptionProblems(draft) : [];

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

  const shown = useMemo(() => {
    const needle = fold(query);
    const rank: Record<SubscriptionStatus, number> = { active: 0, paused: 1, cancelled: 2 };
    return summary.subscriptions
      .filter((s) => {
        if (onlyStatus && s.status !== onlyStatus) return false;
        if (!needle) return true;
        return [s.name, s.category, s.paymentMethod, s.note].some((v) => fold(v ?? "").includes(needle));
      })
      .sort((a, b) => {
        if (a.status !== b.status) return rank[a.status] - rank[b.status];
        // Unknown renewals last: nothing to act on, nothing to sort by.
        const ra = a.nextRenewal ?? "9999";
        const rb = b.nextRenewal ?? "9999";
        return ra === rb ? a.name.localeCompare(b.name, "es") : ra < rb ? -1 : 1;
      });
  }, [summary.subscriptions, query, onlyStatus]);

  const hasUsd = (summary.monthly.USD ?? 0) > 0;
  const yearly = Object.fromEntries(
    Object.entries(summary.monthly).map(([c, v]) => [c, (v ?? 0) * 12]),
  ) as Partial<Record<Currency, number>>;
  const thisYear = summary.today.slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Suscripciones</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Lo que se paga una y otra vez, escrito a mano. Marca los meses
            pagados y el panel avisa antes de cada renovación.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(emptySubscription())}
          className={`${button} border-neutral-700 text-neutral-200 hover:border-neutral-500`}
        >
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Al mes"
          value={summary.monthlyCop !== null ? money(summary.monthlyCop, "COP") : perCurrency(summary.monthly)}
          note={
            hasUsd && summary.trm
              ? `${perCurrency(summary.monthly)} · TRM ${summary.trm.value.toLocaleString("es-CO")}`
              : hasUsd
                ? "Sin TRM: cada moneda por separado"
                : "Solo las activas"
          }
        />
        <Stat
          label="Al año"
          value={summary.monthlyCop !== null ? money(summary.monthlyCop * 12, "COP") : perCurrency(yearly)}
          note="Si todo sigue igual doce meses"
        />
        <Stat
          label="Activas"
          value={String(summary.counts.active)}
          note={`${summary.counts.paused} en pausa · ${summary.counts.cancelled} canceladas`}
        />
        <Stat label={`Pagado en ${thisYear}`} value={perCurrency(summary.paidThisYear)} note="Lo marcado como pagado" />
      </section>

      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {draft.id ? `Editar «${draft.name || "sin nombre"}»` : "Añadir una suscripción"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? <Unsaved /> : null}
              <button
                type="button"
                disabled={pending || problems.length > 0}
                title={problems.join(" ") || undefined}
                onClick={() => run(() => actions.save(draft), () => setDraft(null))}
                className={`${button} border-green-800 bg-green-950/60 text-green-300 hover:border-green-600`}
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDraft(null)}
                className={`${button} border-neutral-800 text-neutral-400 hover:border-neutral-600`}
              >
                Cancelar
              </button>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Labelled label="Nombre">
              <input
                className={field}
                value={draft.name}
                autoFocus
                placeholder="Netflix"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Labelled>
            <Labelled label="Categoría">
              <input
                className={field}
                value={draft.category}
                list="subscription-categories"
                placeholder="Streaming, Infraestructura…"
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </Labelled>
            <Labelled label="Estado">
              <select
                className={field}
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as SubscriptionStatus })}
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Precio">
              <div className="flex gap-1.5">
                <input
                  className={`${field} min-w-0 flex-1`}
                  value={draft.price}
                  inputMode="decimal"
                  placeholder="18.900"
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
                <select
                  className={field}
                  value={draft.currency}
                  aria-label="Moneda"
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value as Currency })}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </Labelled>
            <Labelled label="Ciclo">
              <select
                className={field}
                value={draft.intervalMonths}
                onChange={(e) => setDraft({ ...draft, intervalMonths: e.target.value })}
              >
                {cycles.map((c) => (
                  <option key={c.months} value={String(c.months)}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Medio de pago">
              <input
                className={field}
                value={draft.paymentMethod}
                list="subscription-methods"
                placeholder="RappiCard, Nequi…"
                onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
              />
            </Labelled>
            <Labelled label="Próxima renovación">
              <DateField
                label="de renovación"
                allowTime
                value={draft.nextRenewal}
                onChange={(v) => setDraft({ ...draft, nextRenewal: v })}
              />
            </Labelled>
            <Labelled label="Desde">
              <DateField
                label="de inicio"
                value={draft.startedAt}
                onChange={(v) => setDraft({ ...draft, startedAt: v })}
              />
            </Labelled>
            <Labelled label="Enlace para gestionarla">
              <input
                className={field}
                value={draft.url}
                placeholder="https://…"
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </Labelled>
            <Labelled label="Nota" className="sm:col-span-2 lg:col-span-3">
              <input
                className={field}
                value={draft.note}
                placeholder="Plan familiar, se puede cancelar desde la app…"
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Labelled>
          </div>

          {problems.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {problems.map((p) => (
                <li key={p} className="text-xs text-amber-500">
                  {p}
                </li>
              ))}
            </ul>
          ) : null}

          <datalist id="subscription-categories">
            {summary.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <datalist id="subscription-methods">
            {summary.paymentMethods.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${field} w-64`}
          value={query}
          placeholder="Buscar por nombre, categoría o tarjeta"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOnlyStatus("");
            }
          }}
        />
        <select
          className={field}
          value={onlyStatus}
          onChange={(e) => setOnlyStatus(e.target.value as SubscriptionStatus | "")}
        >
          <option value="">Todas</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} ({summary.counts[s.value]})
            </option>
          ))}
        </select>
        {shown.length !== summary.subscriptions.length ? (
          <span className="text-xs text-neutral-500">
            {shown.length} de {summary.subscriptions.length}
          </span>
        ) : null}
      </div>

      {summary.subscriptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
          Todavía no hay ninguna. «Añadir» para la primera.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
          {shown.map((sub) => (
            <li key={sub.id} className="flex flex-col gap-3 px-4 py-3">
              <Row
                sub={sub}
                summary={summary}
                pending={pending}
                expanded={open === sub.id}
                onToggle={() => setOpen(open === sub.id ? null : sub.id)}
                onEdit={() => setDraft(toDraft(sub))}
                onPay={() => run(() => actions.pay(sub.id))}
                onStatus={(status) => run(() => actions.setStatus(sub.id, status))}
                onRemove={() => {
                  if (!confirm(`¿Mover «${sub.name}» a la papelera? Se puede restaurar durante 30 días, con sus pagos.`)) return;
                  run(() => actions.remove(sub.id, sub.name));
                }}
              />
              {open === sub.id ? (
                <Months
                  sub={sub}
                  year={year}
                  today={summary.today}
                  pending={pending}
                  onYear={setYear}
                  onToggle={(period) => run(() => actions.toggleMonth(sub.id, period))}
                  onSavePayment={(id, fields, done) => run(() => actions.savePayment(id, fields), done)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function RenewalBadge({ sub, today }: { sub: SubscriptionRow; today: string }) {
  if (sub.status !== "active") {
    return <span className="text-xs text-neutral-600">{sub.status === "paused" ? "En pausa" : "Cancelada"}</span>;
  }
  const state = renewalState(sub.nextRenewal, today);
  const when = formatPartialDate(sub.nextRenewal);

  if (state.kind === "unknown") return <span className="text-xs text-neutral-600">Sin fecha de renovación</span>;
  if (state.kind === "overdue") {
    return (
      <span className="text-xs text-red-400" title="La fecha pasó y no se marcó como pagada">
        Vencida · {when}
      </span>
    );
  }
  if (state.kind === "soon") {
    const label =
      state.days === null ? "Este mes" : state.days === 0 ? "Hoy" : state.days === 1 ? "Mañana" : `En ${state.days} días`;
    return (
      <span className="text-xs text-amber-500">
        {label} · {when}
      </span>
    );
  }
  return <span className="text-xs text-neutral-400">{when}</span>;
}

function Row({
  sub,
  summary,
  pending,
  expanded,
  onToggle,
  onEdit,
  onPay,
  onStatus,
  onRemove,
}: {
  sub: SubscriptionRow;
  summary: SubscriptionsSummary;
  pending: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPay: () => void;
  onStatus: (status: SubscriptionStatus) => void;
  onRemove: () => void;
}) {
  const perMonth = monthlyCost(sub.price, sub.intervalMonths);
  const cop = sub.currency === "USD" && summary.trm ? perMonth * summary.trm.value : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm text-neutral-100">
          <span className={sub.status === "cancelled" ? "text-neutral-500 line-through" : ""}>{sub.name}</span>
          {sub.url ? (
            <a
              href={sub.url}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-600 hover:text-neutral-300"
              aria-label={`Gestionar ${sub.name}`}
              title="Gestionar o cancelar"
            >
              <BsBoxArrowUpRight className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </p>
        <p className="text-[11px] text-neutral-600">
          {[sub.category, cycleLabel(sub.intervalMonths), sub.paymentMethod, sub.note].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="text-right">
        <p className="font-mono text-sm text-neutral-200">
          {money(sub.price, sub.currency)} <span className="text-[11px] text-neutral-500">{cycleShort(sub.intervalMonths)}</span>
        </p>
        {sub.intervalMonths !== 1 || cop !== null ? (
          <p className="text-[11px] text-neutral-600">
            {cop !== null ? `≈ ${money(cop, "COP")} al mes` : `${money(perMonth, sub.currency)} al mes`}
          </p>
        ) : null}
      </div>

      <div className="w-40 text-right">
        <RenewalBadge sub={sub} today={summary.today} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {sub.status === "active" ? (
          <button
            type="button"
            className={small}
            disabled={pending}
            onClick={onPay}
            title="Marca pagado el mes de la renovación y la mueve un ciclo"
          >
            <BsCheck2 className="h-3.5 w-3.5" aria-hidden />
            Pagado
          </button>
        ) : null}
        <button type="button" className={small} aria-expanded={expanded} onClick={onToggle}>
          Meses
        </button>
        <select
          className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-300"
          value={sub.status}
          aria-label={`Estado de ${sub.name}`}
          disabled={pending}
          onChange={(e) => onStatus(e.target.value as SubscriptionStatus)}
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Editar ${sub.name}`}
          onClick={onEdit}
          className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
        >
          <BsPencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Mover ${sub.name} a la papelera`}
          onClick={onRemove}
          className="rounded p-1.5 text-neutral-500 transition-colors hover:text-red-400"
        >
          <BsTrash className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * The year as twelve months: paid, owed, coming, or nothing expected.
 *
 * «Owed» is a hint and not an accusation — the ticks are what you marked, and a
 * month you paid but never ticked looks the same as one you did not pay. The
 * colour asks the question; it does not answer it.
 */
function Months({
  sub,
  year,
  today,
  pending,
  onYear,
  onToggle,
  onSavePayment,
}: {
  sub: SubscriptionRow;
  year: number;
  today: string;
  pending: boolean;
  onYear: (year: number) => void;
  onToggle: (period: string) => void;
  onSavePayment: (id: string, fields: { amount: string; paidAt: string; note: string }, done: () => void) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; amount: string; paidAt: string; note: string } | null>(null);
  const paid = new Map(sub.payments.map((p) => [p.period, p]));
  const expected = expectedPeriods(year, sub.intervalMonths, sub.nextRenewal, sub.startedAt);
  const current = today.slice(0, 7);
  const ofYear = sub.payments.filter((p) => p.period.startsWith(String(year)));

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-900 bg-neutral-950/60 p-3">
      <div className="flex items-center justify-between">
        <span className={labelClass}>Meses pagados</span>
        <div className="flex items-center gap-1">
          <button type="button" className={small} aria-label="Año anterior" onClick={() => onYear(year - 1)}>
            <BsChevronLeft className="h-3 w-3" aria-hidden />
          </button>
          <span className="w-12 text-center font-mono text-xs text-neutral-300">{year}</span>
          <button type="button" className={small} aria-label="Año siguiente" onClick={() => onYear(year + 1)}>
            <BsChevronRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
        {MONTHS.map((name, i) => {
          const period = `${year}-${String(i + 1).padStart(2, "0")}`;
          const payment = paid.get(period);
          const due = expected.has(period);
          const past = period <= current;

          const tone = payment
            ? "border-green-800 bg-green-950/50 text-green-300"
            : due && past
              ? "border-amber-900 text-amber-400"
              : due
                ? "border-dashed border-neutral-700 text-neutral-400"
                : "border-neutral-900 text-neutral-600";

          const title = payment
            ? [
                "Pagado",
                payment.amount !== null ? money(payment.amount, payment.currency ?? sub.currency) : null,
                payment.paidAt ? formatPartialDate(payment.paidAt) : null,
                "— clic para desmarcar",
              ]
                .filter(Boolean)
                .join(" · ")
            : due && past
              ? "Tocaba pagar y no está marcado — clic para marcarlo"
              : due
                ? "Próximo cobro — clic para marcarlo"
                : "Clic para marcarlo como pagado";

          return (
            <button
              key={period}
              type="button"
              disabled={pending}
              title={title}
              aria-pressed={!!payment}
              aria-label={`${name} ${year}: ${title}`}
              onClick={() => {
                if (payment && (payment.paidAt || payment.note)) {
                  if (!confirm(`¿Desmarcar ${name} ${year}? Se pierde la fecha y la nota de ese pago.`)) return;
                }
                onToggle(period);
              }}
              className={`flex flex-col items-center rounded border px-1 py-1.5 text-xs transition-colors hover:border-neutral-500 ${tone}`}
            >
              <span>{name}</span>
              <span className="text-[10px]">{payment ? "✓" : due && past ? "?" : " "}</span>
            </button>
          );
        })}
      </div>

      {ofYear.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-900">
          {ofYear.map((payment) => (
            <PaymentLine
              key={payment.id}
              payment={payment}
              currency={payment.currency ?? sub.currency}
              editing={editing?.id === payment.id ? editing : null}
              pending={pending}
              onEdit={() =>
                setEditing({
                  id: payment.id,
                  amount: payment.amount === null ? "" : String(payment.amount),
                  paidAt: payment.paidAt ?? "",
                  note: payment.note ?? "",
                })
              }
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSave={(fields) => onSavePayment(payment.id, fields, () => setEditing(null))}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-neutral-600">Ningún mes marcado en {year}.</p>
      )}
    </div>
  );
}

function PaymentLine({
  payment,
  currency,
  editing,
  pending,
  onEdit,
  onChange,
  onCancel,
  onSave,
}: {
  payment: PaymentRow;
  currency: Currency;
  editing: { id: string; amount: string; paidAt: string; note: string } | null;
  pending: boolean;
  onEdit: () => void;
  onChange: (value: { id: string; amount: string; paidAt: string; note: string }) => void;
  onCancel: () => void;
  onSave: (fields: { amount: string; paidAt: string; note: string }) => void;
}) {
  const label = formatPartialDate(payment.period);

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-2">
        <span className="text-xs text-neutral-300">{label}</span>
        <div className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
          <input
            className={field}
            value={editing.amount}
            inputMode="decimal"
            placeholder="Monto"
            aria-label={`Monto de ${label}`}
            onChange={(e) => onChange({ ...editing, amount: e.target.value })}
          />
          <DateField
            label="de pago"
            allowTime
            value={editing.paidAt}
            onChange={(v) => onChange({ ...editing, paidAt: v })}
          />
          <input
            className={field}
            value={editing.note}
            placeholder="Nota"
            aria-label={`Nota de ${label}`}
            onChange={(e) => onChange({ ...editing, note: e.target.value })}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              className={`${small} border-green-800 text-green-300`}
              onClick={() => onSave({ amount: editing.amount, paidAt: editing.paidAt, note: editing.note })}
            >
              Guardar
            </button>
            <button type="button" className={small} onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
      <span className="text-neutral-300">{label}</span>
      <span className="flex-1 text-neutral-500">
        {[
          payment.amount !== null ? money(payment.amount, currency) : null,
          payment.paidAt ? `pagado ${formatPartialDate(payment.paidAt)}` : "sin fecha",
          payment.note,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <button type="button" className={small} onClick={onEdit}>
        Editar
      </button>
    </li>
  );
}

function toDraft(row: SubscriptionRow): SubscriptionDraft {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "",
    price: String(row.price),
    currency: row.currency,
    intervalMonths: String(row.intervalMonths),
    status: row.status,
    nextRenewal: row.nextRenewal ?? "",
    startedAt: row.startedAt ?? "",
    paymentMethod: row.paymentMethod ?? "",
    url: row.url ?? "",
    note: row.note ?? "",
  };
}

function baselineFor(draft: SubscriptionDraft, summary: SubscriptionsSummary): SubscriptionDraft {
  if (!draft.id) return emptySubscription();
  const row = summary.subscriptions.find((s) => s.id === draft.id);
  return row ? toDraft(row) : draft;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
      <span className={labelClass}>{label}</span>
      <span className="text-xl font-semibold tracking-tight text-neutral-100">{value}</span>
      {note ? <span className="text-[11px] text-neutral-600">{note}</span> : null}
    </div>
  );
}

function Labelled({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
