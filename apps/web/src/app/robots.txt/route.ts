import { getSeoSettings } from "@/lib/data/seo-settings";
import { absoluteUrl, siteUrl } from "@/lib/seo";

/**
 * A route handler rather than the `robots.ts` metadata convention, because
 * `MetadataRoute.Robots` has no way to emit arbitrary lines and the panel needs
 * to append its own. The output below reproduces what the convention generated,
 * line for line, plus whatever `robotsExtra` holds.
 */

/**
 * Preview and development deployments must never be indexed: they serve the
 * same content under a different origin, which Google reads as duplicate
 * content and can end up outranking the real domain.
 */
const isProduction =
  process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === "production";

/**
 * Crawlers that read the site to answer a user's question and cite the source.
 * A portfolio wants to be quoted by these, so they get an explicit Allow
 * instead of relying on the catch-all rule.
 */
const aiSearchBots = [
  // OpenAI: OAI-SearchBot indexes for ChatGPT search, ChatGPT-User fetches a
  // page when someone pastes the link into a conversation.
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic
  "Claude-SearchBot",
  "Claude-User",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Apple Intelligence / Siri
  "Applebot",
  // Microsoft Copilot rides on Bingbot, listed for clarity
  "Bingbot",
  // DuckDuckGo's assistant
  "DuckAssistBot",
];

/**
 * Crawlers that collect content for model training. Kept allowed on purpose:
 * for a personal brand, being part of what the models know about the name is
 * the whole point. Move any of these to the disallow rule to opt out.
 */
const aiTrainingBots = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "Bytespider",
  "cohere-ai",
  "CCBot",
];

function group(agents: string[], rules: string[]): string {
  return [...agents.map((a) => `User-Agent: ${a}`), ...rules].join("\n");
}

export async function GET() {
  if (!isProduction) {
    return new Response(group(["*"], ["Disallow: /"]) + "\n", {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const settings = await getSeoSettings();

  const blocks = [
    // No API routes are meant to be indexed; `/_next/` stays crawlable so
    // Google can render the page with its real CSS and JS.
    group(["*"], ["Allow: /", "Disallow: /api/"]),
    group(aiSearchBots, ["Allow: /"]),
    group(aiTrainingBots, ["Allow: /"]),
    [`Host: ${siteUrl}`, `Sitemap: ${absoluteUrl("/sitemap.xml")}`].join("\n"),
  ];

  const extra = settings?.robotsExtra?.trim();
  if (extra) blocks.push(extra);

  return new Response(blocks.join("\n\n") + "\n", {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
