import type { Localized } from "@/lib/i18n/config";
import type { ContentBlock } from "../content";

/**
 * One language of one project. Each project keeps these in their own file
 * (`es.ts`, `en.ts`) so editing a translation touches only that language.
 *
 * Only `tagline` is required: a project can be listed with `comingSoon: true`
 * before its case study exists, rather than shipping placeholder prose.
 */
export type ProjectTranslation = {
  /** One line, used on cards, meta descriptions and the OG image. */
  tagline: string;
  /** What the project is, in two or three sentences. Opens the case study. */
  summary?: string;
  role?: string;
  /** Short bullets shown in the case study sidebar. */
  highlights?: string[];
  /** The case study itself. */
  body?: ContentBlock[];
};

/** Everything about a project that is the same in every language. */
export type ProjectMeta = {
  /** URL segment: `/projects/<slug>` and `/en/projects/<slug>`. Matches the folder name. */
  slug: string;
  /** Product name; identical in both languages, so it is not translated. */
  title: string;
  /** Year or range shown next to the title. */
  year: string;
  /** Machine-readable date for `datePublished` and the sitemap. */
  date: string;
  /** Names must match the keys in `skills.ts` so the icons resolve. */
  stack: string[];
  demo: string;
  /** Omit when the repository is private. */
  repo?: string;
  /** Path under /public; omit to render the placeholder tile. */
  image?: string;
  /** Pinned to the homepage grid. */
  featured?: boolean;
  /**
   * The case study is not written yet. The detail page says so instead of
   * rendering an empty shell, and the card links to it as "coming soon".
   */
  comingSoon?: boolean;
};

export type ProjectItem = ProjectMeta & {
  /**
   * `Localized` makes every language required, so a project cannot ship with a
   * missing translation — the build fails instead.
   */
  content: Localized<ProjectTranslation>;
};
