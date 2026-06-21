import type { Metadata } from "next";
import LandingPage from "./landing-page";

export const metadata: Metadata = {
  title: "DebtMap — AI Security Scanner for Vibe-Coded Apps | Free Audit",
  description: "Scan Lovable, Bolt & Cursor apps for OWASP vulnerabilities and slopsquatted packages. AI-powered explanations with 1-click GitHub PR fixes. Free for 1 repo.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "DebtMap — AI Security for Vibe-Coded Apps",
    description: "Catch OWASP vulnerabilities and slopsquatted packages in AI-generated code. Plain English explanations with 1-click GitHub PR fixes. Free for 1 repo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtMap — AI Security for Vibe-Coded Apps",
    description: "Catch OWASP vulnerabilities and slopsquatted packages in AI-generated code. Plain English explanations with 1-click GitHub PR fixes. Free for 1 repo.",
    images: ["https://dept-map.vercel.app/opengraph-image.png"],
  },
  alternates: { canonical: "https://dept-map.vercel.app" },
};

export default function Page() {
  return <LandingPage />;
}
