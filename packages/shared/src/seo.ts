/** Safe inside an HTML script element, including user-authored JSON-LD. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The public apex redirects to www; canonical signals must use the final host. */
export function canonicalOrigin(value = "https://www.nassican.com"): string {
  const url = new URL(value);
  if (url.hostname === "nassican.com" || url.hostname === "www.nassican.com") {
    return "https://www.nassican.com";
  }
  return url.origin;
}

export const aiSearchBots = [
  "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User", "DuckAssistBot",
] as const;

export const aiTrainingBots = [
  "GPTBot", "ClaudeBot", "anthropic-ai", "Google-Extended",
  "Applebot-Extended", "meta-externalagent", "Amazonbot", "Bytespider",
  "cohere-ai", "CCBot",
] as const;

export type CrawlSettings = {
  allowAiSearch: boolean;
  allowAiTraining: boolean;
  llmsEnabled: boolean;
};

export const defaultCrawlSettings: CrawlSettings = {
  allowAiSearch: true,
  allowAiTraining: true,
  llmsEnabled: true,
};

export function isIndexableDeployment(env: { NODE_ENV?: string; VERCEL_ENV?: string }): boolean {
  return env.NODE_ENV === "production" && (!env.VERCEL_ENV || env.VERCEL_ENV === "production");
}

/** Each specific group needs its own API exclusion: robots groups do not inherit. */
export function buildRobots(origin: string, settings: CrawlSettings, indexable: boolean, extra = ""): string {
  const group = (agents: readonly string[], allow: boolean) => [
    ...agents.map((agent) => `User-agent: ${agent}`),
    ...(allow ? ["Allow: /", "Disallow: /api/"] : ["Disallow: /"]),
  ].join("\n");
  if (!indexable) return group(["*"], false) + "\n";
  return [
    group(["*"], true),
    group(aiSearchBots, settings.allowAiSearch),
    group(aiTrainingBots, settings.allowAiTraining),
    `Sitemap: ${origin.replace(/\/$/, "")}/sitemap.xml`,
    extra.trim(),
  ].filter(Boolean).join("\n\n") + "\n";
}

/** Conflicting duplicate groups can silently undo a crawler opt-out. */
export function robotsExtraProblem(extra: string): string | null {
  const reserved = new Set<string>(["*", ...aiSearchBots, ...aiTrainingBots].map((s) => s.toLowerCase()));
  let hasAgent = false;
  for (const raw of extra.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = /^(user-agent|allow|disallow|crawl-delay|sitemap)\s*:\s*(.*)$/i.exec(line);
    if (!match) return "robots.txt: usa directivas User-agent, Allow, Disallow, Crawl-delay o Sitemap.";
    const [, directive, value] = match;
    if (directive.toLowerCase() === "user-agent") {
      if (!value || reserved.has(value.toLowerCase())) return "Ese bot ya se configura con los controles de rastreo; no dupliques su grupo en robots.txt.";
      hasAgent = true;
    } else if (directive.toLowerCase() !== "sitemap" && !hasAgent) {
      return "Cada regla adicional necesita primero su propio User-agent.";
    }
  }
  return null;
}
