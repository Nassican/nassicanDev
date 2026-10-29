/** A download must not mutate the saved quote; restricted to disposable local fixtures. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55432");
  assert.equal(target.username, "pricing_qa");
  const directory = join(tmpdir(), "nassican-pricing-qa");
  const fixture = JSON.parse(await readFile(join(directory, "fixtures.json"), "utf8"));
  const { db } = await import("@nassican/db");
  try {
    const quote = await db.pricingQuote.findUniqueOrThrow({
      where: { id: fixture.quoteId },
      select: {
        id: true,
        status: true,
        final: true,
        suggested: true,
        snapshot: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
        sentAt: true,
      },
    });
    const digest = createHash("sha256").update(JSON.stringify(quote)).digest("hex");
    const file = join(directory, "pdf-saved-quote-state.json");
    if (process.argv.includes("--record"))
      await writeFile(file, JSON.stringify({ id: quote.id, digest }));
    else {
      const before = JSON.parse(await readFile(file, "utf8"));
      assert.equal(before.id, quote.id);
      assert.equal(before.digest, digest);
    }
    console.log(
      process.argv.includes("--record")
        ? "Saved synthetic quote state recorded before PDF downloads."
        : "PDF downloads left snapshot, final amount, status, project and timestamps unchanged.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
