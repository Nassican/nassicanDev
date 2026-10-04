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

// ---------------------------------------------------------------------------
// Reading the audit trail
// ---------------------------------------------------------------------------

export type AuditFact = {
  action: string;
  entityType: string;
  diff: Record<string, unknown> | null;
  /** The entity's current name, for rows whose diff did not record one. */
  name?: string | null;
};

const nouns: Record<string, string> = {
  post: "el artículo",
  project: "el proyecto",
  page: "la página",
  media: "una imagen",
  game: "el juego",
  book: "el libro",
  subscription: "la suscripción",
  technology: "la tecnología",
  "game-store": "la tienda",
  navigation: "el menú",
  settings: "la configuración",
  seo: "el SEO",
  profile: "el perfil",
  redirect: "una redirección",
  user: "un usuario",
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

const quoted = (name: string | null) => (name ? ` «${name}»` : "");

/**
 * One audit row as a sentence, or null when it is not something anyone would
 * write down about their week — a session closed, a note in this same log.
 *
 * Status changes are the interesting rows: «Editaste el juego» says nothing,
 * «Terminaste Geometry Dash» is the whole point of keeping the library.
 */
export function describeAudit(fact: AuditFact): string | null {
  const { action, entityType } = fact;
  if (SKIPPED.has(entityType)) return null;

  const diff = fact.diff ?? {};
  const pick = (key: string) => (typeof diff[key] === "string" ? (diff[key] as string) : null);
  const name = pick("label") ?? pick("title") ?? pick("name") ?? fact.name ?? null;
  const status = pick("status");

  if (entityType === "game" && action === "update" && status) {
    const said: Record<string, string> = {
      finished: "Terminaste",
      playing: "Empezaste a jugar",
      dropped: "Abandonaste",
      backlog: "Dejaste pendiente",
      wishlist: "Apuntaste en «lo quiero»",
    };
    if (said[status]) return `${said[status]}${quoted(name)}`;
  }

  if (entityType === "book" && action === "update" && status) {
    const said: Record<string, string> = {
      finished: "Terminaste de leer",
      reading: "Empezaste a leer",
      dropped: "Dejaste",
      backlog: "Dejaste pendiente",
      wishlist: "Apuntaste en «lo quiero»",
    };
    if (said[status]) return `${said[status]}${quoted(name)}`;
  }

  if (entityType === "subscription") {
    const paid = pick("paid");
    if (paid) return `Pagaste${quoted(name)} (${formatPeriod(paid)})`;
    if (pick("unpaid")) return null;
    if (status === "cancelled") return `Cancelaste${quoted(name)}`;
    if (status === "paused") return `Pausaste${quoted(name)}`;
  }

  if (entityType === "backup") {
    if (action === "export") return "Descargaste una copia de seguridad";
    if (action === "restore") return "Restauraste una copia de seguridad";
  }

  if (entityType === "wallet" && action === "sync") return "Sincronizaste Wallet";
  if (entityType === "trash") return `Vaciaste de la papelera${quoted(name)}`;

  if (action === "delete" && diff.trash === true) {
    return `Moviste a la papelera ${nouns[entityType] ?? entityType}${quoted(name)}`;
  }

  const verb = verbs[action];
  if (!verb) return null;
  return `${verb} ${nouns[entityType] ?? entityType}${quoted(name)}`;
}

function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : period;
}

export type DayItem = {
  /** "21:30", or null for a note without an hour. */
  time: string | null;
  text: string;
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
