import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeValue, encodeValue, insertionOrder, parentsFirst } from "./backup-codec";

describe("encodeValue / decodeValue", () => {
  it("una fecha vuelve exacta, al milisegundo", () => {
    const date = new Date("2026-10-04T15:30:12.345Z");
    const back = decodeValue("DateTime", encodeValue("DateTime", date));
    assert.ok(back instanceof Date);
    assert.equal(back.getTime(), date.getTime());
  });

  it("un decimal conserva todos sus dígitos y no usa notación exponencial", () => {
    // Shaped like Prisma's Decimal: what matters is that toFixed is preferred.
    const decimal = { toFixed: () => "0.0000001", toString: () => "1e-7" };
    assert.equal(encodeValue("Decimal", decimal), "0.0000001");
    assert.equal(decodeValue("Decimal", "34225.00"), "34225.00");
  });

  it("un bigint más allá del rango de un float vuelve exacto", () => {
    const big = 2n ** 60n + 1n;
    assert.equal(decodeValue("BigInt", encodeValue("BigInt", big)), big);
  });

  it("los bytes van y vuelven por base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const encoded = encodeValue("Bytes", bytes);
    assert.equal(typeof encoded, "string");
    assert.deepEqual([...(decodeValue("Bytes", encoded) as Uint8Array)], [0, 1, 2, 250, 255]);
  });

  it("JSON y valores simples no se tocan, y null sigue siendo null", () => {
    const body = [{ type: "paragraph", text: "Hola" }];
    assert.equal(encodeValue("Json", body), body);
    assert.equal(encodeValue("plain", "x"), "x");
    assert.equal(encodeValue("DateTime", null), null);
    assert.equal(decodeValue("BigInt", null), null);
  });
});

describe("insertionOrder", () => {
  it("cada tabla va después de las que referencia", () => {
    const order = insertionOrder([
      { name: "PostTag", dependsOn: ["Post", "Tag"] },
      { name: "Post", dependsOn: ["User", "Media"] },
      { name: "Tag", dependsOn: [] },
      { name: "Media", dependsOn: ["User"] },
      { name: "User", dependsOn: [] },
    ]);
    const at = (n: (typeof order)[number]) => order.indexOf(n);
    assert.ok(at("User") < at("Media"));
    assert.ok(at("Media") < at("Post"));
    assert.ok(at("Post") < at("PostTag"));
    assert.ok(at("Tag") < at("PostTag"));
  });

  it("ignora la autorreferencia y las tablas fuera del conjunto", () => {
    assert.deepEqual(
      insertionOrder([{ name: "Page", dependsOn: ["Page", "Elsewhere"] }]),
      ["Page"],
    );
  });

  it("nombra las tablas de un ciclo en vez de colgarse", () => {
    assert.throws(
      () =>
        insertionOrder([
          { name: "A", dependsOn: ["B"] },
          { name: "B", dependsOn: ["A"] },
        ]),
      /A, B/,
    );
  });
});

describe("parentsFirst", () => {
  it("ordena un árbol para que ninguna fila preceda a su padre", () => {
    const rows = [
      { id: "c", parentId: "b" },
      { id: "b", parentId: "a" },
      { id: "a", parentId: null },
    ];
    assert.deepEqual(
      parentsFirst(rows, "id", ["parentId"]).map((r) => r.id),
      ["a", "b", "c"],
    );
  });

  it("no espera a un padre que no está en el conjunto", () => {
    const rows = [{ id: "x", parentId: "already-in-the-database" }];
    assert.deepEqual(parentsFirst(rows, "id", ["parentId"]), rows);
  });

  it("rechaza un ciclo en vez de perder filas", () => {
    assert.throws(() =>
      parentsFirst(
        [
          { id: "a", parentId: "b" },
          { id: "b", parentId: "a" },
        ],
        "id",
        ["parentId"],
      ),
    );
  });
});
