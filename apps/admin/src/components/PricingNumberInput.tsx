"use client";

import type { InputHTMLAttributes } from "react";
import { pricingNumberEdit, pricingNumberPaste } from "@/lib/pricing-number";

/** Same controlled-input contract as a native input, with live es-CO grouping. */
export default function PricingNumberInput({
  onChange,
  onPaste,
  onBlur,
  formatted = true,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { formatted?: boolean }) {
  if (!formatted) return <input {...props} onChange={onChange} onPaste={onPaste} onBlur={onBlur} />;
  return (
    <input
      {...props}
      type="text"
      inputMode={props.inputMode ?? "decimal"}
      onChange={(event) => {
        const input = event.currentTarget;
        let raw = input.value;
        const caret = input.selectionStart ?? raw.length;
        // A newly typed dot is a decimal separator. Existing grouping dots are
        // removed and regenerated, including edits in the middle of a number.
        if ((event.nativeEvent as InputEvent).data === ".")
          raw = raw.slice(0, caret - 1) + "," + raw.slice(caret);
        const edit = pricingNumberEdit(raw, caret);
        input.value = edit.value;
        onChange?.(event);
        input.setSelectionRange(edit.caret, edit.caret);
        requestAnimationFrame(() => {
          if (document.activeElement === input && input.value === edit.value)
            input.setSelectionRange(edit.caret, edit.caret);
        });
      }}
      onPaste={(event) => {
        onPaste?.(event);
        if (event.defaultPrevented) return;
        const pasted = pricingNumberPaste(event.clipboardData.getData("text"));
        event.preventDefault();
        if (pasted === null) return;
        const input = event.currentTarget;
        // Use the native input event so React follows its normal change path.
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? input.value.length;
        const raw = input.value.slice(0, start) + pasted + input.value.slice(end);
        setter.call(input, raw);
        input.setSelectionRange(start + pasted.length, start + pasted.length);
        input.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }),
        );
      }}
      onBlur={(event) => {
        onBlur?.(event);
      }}
    />
  );
}
