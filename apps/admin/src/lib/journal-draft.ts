/**
 * The weekly log's arithmetic and its reading of the audit trail.
 *
 * Pure, so the two things that are easy to get subtly wrong are pinned by
 * tests: which instants a local week covers, and how an audit row becomes a
 * sentence a person would write about their own week.
 */

const DAY = 86_400_000;

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return format(Date.UTC(y, m - 1, d) + days * DAY);
}

/** The Monday of the week a day falls in. Weeks start on Monday here, as they do in Colombia. */
export function mondayOf(date: string): string {
  const [y, m, d] = parts(date);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sunday … 6 Saturday
  return addDays(date, -((weekday + 6) % 7));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * The instant local midnight of `date` happens in `timezone`.
 *
 * The audit log stores instants and the week is a local idea: an edit made at
 * nine on Sunday night in Bogotá is two in the morning on Monday in UTC, and
 * bucketing by UTC filed it under the wrong week — the same mistake the daily
 * snapshot made once. Worked out from the zone's own offset at that moment, so
 * it holds for zones with daylight saving too.
 */
export function zonedMidnight(date: string, timezone: string): Date {
  const [y, m, d] = parts(date);
  const guess = Date.UTC(y, m - 1, d);
  const offset = (at: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(at))
        .map((x) => [x.type, x.value]),
    );
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    return local - at;
  };
  // Two passes: the offset at the guess, then at the corrected instant, which
  // differ only when a transition falls between them.
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «29 sept – 5 oct 2026», naming the month once when the week stays inside one. */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const [y1, m1, d1] = parts(monday);
  const [y2, m2, d2] = parts(sunday);
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
}

/** «lun 29 sept». */
export function dayLabel(date: string): string {
  const [y, m, d] = parts(date);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}


const LONG_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const LONG_WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** «Lunes 29 de septiembre», for a day's own heading. */
export function longDayLabel(date: string): string {
  const [y, m, d] = parts(date);
  return `${LONG_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${LONG_MONTHS[m - 1]}`;
}

// ---------------------------------------------------------------------------
// Reading the audit trail
// ---------------------------------------------------------------------------

export type AuditFact = {
  action: string;
  entityType: string;
  diff: Record<string, unknown> | null;
  /** The entity's current name, for rows whose diff did not record one. */
  name?: string | null;
  /** The local day the row was written, "2026-10-04". */
  on?: string;
  /** For games and books: the finish date as it stands now, if any. */
  finishedAt?: string | null;
};

/**
 * Whether a finish date says the thing was finished around `on`.
 *
 * Marking a game finished is two different acts that write the same audit row:
 * finishing it, and bringing an old library up to date. The first week of the
 * log counted «25 juegos terminados» from an afternoon of the second — 24 with
 * no end date and one from 2025. So the claim needs evidence: a full day within
 * a week of the mark, or the same month when only the month is known.
 */
function finishedAround(finishedAt: string | null | undefined, on: string | undefined): boolean {
  if (!finishedAt || !on) return false;
  const date = finishedAt.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const days = (Date.parse(on) - Date.parse(date)) / 86_400_000;
    return days >= -1 && days <= 7;
  }
  return /^\d{4}-\d{2}$/.test(date) && date === on.slice(0, 7);
}

/** What a line is about, for its icon and for grouping a week's highlights. */
export type LineKind = "content" | "games" | "books" | "subscriptions" | "tasks" | "goals" | "data" | "note";

/**
 * Highlights worth counting across a week. A line carries one when it is the
 * kind of thing you would mention if asked how the week went.
 */
export type Tally =
  | "game-finished"
  | "game-started"
  | "book-finished"
  | "book-started"
  | "payment"
  | "published"
  | "added"
  | "task-done"
  | "goal-achieved"
  | "habit-done";

export type AuditLine = {
  text: string;
  kind: LineKind;
  /**
   * True for what changed something — finished, published, paid, added — and
   * false for routine edits. A week has a hundred of the second and a handful
   * of the first, and showing them at the same weight buried the handful.
   */
  highlight: boolean;
  tally?: Tally;
};

const nouns: Record<string, string> = {
  post: "el artículo",
  project: "el proyecto",
  page: "la página",
  media: "una imagen",
  game: "el juego",
  book: "el libro",
  subscription: "la suscripción",
  task: "el pendiente",
  goal: "la meta",
  habit: "el hábito",
  technology: "la tecnología",
  "game-store": "la tienda",
  navigation: "el menú",
  settings: "la configuración",
  seo: "el SEO",
  profile: "el perfil",
  redirect: "una redirección",
  user: "un usuario",
};

const kinds: Record<string, LineKind> = {
  game: "games",
  "game-store": "games",
  book: "books",
  subscription: "subscriptions",
  task: "tasks",
  goal: "goals",
  habit: "goals",
  backup: "data",
  wallet: "data",
  trash: "data",
  user: "data",
};

