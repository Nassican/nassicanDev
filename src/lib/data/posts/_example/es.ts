import type { PostTranslation } from "../types";

export const es: PostTranslation = {
  title: "Título del artículo",
  description:
    "Resumen de una o dos frases. Se usa como meta description y como extracto en la tarjeta del listado, así que conviene dejarlo bajo 160 caracteres.",
  body: [
    {
      type: "paragraph",
      text: "Primer párrafo. Los bloques se renderizan en orden y son la única forma de escribir el cuerpo: no hay Markdown ni MDX, así que un bloque mal formado falla al compilar en lugar de romperse en producción.",
    },
    { type: "heading", text: "Un subtítulo" },
    {
      type: "paragraph",
      text: "Los encabezados generan su propia ancla a partir del texto, sin acentos, para que se pueda enlazar una sección concreta.",
    },
    {
      type: "list",
      items: [
        "Elemento de lista.",
        "Usa `ordered: true` para numerarla.",
      ],
    },
    {
      type: "code",
      language: "ts",
      code: 'const saludo = "hola";',
    },
    {
      type: "quote",
      text: "Una cita, para destacar una idea.",
    },
  ],
};
