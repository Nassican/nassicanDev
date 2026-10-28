import type { ReactNode } from "react";

export const pricingFieldBase =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
export const pricingField = `w-full ${pricingFieldBase}`;
export const pricingButton =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-40";
export const pricingPrimary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-40";
export function PricingLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-neutral-500">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PricingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-neutral-800 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
      {children}
    </section>
  );
}