const verbs: Record<string, string> = {
  create: "Añadiste",
  update: "Editaste",
  publish: "Publicaste",
  unpublish: "Retiraste del sitio",
  delete: "Borraste",
  restore: "Restauraste",
};

/** What belongs to the operator's week and not to the machinery. */
const SKIPPED = new Set(["session", "journal"]);

/** Adding one of these is a decision about your life, not a maintenance edit. */
const PERSONAL = new Set(["game", "book", "subscription"]);

const quoted = (name: string | null) => (name ? ` «${name}»` : "");

/**
 * One audit row as a sentence, or null when it is not something anyone would
 * write down about their week — a session closed, a note in this same log.
 *
 * Status changes are the interesting rows: «Editaste el juego» says nothing,
 * «Terminaste Geometry Dash» is the whole point of keeping the library.
 */
export function describeAudit(fact: AuditFact): AuditLine | null {
  const { action, entityType } = fact;
  if (SKIPPED.has(entityType)) return null;

  const diff = fact.diff ?? {};
  const pick = (key: string) => (typeof diff[key] === "string" ? (diff[key] as string) : null);
  const name = pick("label") ?? pick("title") ?? pick("name") ?? fact.name ?? null;
  const status = pick("status");
  const kind: LineKind = kinds[entityType] ?? "content";
  const line = (text: string, highlight: boolean, tally?: Tally): AuditLine => ({ text, kind, highlight, tally });

  if (entityType === "game" && action === "update" && status) {
    if (status === "finished") {
      return finishedAround(fact.finishedAt, fact.on)
        ? line(`Terminaste${quoted(name)}`, true, "game-finished")
        : line(`Marcaste como terminado${quoted(name)}${when(fact.finishedAt)}`, false);
    }
    if (status === "playing") return line(`Empezaste a jugar${quoted(name)}`, true, "game-started");
    if (status === "dropped") return line(`Abandonaste${quoted(name)}`, true);
    if (status === "backlog") return line(`Dejaste pendiente${quoted(name)}`, false);
    if (status === "wishlist") return line(`Apuntaste en «lo quiero»${quoted(name)}`, false);
  }

  if (entityType === "book" && action === "update" && status) {
    if (status === "finished") {
      return finishedAround(fact.finishedAt, fact.on)
        ? line(`Terminaste de leer${quoted(name)}`, true, "book-finished")
        : line(`Marcaste como leído${quoted(name)}${when(fact.finishedAt)}`, false);
    }
    if (status === "reading") return line(`Empezaste a leer${quoted(name)}`, true, "book-started");
    if (status === "dropped") return line(`Dejaste${quoted(name)}`, true);
    if (status === "backlog") return line(`Dejaste pendiente${quoted(name)}`, false);
    if (status === "wishlist") return line(`Apuntaste en «lo quiero»${quoted(name)}`, false);
  }

  if (entityType === "subscription") {
    const paid = pick("paid");
    if (paid) {
      // A payment made now, from «Pagado» or for this month on — or the record of
      // an old one, ticked in the grid. Six months ticked in one sitting are not
      // six payments this week.
      const current = diff.now === true || (fact.on !== undefined && paid >= fact.on.slice(0, 7));
      return current
        ? line(`Pagaste${quoted(name)} (${formatPeriod(paid)})`, true, "payment")
        : line(`Registraste el pago de${quoted(name)} (${formatPeriod(paid)})`, false);
    }
    if (pick("unpaid")) return null;
    if (status === "cancelled") return line(`Cancelaste${quoted(name)}`, true);
    if (status === "paused") return line(`Pausaste${quoted(name)}`, true);
  }

  /*
   * Tasks: only finishing one is a highlight. Capturing and planning are how the
   * list is kept, and a week of them at full weight would bury the few things
   * actually done — the same reason routine edits are folded.
   */
  if (entityType === "task") {
    if (action === "create") return line(`Apuntaste${quoted(name)}`, false);
    if (status === "done") return line(`Completaste${quoted(name)}`, true, "task-done");
    if (status === "dropped") return line(`Descartaste${quoted(name)}`, false);
    if (status === "reopened") return line(`Reabriste${quoted(name)}`, false);
    if ("plannedFor" in diff) {
      const day = pick("plannedFor");
      return day
        ? line(`Planificaste${quoted(name)} para el ${dayLabel(day.slice(0, 10))}`, false)
        : line(`Devolviste a la bandeja${quoted(name)}`, false);
    }
  }

  /*
   * Goals and habits. Achieving a goal is the highlight of a week; setting one
   * is a decision worth seeing too. A habit tick is routine on its own — it
   * happens daily — but it is counted, so the week says «12 hábitos cumplidos».
   */
  if (entityType === "goal") {
    if (action === "create") return line(`Te propusiste${quoted(name)}`, true);
    if (status === "achieved") return line(`Lograste${quoted(name)}`, true, "goal-achieved");
    if (status === "dropped") return line(`Soltaste la meta${quoted(name)}`, false);
    if (status === "active") return line(`Retomaste la meta${quoted(name)}`, false);
  }

  if (entityType === "habit") {
    if (action === "create") return line(`Empezaste el hábito${quoted(name)}`, true);
    if (pick("checked")) return line(`Cumpliste${quoted(name)}`, false, "habit-done");
  }

  /*
   * The editorial pipeline. Noting an idea is routine; turning one into a draft
   * is the moment an article starts to exist, and the week should show it.
   */
  if (entityType === "idea" && action === "create") return line(`Apuntaste la idea${quoted(name)}`, false);
  if (entityType === "post" && action === "create" && diff.fromIdea === true) {
    return line(`Empezaste a escribir${quoted(name)}`, true);
  }

  if (entityType === "backup") {
    if (action === "export") return line("Descargaste una copia de seguridad", true);
    if (action === "restore") return line("Restauraste una copia de seguridad", true);
  }

  if (entityType === "wallet" && action === "sync") return line("Sincronizaste Wallet", false);
  if (entityType === "trash") return line(`Vaciaste de la papelera${quoted(name)}`, false);

  if (action === "delete" && diff.trash === true) {
    return line(`Moviste a la papelera ${nouns[entityType] ?? entityType}${quoted(name)}`, false);
  }

  const verb = verbs[action];
  if (!verb) return null;
  const text = `${verb} ${nouns[entityType] ?? entityType}${quoted(name)}`;

  if (action === "publish") return line(text, true, "published");
  if (action === "unpublish" || action === "restore") return line(text, true);
  if (action === "create" && PERSONAL.has(entityType)) return line(text, true, "added");
  return line(text, false);
}

