import type { MetadataRoute } from "next"
import { getBaseUrl } from "@/lib/config"

const DISALLOW = [
  "/admin",
  "/dashboard",
  "/lender",
  "/portal",
  "/api",
  "/auth",
  "/guest-access",
  "/guest-dashboard",
  "/convert-account",
  "/conditions",
  "/start",
]

// AI search / answer-engine crawlers explicitly allowed for GEO
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "CCBot",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  }
}
