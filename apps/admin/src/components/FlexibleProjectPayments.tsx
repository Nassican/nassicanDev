"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type {
  BillingSource,
  BillingView,
  FlexibleReceiptDraft,
  ExpectedPaymentDraft,
} from "@/lib/billing";
import { billingMinor, billingMoney } from "@/lib/billing-values";
import { formatPartialDate } from "@/lib/draft-fields";
import { grouped } from "@/lib/pricing-draft";
import { useUnsavedChanges } from "@/lib/use-unsaved";
import {
  recordFlexibleReceiptAction,
  saveExpectedPaymentAction,
  removeExpectedPaymentAction,
  type BillingActionResult,
} from "@/app/(panel)/precios/cobros/actions";
import DateField from "./DateField";
import PricingNumberInput from "./PricingNumberInput";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

type Props = {
  plan: NonNullable<BillingView["plan"]>;
  source: BillingSource;
  today: string;
  ready: boolean;
  dirty: boolean;
  pending: boolean;
  run: (action: () => Promise<BillingActionResult>) => void;
};

export default function FlexibleProjectPayments({
  plan,
  source,
  today,
  ready,
  dirty,
  pending,
  run,
}: Props) {
  const ledger = plan.details.flexiblePayments ?? { receipts: [], expected: [] };
  const receivedById = new Map(ledger.receipts.map((payment) => [payment.id, payment]));
  const [receipt, setReceipt] = useState<FlexibleReceiptDraft>({
    planId: plan.id,
    id: "",
    amount: "",
    paidAt: today,
    concept: "",
    reference: "",
    expectedId: "",
  });
  const [expected, setExpected] = useState<ExpectedPaymentDraft>({
    planId: plan.id,
    id: "",
    amount: "",
    expectedAt: "",
    concept: "",
  });
  const receiptForm = useRef<HTMLFieldSetElement>(null);
  useUnsavedChanges(
    Boolean(
      receipt.amount ||
      receipt.concept ||
      receipt.reference ||
      expected.amount ||
      expected.expectedAt ||
      expected.concept,
    ),
  );
  const received = ledger.receipts.reduce(
    (sum, payment) => sum + billingMinor(payment.amount),
    BigInt(0),
  );
  const balance = billingMinor(plan.amount) - received;
  const money = (value: number) => billingMoney(value, source.currency);
  const disabled = pending || !ready || dirty || !source.canIssue;
  const nextMonth = (() => {
    const [year, month] = today.split("-").map(Number);
    return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  })();
  function receivedValue(key: keyof FlexibleReceiptDraft, value: string) {
    setReceipt((current) => ({ ...current, id: "", [key]: value }));
  }
  function expectedValue(key: keyof ExpectedPaymentDraft, value: string) {
    setExpected((current) => ({ ...current, id: "", [key]: value }));
  }
  return (
    <Section title="Pagos por avances">
      <dl className="grid gap-4 text-sm sm:grid-cols-3" aria-label="Saldo del proyecto">
        <div>
          <dt className="text-neutral-500">Valor acordado</dt>
          <dd className="mt-1 font-semibold">
            {money(plan.amount)} {source.currency}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Recibido</dt>
          <dd className="mt-1 font-semibold" data-flexible-received>
            {money(Number(received) / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Saldo pendiente</dt>
          <dd className="mt-1 font-semibold" data-flexible-balance>
            {money(Number(balance) / 100)}
          </dd>
        </div>
      </dl>
      <p className="max-w-prose text-sm text-neutral-500">
        Registra cada pago con su importe real. Los pagos previstos son recordatorios y no se
        descuentan del saldo hasta que confirmes que recibiste el dinero.
      </p>
      {!source.canIssue ? (
        <p className="text-sm">
          Primero{" "}
          <Link className="underline" href="/precios/cotizaciones">
            acepta la cotización
          </Link>{" "}
          para conectar los pagos con el proyecto.
        </p>
      ) : null}
      {dirty ? (
        <p className="text-sm text-neutral-500">
          Guarda los cambios del acuerdo antes de registrar pagos.
        </p>
      ) : null}
      {balance > BigInt(0) ? (
        <fieldset
          ref={receiptForm}
          disabled={disabled}
          className="grid min-w-0 gap-4 border-t border-neutral-800 pt-4 sm:grid-cols-2"
        >
          <legend className="mb-3 text-sm font-medium">Registrar dinero recibido</legend>
          <Label
            label="Importe recibido"
            help="El valor que realmente te pagaron. Puede ser diferente en cada avance; no debe superar el saldo del proyecto."
          >
            <PricingNumberInput
              className={field}
              value={receipt.amount}
              onChange={(event) => receivedValue("amount", event.target.value)}
            />
          </Label>
          <Label
            label="Fecha del pago recibido"
            help="Fecha completa en la que recibiste el dinero. Para un pago futuro usa la sección de previstos."
          >
            <DateField
              value={receipt.paidAt}
              label="Pago recibido"
              onChange={(value) => receivedValue("paidAt", value)}
            />
          </Label>
          <Label
            label="Proyecto o avance pagado"
            help="Por ejemplo: Anticipo del proyecto, Avance del catálogo o Entrega de la primera pantalla."
          >
            <input
              className={field}
              value={receipt.concept}
              maxLength={500}
              onChange={(event) => receivedValue("concept", event.target.value)}
            />
          </Label>
          <Label
            label="Referencia del pago (opcional)"
            help="Número de transferencia, efectivo o una nota que te ayude a identificar el pago."
          >
            <input
              className={field}
              value={receipt.reference}
              maxLength={500}
              onChange={(event) => receivedValue("reference", event.target.value)}
            />
          </Label>
          {receipt.expectedId ? (
            <p className="text-xs text-neutral-500 sm:col-span-2">
              Estás confirmando un pago previsto. Puedes cambiar el importe por el que recibiste
              realmente.{" "}
              <button
                className="underline"
                type="button"
                onClick={() => receivedValue("expectedId", "")}
              >
                Registrar como otro pago
              </button>
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="button"
              className={primary}
              disabled={disabled || !receipt.amount || !receipt.concept.trim()}
              onClick={() => {
                const value = { ...receipt, id: receipt.id || crypto.randomUUID() };
                setReceipt(value);
                run(async () => {
                  const result = await recordFlexibleReceiptAction(value);
                  if (result.ok)
                    setReceipt({
                      planId: plan.id,
                      id: "",
                      amount: "",
                      paidAt: today,
                      concept: "",
                      reference: "",
                      expectedId: "",
                    });
                  return result;
                });
              }}
            >
              Guardar pago recibido
            </button>
          </div>
        </fieldset>
      ) : (
        <p role="status" className="text-sm font-medium">
          El valor del acuerdo está pagado.
        </p>
      )}
      <div className="border-t border-neutral-800 pt-4">
        <h3 className="text-sm font-medium">Historial de pagos recibidos</h3>
        {ledger.receipts.length ? (
          <ul className="mt-3 divide-y divide-neutral-800 text-sm">
            {[...ledger.receipts]
              .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
              .map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap justify-between gap-2 py-3"
                  data-flexible-receipt={payment.id}
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{payment.concept}</p>
                    <p className="mt-1 break-words text-xs text-neutral-500">
                      {formatPartialDate(payment.paidAt)}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </p>
                  </div>
                  <p>{money(Number(payment.amount))}</p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Todavía no has registrado pagos recibidos.
          </p>
        )}
      </div>
      {balance > BigInt(0) ? (
        <fieldset
          disabled={disabled}
          className="grid min-w-0 gap-4 border-t border-neutral-800 pt-4 sm:grid-cols-2"
        >
          <legend className="mb-3 text-sm font-medium">Anotar un próximo pago</legend>
          <Label
            label="Concepto del próximo pago"
            help="Qué avance o parte del proyecto te pagarán después. No necesitas definir los demás pagos."
          >
            <input
              className={field}
              maxLength={500}
              value={expected.concept}
              onChange={(event) => expectedValue("concept", event.target.value)}
            />
          </Label>
          <Label
            label="Importe previsto (opcional)"
            help="Déjalo vacío si todavía no sabes cuánto te darán. Es una estimación, no dinero recibido."
          >
            <PricingNumberInput
              className={field}
              value={expected.amount}
              onChange={(event) => expectedValue("amount", event.target.value)}
            />
          </Label>
          <Label
            label="Fecha o mes previsto (opcional)"
            help="Puedes escribir solo el mes, como 2026-11, una fecha completa o dejarlo por acordar."
          >
            <DateField
              value={expected.expectedAt}
              label="Próximo pago"
              onChange={(value) => expectedValue("expectedAt", value)}
            />
          </Label>
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              className={button}
              onClick={() => expectedValue("expectedAt", nextMonth)}
            >
              Próximo mes
            </button>
            <button
              type="button"
              className={button}
              disabled={disabled || !expected.concept.trim()}
              onClick={() => {
                const value = { ...expected, id: expected.id || crypto.randomUUID() };
                setExpected(value);
                run(async () => {
                  const result = await saveExpectedPaymentAction(value);
                  if (result.ok)
                    setExpected({
                      planId: plan.id,
                      id: "",
                      amount: "",
                      expectedAt: "",
                      concept: "",
                    });
                  return result;
                });
              }}
            >
              Guardar próximo pago
            </button>
          </div>
        </fieldset>
      ) : null}
      {ledger.expected.length ? (
        <div className="border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-medium">Pagos previstos</h3>
          <ul className="mt-3 divide-y divide-neutral-800">
            {ledger.expected.map((payment) => {
              const actual = payment.receiptId ? receivedById.get(payment.receiptId) : null;
              const date = actual?.paidAt ?? payment.expectedAt;
              const amount = actual?.amount ?? payment.amount;
              return (
                <li
                  key={payment.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                  data-expected-payment={payment.id}
                >
                  <div className="min-w-0 text-sm">
                    <p className="break-words font-medium">{payment.concept}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {payment.receiptId ? "Recibido" : "Previsto"} ·{" "}
                      {date ? formatPartialDate(date) : "Fecha por acordar"} ·{" "}
                      {amount ? money(Number(amount)) : "Importe por acordar"}
                    </p>
                  </div>
                  {!payment.receiptId ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        className={button}
                        type="button"
                        disabled={disabled || balance === BigInt(0)}
                        onClick={() => {
                          setReceipt({
                            planId: plan.id,
                            id: "",
                            amount: payment.amount ? grouped(Number(payment.amount)) : "",
                            paidAt: today,
                            concept: payment.concept,
                            reference: "",
                            expectedId: payment.id,
                          });
                          receiptForm.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                          receiptForm.current
                            ?.querySelector("input")
                            ?.focus({ preventScroll: true });
                        }}
                      >
                        Ya recibí este pago
                      </button>
                      <button
                        className="text-xs text-neutral-500 underline"
                        type="button"
                        disabled={disabled}
                        onClick={() => run(() => removeExpectedPaymentAction(plan.id, payment.id))}
                      >
                        Retirar previsión
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-neutral-500">
        El registro de pagos no emite una cuenta de cobro ni verifica movimientos bancarios.
      </p>
    </Section>
  );
}
