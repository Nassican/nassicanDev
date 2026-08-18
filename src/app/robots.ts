import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/seo";

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

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // No API routes exist today; the rule keeps future ones out of the
        // index by default. `/_next/` stays crawlable so Google can render
        // the page with its real CSS and JS.
        disallow: ["/api/"],
      },
      {
        userAgent: aiSearchBots,
        allow: "/",
      },
      {
        userAgent: aiTrainingBots,
        allow: "/",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
