"use server";

import { listCommands } from "@/lib/commands";
import { requireUser } from "@/lib/session";
import type { Command } from "@/components/CommandPalette";

/**
 * What the palette can jump to, fetched the first time it opens.
 *
 * It used to run in the panel layout, which meant every page in the panel paid
 * for it whether or not anyone pressed ⌘K. Measured from Bogotá it was **217 ms
 * on every single page** — three `findMany` calls, two of them pulling a to-many
 * relation, so five round trips — and that is with six rows of content in the
 * whole database. The cost was never the rows; it was the trips.
 *
 * Now nothing pays until the palette is opened, and then only once per tab.
 *
 * `requireUser()` is not a formality here: a server action is a public endpoint,
 * and this one returns the title of every draft in the panel.
 */
export async function loadCommands(): Promise<Command[]> {
  await requireUser();
  return listCommands();
}
