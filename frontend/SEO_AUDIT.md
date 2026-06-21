# SEO Audit — DebtMap Frontend

> Generated: 2026-06-21

---

## Page Score Card

```
Overall Score: 40/100

On-Page SEO:     35/100  ████░░░░░░
Content Quality: 55/100  ██████░░░░
Technical:       30/100  ███░░░░░░░
Schema:           0/100  ░░░░░░░░░░
Images:          20/100  ██░░░░░░░░
```

---

## Issues Found

### Critical

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 1 | **No sitemap.xml** | Missing from project | Search engines cannot discover all 12 pages. Crawl budget is wasted. |
| 2 | **No robots.txt** | Missing from project | No way to block staging/duplicate content or guide crawlers away from auth pages. |
| 3 | **Dashboard pages have zero per-page metadata** | `app/(dashboard)/` (9 pages) | All dashboard pages inherit the root layout's generic title. Every page shows "DebtMap — AI Code Health OS" in search results. All are `"use client"` so they cannot use `generateMetadata`. |
| 4 | **No canonical tags** | Root layout metadata | Risk of duplicate content issues. |
| 5 | **No schema markup anywhere** | Entire site | Missing `Organization`, `WebSite`, `SoftwareApplication`, `Product`. Zero structured data = no rich results. |

### High

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 6 | **Title tag too short** (30 chars) | `app/layout.tsx:11` | `"DebtMap — AI Code Health OS"` is well under the 50-60 char recommendation. Missing secondary keywords. |
| 7 | **Meta description too short** (113 chars) | `app/layout.tsx:12` | 113 chars vs 150-160 recommended. Missing call-to-action. |
| 8 | **No Twitter Card meta tags** | Root layout metadata | `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` all absent. Social previews on X/Twitter will be broken. |
| 9 | **No Open Graph image** | Root layout metadata | `og:image` missing. LinkedIn, Facebook, Discord, Slack — no preview image. |
| 10 | **No meta robots** | Root layout metadata | Default is `index, follow`, but auth-required pages (`/dashboard`, `/settings`, `/admin`) should be `noindex`. |
| 11 | **H1 spans two lines via `<br>`** | `app/page.tsx:224-228` | `<br>` inside H1 may fragment how search engines interpret the heading's topical focus. |

### Medium

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 12 | **No external authority outbound links** | Landing page | No links to OWASP, NIST, CWE, or security research to build topical authority. |
| 13 | **Missing keyword-rich anchor text for internal links** | Throughout | Nav links say "Features", "Pricing" — functional but not keyword-optimized. |
| 14 | **No publication or last-updated dates** | Landing page | No visible content freshness signal. |
| 15 | **No E-E-A-T signals** | Entire site | No author bios, credentials, team page, case studies, or first-hand experience content. For a security product, trust signals are critical. |
| 16 | **`og:url` and `og:site_name` missing** | Root layout metadata | Open Graph is incomplete. |
| 17 | **Landing page word count (~500 words)** | `app/page.tsx` | For a SaaS landing page this is thin. Competitors typically run 1,500-3,000 words. |

### Low

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 18 | **Favicon is default Next.js** | `app/favicon.ico` | Should be replaced with the DebtMap brand icon. |
| 19 | **No hero image or product screenshots** | Landing page | Zero images on the landing page. |
| 20 | **No `alt` text on nav anchor icons** | `app/page.tsx:238` | GitHub SVG icon has no accessible label. |
| 21 | **`public/` contains only boilerplate SVGs** | `public/` | `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — unused boilerplate from `create-next-app`. |

---

## Recommendations

### Priority 1: Fix Critical Schema + Discovery

**1.1 Add `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://debtmap.dev"
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/onboarding`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...["dashboard","issues","repos","packages","soc2","settings","trend"].map(p => ({
      url: `${baseUrl}/${p}`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7
    })),
  ]
}
```

**1.2 Add `app/robots.ts`**

```ts
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/issues", "/repos", "/packages", "/soc2", "/settings", "/trend", "/admin", "/auth/"],
      },
    ],
    sitemap: "https://debtmap.dev/sitemap.xml",
  }
}
```

**1.3 Add JSON-LD schema to root layout**

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "DebtMap",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "Web",
  "description": "AI-powered security and technical debt monitor for vibe-coded apps.",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0",
    "highPrice": "16000",
    "priceCurrency": "INR",
    "offerCount": "3"
  }
}
```

### Priority 2: Per-Page Metadata

- Wrap dashboard pages in server component shells to allow `generateMetadata`
- Or set `<title>` / `<meta>` dynamically in client components

### Priority 3: Complete OG + Twitter Cards

Expand root layout metadata:

```ts
export const metadata: Metadata = {
  title: "DebtMap — AI Security & Code Audit Tool for Vibe-Coded Apps",
  description: "AI-powered security scanning for apps built with Lovable, Bolt & Cursor. Catch OWASP vulnerabilities, slopsquatted packages, and technical debt. Free for 1 repo.",
  openGraph: {
    title: "DebtMap — AI Code Health OS",
    description: "Security scanning built for non-developer founders who shipped with Lovable, Bolt, or Cursor.",
    url: "https://debtmap.dev",
    siteName: "DebtMap",
    images: [{ url: "https://debtmap.dev/og-image.png", width: 1200, height: 630 }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtMap — AI Code Health OS",
    description: "Security scanning built for non-developer founders who shipped with Lovable, Bolt, or Cursor.",
    images: ["https://debtmap.dev/og-image.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://debtmap.dev" },
}
```

### Priority 4: Content & Authority

- Expand landing page to 1,500+ words with deeper features, FAQ, testimonials
- Add blog / case study section
- Add external links to OWASP, NIST, CWE
- Add product screenshot as hero + OG image

### Priority 5: Cleanup

- Remove boilerplate SVGs from `public/`
- Replace favicon with brand "D" icon
- Add `aria-label` to GitHub SVG
- Add `width` / `height` on raster images

---

## Schema Suggestions

### Organization (root layout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "DebtMap",
  "url": "https://debtmap.dev",
  "logo": "https://debtmap.dev/icon.png",
  "description": "AI-powered security and technical debt monitor for vibe-coded apps.",
  "foundingDate": "2025"
}
```

### Product (pricing section)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "DebtMap - Free Plan",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock",
    "description": "1 repository, weekly scans, health score, plain English issues"
  }
}
```

---

## How to Verify

```powershell
# Preview sitemap
curl http://localhost:3000/sitemap.xml

# Preview robots.txt
curl http://localhost:3000/robots.txt

# Check meta tags on landing page
curl http://localhost:3000 | Select-String -Pattern "(title|meta|og:|twitter:)"

# Build check
cd frontend; npm run build
```
