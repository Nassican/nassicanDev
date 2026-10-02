import "server-only";

/**
 * The only door to BudgetBakers Wallet, and it opens one way.
 *
 * Read-only **by construction**, not by convention. Three things make a write
 * impossible rather than merely discouraged:
 *
 *  1. `read()` has no `method` parameter. `"GET"` is written into the call, so
 *     there is no argument a caller could pass to change it.
 *  2. Nothing generic is exported. The module's surface is four typed readers;
 *     a caller cannot reach the fetch at all, so it cannot reach another verb.
 *  3. `import "server-only"` means a client component that imports this fails
 *     the build by name - which is also what keeps the token out of the browser
 *     bundle, by construction rather than by remembering.
 *
 * Adding a write would mean editing this file, and the comment above is the
 * argument against doing it.
 */

const BASE = "https://rest.budgetbakers.com/wallet/v1/api";

/** 300 per hour, per the published limit and confirmed in the headers. */
export type RateLimit = { limit: number | null; remaining: number | null };

export type ReadResult<T> =
  | { ok: true; items: T[]; nextOffset: number | null; rate: RateLimit }
  | { ok: false; reason: string; retryAfter?: number };

function token(): string | null {
  return process.env.WALLET_API_TOKEN?.trim() || null;
}

export function hasWalletToken(): boolean {
  return token() !== null;
}

/**
 * One page, by GET, with the envelope unwrapped.
 *
 * Each endpoint wraps its rows under its own key (`records`, `accounts`, …)
 * alongside `limit`, `offset` and `nextOffset`, so the key is a parameter
 * rather than something guessed from the path.
 */
async function read<T>(
  path: string,
  key: string,
  params: Record<string, string | number | undefined>,
): Promise<ReadResult<T>> {
  const apiToken = token();
  if (!apiToken) return { ok: false, reason: "falta WALLET_API_TOKEN" };

  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      // Hard-coded, and there is no parameter that could change it.
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "fallo de red",
    };
  }

  const rate: RateLimit = {
    limit: Number(response.headers.get("x-ratelimit-limit")) || null,
    remaining: Number(response.headers.get("x-ratelimit-remaining")) || null,
  };

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after")) || 60;
    return {
      ok: false,
      reason: `Wallet pidió esperar ${retryAfter} s: se agotó el presupuesto de 300 peticiones por hora`,
      retryAfter,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      reason:
        "Wallet rechazó el token. Compruébalo en los ajustes de la app web; la API necesita plan Premium.",
    };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      reason: `Wallet respondió ${response.status}: ${body.slice(0, 160) || "sin cuerpo"}`,
    };
  }

  const body = (await response.json()) as Record<string, unknown>;
  const items = Array.isArray(body[key]) ? (body[key] as T[]) : [];
  const next = body.nextOffset;

  return {
    ok: true,
    items,
    nextOffset: typeof next === "number" ? next : null,
    rate,
  };
}

// --------------------------------------------------------------- the shapes

/** `{ value, currencyCode }`, with `value` negative for an expense. */
export type WalletMoney = { value: number; currencyCode: string };

export type ApiAccount = {
  id: string;
  name: string;
  accountType: string;
  currencyCode: string;
  color?: string | null;
  archived?: boolean;
  excludeFromStats?: boolean;
  isBankSync?: boolean;
  createdAt: string;
  updatedAt: string;
  balance?: { initial?: number; currentBalance?: number };
  recordStats?: { recordCount?: number };
};

export type ApiCategory = {
  id: string;
  name: string;
  group?: { id?: string; name?: string } | null;
  color?: string | null;
  systemId?: string | null;
  cardinality?: string | null;
  customCategory?: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiRecord = {
  id: string;
  accountId: string;
  accountName?: string;
  category?: { id?: string; name?: string; group?: { name?: string } } | null;
  amount: WalletMoney;
  recordDate: string;
  recordType: string;
  recordState: string;
  note?: string | null;
  counterParty?: string | null;
  labels?: string[] | null;
  transfer?: { id?: string } | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiBudget = {
  id: string;
  name: string;
  limit: number;
  currencyCode: string;
  type: string;
  closed?: boolean;
  accountIds?: string[];
  categoryIds?: string[];
  createdAt: string;
  updatedAt: string;
};

// ------------------------------------------------------------- the four doors

/**
 * Page sizes, measured rather than read.
 *
 * The reference says "limit (default: 30, max: 200)" for listings. That is not
 * true of every endpoint: `/budgets` answers `400 limit must be at most 20`,
 * while accounts, categories, labels and records all accept 200. Found by
 * asking each one, after a sync died on the documented number.
 *
 * Bigger pages mean fewer requests, and requests are the scarce thing here.
 */
export const PAGE_SIZE = 200;
export const BUDGETS_PAGE_SIZE = 20;

export const readAccounts = (offset = 0) =>
  read<ApiAccount>("/accounts", "accounts", { limit: PAGE_SIZE, offset });

export const readCategories = (offset = 0) =>
  read<ApiCategory>("/categories", "categories", { limit: PAGE_SIZE, offset });

export const readBudgets = (offset = 0) =>
  read<ApiBudget>("/budgets", "budgets", { limit: BUDGETS_PAGE_SIZE, offset });

/**
 * Records, with the date range always stated.
 *
 * **Never call this without `since`.** Asked for nothing, the API quietly
 * applies a three-month window of its own - it reports it back in
 * `appliedRecordDateFilters`, which is the only reason that is discoverable at
 * all - and a sync that trusted the default would mirror one quarter and call
 * it the whole history. The parameter is required so the omission cannot happen.
 */
export const readRecords = (since: string, offset = 0) =>
  read<ApiRecord>("/records", "records", {
    limit: PAGE_SIZE,
    offset,
    recordDate: `gte.${since}`,
  });
