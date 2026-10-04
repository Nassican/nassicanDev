"use client";

import { useRef, useState } from "react";
import { BsCalendar3, BsClock, BsX } from "react-icons/bs";
import {
  PARTIAL_DATE_HINT,
  isFullDay,
  joinDateTime,
  splitDateTime,
} from "@/lib/draft-fields";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";

const icon =
  "inline-flex shrink-0 items-center justify-center rounded border border-neutral-800 px-2 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-30";

/**
 * A date you can type *or* pick from a calendar, and a time when it matters.
 *
 * **Typing stays**, because these dates are partial on purpose — «2022» is a
 * real answer to «¿cuándo lo compraste?», and a calendar can only say a whole
 * day. So the text keeps the value and the calendar is a way of writing it: the
 * browser's own picker, no library, opened from the button.
 *
 * The time is the same idea one step further: hidden until asked for, only
 * offered next to a full day, and dropped by `joinDateTime` the moment the date
 * stops being one. Stored as "2024-08-13T21:30".
 */
export default function DateField({
  value,
  onChange,
  allowTime = false,
  placeholder = PARTIAL_DATE_HINT,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  allowTime?: boolean;
  placeholder?: string;
  /** Names the field for the buttons, which have no visible text. */
  label?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [timeAsked, setTimeAsked] = useState(false);

  const { date, time } = splitDateTime(value);
  const fullDay = isFullDay(date);
  const showTime = allowTime && fullDay && (time !== "" || timeAsked);

  // Where the calendar opens: on the day, or on the month or year already typed,
  // so picking from «2024-08» starts in August 2024 and not today.
  const seed = fullDay
    ? date
    : /^\d{4}-\d{2}$/.test(date)
      ? `${date}-01`
      : /^\d{4}$/.test(date)
        ? `${date}-01-01`
        : "";

  function openCalendar() {
    const input = picker.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Older browsers without showPicker: focusing still opens it in most.
      input.focus();
      input.click();
    }
  }

  const what = label ? ` ${label}` : "";

  return (
    <div className="relative flex min-w-0 gap-1.5">
      <input
        className={`${field} min-w-0 flex-1 font-mono`}
        value={date}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(joinDateTime(e.target.value, time))}
      />

      <button
        type="button"
        className={icon}
        title={`Elegir${what} en el calendario`}
        aria-label={`Elegir${what} en el calendario`}
        onClick={openCalendar}
      >
        <BsCalendar3 className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/*
        Rendered, not `display: none`: a picker has to be on the page to open,
        and this one sits under the button so the calendar appears next to it.
      */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0"
        value={seed}
        onChange={(e) => {
          if (e.target.value) onChange(joinDateTime(e.target.value, time));
        }}
      />

      {allowTime ? (
        showTime ? (
          <div className="flex shrink-0 gap-1">
            <input
              type="time"
              className={`${field} w-28 font-mono`}
              value={time}
              aria-label={`Hora${what}`}
              onChange={(e) => onChange(joinDateTime(date, e.target.value))}
            />
            <button
              type="button"
              className={icon}
              title="Quitar la hora"
              aria-label={`Quitar la hora${what}`}
              onClick={() => {
                setTimeAsked(false);
                onChange(date);
              }}
            >
              <BsX className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={icon}
            disabled={!fullDay}
            title={fullDay ? "Añadir la hora" : "La hora necesita un día completo"}
            aria-label={`Añadir la hora${what}`}
            onClick={() => setTimeAsked(true)}
          >
            <BsClock className="h-3.5 w-3.5" aria-hidden />
          </button>
        )
      ) : null}
    </div>
  );
}
