import type { MetadataRoute } from "next"

const baseUrl = "https://dept-map.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  ]
}
