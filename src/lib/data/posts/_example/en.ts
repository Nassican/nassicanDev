import type { PostTranslation } from "../types";

export const en: PostTranslation = {
  title: "Article title",
  description:
    "A one or two sentence summary. It is used as the meta description and as the excerpt on the listing card, so keep it under 160 characters.",
  body: [
    {
      type: "paragraph",
      text: "First paragraph. Blocks render in order and are the only way to write the body: there is no Markdown or MDX, so a malformed block fails to compile instead of breaking in production.",
    },
    { type: "heading", text: "A subheading" },
    {
      type: "paragraph",
      text: "Headings derive their own anchor from the text, with accents stripped, so a specific section can be linked to.",
    },
    {
      type: "list",
      items: ["A list item.", "Pass `ordered: true` to number the list."],
    },
    {
      type: "code",
      language: "ts",
      code: 'const greeting = "hello";',
    },
    {
      type: "quote",
      text: "A pull quote, to highlight one idea.",
    },
  ],
};
