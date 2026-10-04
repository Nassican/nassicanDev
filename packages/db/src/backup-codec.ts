/**
 * Rows to JSON and back, for the backup file and the trash.
 *
 * Pure on purpose — no client, no `server-only` — so the parts that decide
 * whether a restore puts back exactly what was taken can be tested without a
 * database. `backup.ts` feeds it the field types from Prisma's own model.
 *
 * JSON alone cannot carry what Postgres stores here: a date becomes a string, a
 * `numeric` becomes a lossy float, a `bigint` does not serialise at all, and an
 * image's bytes need an encoding. Each gets a fixed, reversible form.
 */

export type FieldKind = "DateTime" | "Decimal" | "BigInt" | "Bytes" | "Json" | "plain";

export function encodeValue(kind: FieldKind, value: unknown): unknown {
  if (value === null || value === undefined) return null;

  switch (kind) {
    case "DateTime":
      return value instanceof Date ? value.toISOString() : value;
    case "Decimal":
      // `toFixed()` and not `toString()`: Decimal switches to exponent notation
      // at small magnitudes, and «1e-7» is a value a reader has to decode twice.
      return typeof value === "object" && "toFixed" in value
        ? (value as { toFixed(): string }).toFixed()
        : String(value);
    case "BigInt":
      return String(value);
    case "Bytes":
      return Buffer.from(value as Uint8Array).toString("base64");
    default:
      return value;
  }
}

export function decodeValue(kind: FieldKind, value: unknown): unknown {
  if (value === null || value === undefined) return null;

  switch (kind) {
    case "DateTime":
      return new Date(value as string);
    case "Decimal":
      // Prisma takes a string for `numeric` and keeps every digit. A number
      // would round-trip through a float, which is how money gains a cent.
      return String(value);
    case "BigInt":
      return BigInt(value as string);
    case "Bytes":
      return new Uint8Array(Buffer.from(value as string, "base64"));
    default:
      return value;
  }
}

/**
 * Tables ordered so that every one comes after the tables it points at.
 *
 * Input order is kept wherever the dependencies allow, so the output is stable
 * and a diff between two runs means something. A table pointing at itself is
 * not a dependency between tables — `parentsFirst` deals with those rows.
 */
export function insertionOrder<T extends string>(
  nodes: { name: T; dependsOn: readonly T[] }[],
): T[] {
  const names = new Set(nodes.map((n) => n.name));
  const pending = new Map(
    nodes.map((n) => [
      n.name,
      new Set(n.dependsOn.filter((d) => d !== n.name && names.has(d))),
    ]),
  );
  const order: T[] = [];

  while (pending.size > 0) {
    const ready = [...pending].find(([, deps]) => deps.size === 0)?.[0];

    if (ready === undefined) {
      throw new Error(
        `Dependencias circulares entre tablas: ${[...pending.keys()].join(", ")}.`,
      );
    }

    order.push(ready);
    pending.delete(ready);
    for (const deps of pending.values()) deps.delete(ready);
  }

  return order;
}

/**
 * Rows of a self-referencing table, parents before their children.
 *
 * A page whose parent is another page, a folder inside a folder. A reference to
 * a row that is not in the set is not waited for: either it already exists in
 * the database or the restore reports it, and neither is this function's call.
 */
export function parentsFirst<R extends Record<string, unknown>>(
  rows: R[],
  idField: string,
  parentFields: readonly string[],
): R[] {
  if (parentFields.length === 0) return rows;

  const present = new Set(rows.map((r) => r[idField]));
  const placed = new Set<unknown>();
  const order: R[] = [];
  let remaining = rows;

  while (remaining.length > 0) {
    const next: R[] = [];

    for (const row of remaining) {
      const waiting = parentFields.some((field) => {
        const parent = row[field];
        return parent != null && parent !== row[idField] && present.has(parent) && !placed.has(parent);
      });

      if (waiting) {
        next.push(row);
      } else {
        order.push(row);
        placed.add(row[idField]);
      }
    }

    if (next.length === remaining.length) {
      throw new Error(`Referencias circulares entre ${next.length} filas de la misma tabla.`);
    }
    remaining = next;
  }

  return order;
}
