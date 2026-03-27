import type { MetadataRoute } from "next"
import { getBaseUrl } from "@/lib/config"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
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
      ],
    },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  }
}
