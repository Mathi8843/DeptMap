import type { Metadata } from "next";
import LandingPage from "./landing-page";

export const metadata: Metadata = {
  title: "DebtMap — AI Security Scanner for Vibe-Coded Apps | Free Audit",
  description: "Scan your Lovable, Bolt & Cursor apps for OWASP vulnerabilities, slopsquatted packages, and technical debt. AI-powered explanations and one-click GitHub PR fixes. Free for 1 repo.",
  openGraph: {
    title: "DebtMap — AI Security for Vibe-Coded Apps",
    description: "Catch OWASP vulnerabilities and slopsquatted packages in AI-generated code. Plain English explanations. One-click fixes.",
  },
  alternates: { canonical: "https://dept-map.vercel.app" },
};

export default function Page() {
  return <LandingPage />;
}
