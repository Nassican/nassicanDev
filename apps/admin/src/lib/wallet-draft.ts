/** Shapes for the Finanzas module, free of database and token imports. */

export type SortColumn = "date" | "amount" | "category" | "account";
export type SortDirection = "asc" | "desc";

export type FinanceFilters = {
  accountId: string | null;
  categoryId: string | null;
  /** `expense` | `income` | `transfer`, or null for all. */
  type: string | null;
  /** `YYYY-MM-DD`, inclusive on both ends. */
  from: string | null;
  to: string | null;
  search: string | null;
  sort: SortColumn;
  direction: SortDirection;
  page: number;
};

export const defaultFilters: FinanceFilters = {
  accountId: null,
  categoryId: null,
  type: null,
  from: null,
  to: null,
  search: null,
  sort: "date",
  direction: "desc",
  page: 1,
};

export type FinanceRecord = {
  id: string;
  accountName: string;
  categoryName: string | null;
  categoryGroup: string | null;
  /** Negative for an expense, as Wallet sends it. */
  amount: number;
  currencyCode: string;
  recordDate: string;
  recordType: string;
  note: string | null;
  counterParty: string | null;
};

export type FinanceAccount = {
  id: string;
  name: string;
  accountType: string;
  currencyCode: string;
  currentBalance: number;
  /** What the account was worth before the first recorded movement. */
  initialBalance: number;
  archived: boolean;
  excludeFromStats: boolean;
  recordCount: number;
};

/** Wallet's own type string for a card. */
export const isCreditCard = (account: FinanceAccount) =>
  account.accountType === "CreditCard";

/**
 * A credit card whose starting balance was never entered.
 *
 * Wallet computes a card in `creditCardManual` mode as the plain sum of its
 * records, so with `initial = 0` the balance is only what has been written down
 * since tracking began. If there was debt before the first record, it is in no
 * part of the calculation - and the figure looks far too small without anything
 * saying why. This is the fingerprint of that, and it is worth naming in the
 * interface rather than leaving someone to notice it against their bank app.
 */
export const understatesDebt = (account: FinanceAccount) =>
  isCreditCard(account) && account.initialBalance === 0 && account.recordCount > 0;

export type FinanceCategory = {
  id: string;
  name: string;
  groupName: string | null;
  color: string | null;
};

export type FinanceBudget = {
  id: string;
  name: string;
  limitAmount: number;
  currencyCode: string;
  type: string;
};

export type FinanceSummary = {
  records: FinanceRecord[];
  total: number;
  page: number;
  perPage: number;
  /** Over the filtered set, not the visible page. */
  totals: { income: number; expense: number; transfer: number };
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  budgets: FinanceBudget[];
  lastSync: { at: string; status: string; rows: number; note: string | null } | null;
  configured: boolean;
};

export const typeLabels: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Traspaso",
};

export const sortLabels: Record<SortColumn, string> = {
  date: "Fecha",
  amount: "Monto",
  category: "Categoría",
  account: "Cuenta",
};

/**
 * Money, in the currency the row carries.
 *
 * Per row rather than once for the module: accounts exist in COP and USD, and a
 * list that printed both with the same symbol would be quietly wrong. Wallet's
 * sign convention is kept - an expense reads negative, because that is what it
 * is.
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown ISO code must not break a listing.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Reads filters off a URL, so a filtered view is a link you can keep. */
export function filtersFromParams(
  params: Record<string, string | string[] | undefined>,
): FinanceFilters {
  const one = (key: string): string | null => {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    return first?.trim() ? first.trim() : null;
  };

  const sort = one("sort");
  const direction = one("dir");
  const page = Number(one("page") ?? "1");

  return {
    accountId: one("account"),
    categoryId: one("category"),
    type: one("type"),
    from: one("from"),
    to: one("to"),
    search: one("q"),
    sort: (["date", "amount", "category", "account"] as const).includes(
      sort as SortColumn,
    )
      ? (sort as SortColumn)
      : "date",
    direction: direction === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/** The query string for a set of filters, omitting everything at its default. */
export function paramsFromFilters(filters: FinanceFilters): string {
  const params = new URLSearchParams();
  if (filters.accountId) params.set("account", filters.accountId);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.search) params.set("q", filters.search);
  if (filters.sort !== "date") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("dir", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
