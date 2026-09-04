/**
 * Compares the schema Better Auth expects against the Prisma models.
 *
 * Better Auth defines its tables in code, so upgrading the library can add a
 * column without anything failing until a user tries to sign in - which is
 * exactly how `account.issuer` was found, from a runtime error in the OAuth
 * callback rather than from a build.
 *
 * Run it after every `better-auth` upgrade:  npm run check:auth
 */
import { getAuthTables } from "better-auth/db";
import { Prisma } from "../../../packages/db/generated/prisma/index.js";

// Only the options that change the schema need to match src/lib/auth.ts.
const tables = getAuthTables({
  emailAndPassword: { enabled: false },
  socialProviders: { google: { clientId: "x", clientSecret: "y" } },
});

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name.toLowerCase(),
    new Set(model.fields.map((field) => field.name)),
  ]),
);

const problems = [];

for (const table of Object.values(tables)) {
  const fields = models.get(table.modelName.toLowerCase());

  if (!fields) {
    problems.push(`falta el modelo "${table.modelName}"`);
    continue;
  }

  for (const [name, field] of Object.entries(table.fields)) {
    const column = field.fieldName ?? name;
    if (!fields.has(column)) {
      problems.push(
        `${table.modelName}.${column} (${field.type}${field.required ? ", requerido" : ""})`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("El esquema de Prisma no cubre lo que Better Auth espera:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nAñádelos a packages/db/prisma/schema.prisma y migra.");
  process.exit(1);
}

console.log(
  `El esquema cubre las ${Object.keys(tables).length} tablas de Better Auth.`,
);
