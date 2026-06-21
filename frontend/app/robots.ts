import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/issues",
          "/repos",
          "/packages",
          "/soc2",
          "/settings",
          "/trend",
          "/admin",
          "/auth/",
          "/onboarding",
        ],
      },
    ],
    sitemap: "https://dept-map.vercel.app/sitemap.xml",
  }
}
