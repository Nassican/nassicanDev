import assert from "node:assert/strict";
import { test } from "node:test";
import { diplomasMissingAlt, suggestDiplomaAlt, type CertificateDraft } from "./profile-draft";

const locales = ["es", "en"] as const;

function certificate(over: Partial<CertificateDraft> = {}): CertificateDraft {
  return {
    id: null,
    provider: "Platzi",
    dateLabel: "2024",
    url: "https://platzi.com/p/x/curso/1/diploma/detalle/",
    title: { es: "Curso de Git", en: "Git course" },
    category: { es: "Herramientas", en: "Tools" },
    fileMediaId: null,
    imageUrl: null,
    alt: { es: "", en: "" },
    ...over,
  };
}

test("the suggestion names the provider and the course in each language", () => {
  assert.deepEqual(suggestDiplomaAlt(certificate()), {
    es: "Diploma de Platzi por aprobar «Curso de Git».",
    en: "Platzi diploma for passing “Git course”.",
  });
});

test("a missing English title falls back to the Spanish one, and no provider reads cleanly", () => {
  assert.deepEqual(suggestDiplomaAlt(certificate({ provider: " ", title: { es: "Curso de Git", en: "" } })), {
    es: "Diploma por aprobar «Curso de Git».",
    en: "Diploma for passing “Curso de Git”.",
  });
});

test("only a certificate with an image needs alt text", () => {
  assert.deepEqual(diplomasMissingAlt([certificate()], locales), []);
});

test("an image missing alt in any language is named by its Spanish title", () => {
  const items = [
    certificate({ fileMediaId: "m1", alt: { es: "Diploma", en: "  " } }),
    certificate({ fileMediaId: "m2", alt: { es: "Diploma", en: "Diploma" }, title: { es: "Completo", en: "Done" } }),
  ];
  assert.deepEqual(diplomasMissingAlt(items, locales), ["Curso de Git"]);
});
