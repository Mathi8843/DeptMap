import type { Metadata } from "next";
import { AppContextProvider } from "@/lib/AppContext";
import ToastContainer from "@/components/layout/ToastContainer";
import "./globals.css";

export const metadata: Metadata = {
  title: "DebtMap — AI Code Health OS",
  description: "The AI-powered security and technical debt monitor for vibe-coded apps. Catch vulnerabilities before they become breaches.",
  keywords: "code security, vibe coding, AI code review, technical debt, OWASP, slopsquatting",
  openGraph: {
    title: "DebtMap — AI Code Health OS",
    description: "Security scanning built for non-developer founders who shipped with Lovable, Bolt, or Cursor.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased selection:bg-lime-500/20 selection:text-lime-300">
        <AppContextProvider>
          {children}
          <ToastContainer />
        </AppContextProvider>
      </body>
    </html>
  );
}

