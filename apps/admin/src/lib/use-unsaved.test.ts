import assert from "node:assert/strict";
import { test } from "node:test";
import { isDirty } from "./use-unsaved";

/**
 * The whole point of comparing by value: the editors rebuild their draft object
 * on every keystroke, so a reference check would call a freshly opened form
 * dirty and teach the operator to dismiss the warning.
 */
test("the same content in a different object is not dirty", () => {
  const a = { slug: "hola", translations: [{ locale: "es", title: "Hola" }] };
  const b = { slug: "hola", translations: [{ locale: "es", title: "Hola" }] };

  assert.notEqual(a, b);
  assert.equal(isDirty(a, b), false);
});

test("key order does not count as a change", () => {
  assert.equal(
    isDirty({ title: "Hola", slug: "hola" }, { slug: "hola", title: "Hola" }),
    false,
  );
});

test("a nested key order does not count either", () => {
  assert.equal(
    isDirty(
      { body: [{ type: "list", ordered: true, items: ["a"] }] },
      { body: [{ items: ["a"], type: "list", ordered: true }] },
    ),
    false,
  );
});

test("an edit is dirty", () => {
  assert.equal(isDirty({ title: "Hola" }, { title: "Hola " }), true);
});

test("an edit nested inside a body block is dirty", () => {
  assert.equal(
    isDirty(
      { translations: [{ locale: "es", body: [{ type: "p", text: "uno" }] }] },
      { translations: [{ locale: "es", body: [{ type: "p", text: "dos" }] }] },
    ),
    true,
  );
});

/** Array order is content here: moving a block is an edit, not a reshuffle. */
test("reordering blocks is dirty", () => {
  assert.equal(
    isDirty(
      { body: [{ text: "uno" }, { text: "dos" }] },
      { body: [{ text: "dos" }, { text: "uno" }] },
    ),
    true,
  );
});

/**
 * `ordered?: boolean` means an absent key and an explicit `undefined` describe
 * the same list — the discovery that `normaliseBody` exists for. A form that
 * normalises one into the other must not look edited for it.
 */
test("an absent key and an explicit undefined are the same draft", () => {
  assert.equal(
    isDirty(
      { type: "list", items: ["a"] },
      { type: "list", items: ["a"], ordered: undefined },
    ),
    false,
  );
});

test("null is not the same as absent", () => {
  assert.equal(isDirty({ coverMediaId: null }, {}), true);
});
