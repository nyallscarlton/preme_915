import type { MetadataRoute } from "next"

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
        "/apply",
        "/guest-access",
        "/guest-dashboard",
        "/convert-account",
        "/conditions",
        "/start",
      ],
    },
    sitemap: "https://www.premerealestate.com/sitemap.xml",
  }
}
