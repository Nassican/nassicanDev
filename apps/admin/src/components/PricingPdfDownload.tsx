"use client";

import { useState } from "react";
import { BsDownload } from "react-icons/bs";
import { pricingButton } from "./PricingFields";

export default function PricingPdfDownload({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="min-w-0">
      <button
        type="button"
        className={`${pricingButton} inline-flex items-center gap-2`}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const response = await fetch(
              `/api/precios/cotizaciones/${encodeURIComponent(id)}/pdf`,
              { cache: "no-store" },
            );
            if (
              response.redirected ||
              !response.headers.get("content-type")?.includes("application/pdf")
            )
              throw new Error(
                response.redirected
                  ? "Inicia sesión de nuevo para descargar el PDF."
                  : "No se pudo generar el PDF. Actualiza la lista e inténtalo de nuevo.",
              );
            if (!response.ok) throw new Error("No se pudo descargar la cotización.");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download =
              response.headers.get("content-disposition")?.match(/filename="([\w.-]+)"/)?.[1] ??
              "cotizacion-nassican.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "No se pudo generar el PDF.");
          } finally {
            setPending(false);
          }
        }}
      >
        <BsDownload aria-hidden />
        {pending ? "Generando PDF…" : "Descargar PDF"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 max-w-sm text-xs text-neutral-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