/** « (2025)» — when an old finish is recorded, the year it happened. */
function when(finishedAt: string | null | undefined): string {
  return finishedAt ? ` (${finishedAt.slice(0, 4)})` : "";
}

function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : period;
}

export type DayItem = {
  /** "21:30", or null for a note without an hour. */
  time: string | null;
  text: string;
  kind: LineKind;
  highlight: boolean;
  tally?: Tally;
  /** How many times the same sentence happened that day. */
  count: number;
  /** Set for the operator's own notes, which can be edited. */
  noteId?: string;
  at?: string;
};

/**
 * Folds repeats: thirty icon tweaks to one technology are one line, «×30».
 * The first time it happened is kept, so the day still reads in order.
 */
export function collapse(items: DayItem[]): DayItem[] {
  const out: DayItem[] = [];
  const seen = new Map<string, DayItem>();
  for (const item of items) {
    if (item.noteId) {
      out.push(item);
      continue;
    }
    const prior = seen.get(item.text);
    if (prior) {
      prior.count += 1;
    } else {
      const copy = { ...item };
      seen.set(item.text, copy);
      out.push(copy);
    }
  }
  return out;
}

const tallyWords: Record<Tally, [string, string]> = {
  "game-finished": ["juego terminado", "juegos terminados"],
  "game-started": ["juego empezado", "juegos empezados"],
  "book-finished": ["libro terminado", "libros terminados"],
  "book-started": ["libro empezado", "libros empezados"],
  payment: ["pago", "pagos"],
  published: ["publicación", "publicaciones"],
  added: ["cosa nueva en Personal", "cosas nuevas en Personal"],
  "task-done": ["pendiente completado", "pendientes completados"],
  "goal-achieved": ["meta lograda", "metas logradas"],
  "habit-done": ["hábito cumplido", "hábitos cumplidos"],
};

const tallyKinds: Record<Tally, LineKind> = {
  "game-finished": "games",
  "game-started": "games",
  "book-finished": "books",
  "book-started": "books",
  payment: "subscriptions",
  published: "content",
  added: "data",
  "task-done": "tasks",
  "goal-achieved": "goals",
  "habit-done": "goals",
};

/**
 * The week in a sentence of counts — «2 juegos terminados · 3 pagos» — in a
 * fixed order, so two weeks side by side read the same way. A tally that did
 * not happen is left out rather than shown as zero.
 */
export function weekHighlights(items: DayItem[]): { kind: LineKind; label: string; count: number }[] {
  const counts = new Map<Tally, number>();
  for (const item of items) {
    if (item.tally) counts.set(item.tally, (counts.get(item.tally) ?? 0) + item.count);
  }
  return (Object.keys(tallyWords) as Tally[])
    .filter((t) => counts.has(t))
    .map((t) => {
      const count = counts.get(t)!;
      const [one, many] = tallyWords[t];
      return { kind: tallyKinds[t], label: count === 1 ? one : many, count };
    });
}
