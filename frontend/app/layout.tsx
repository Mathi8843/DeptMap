import type { Metadata } from "next";
import { Inter, Outfit, Fira_Code } from "next/font/google";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { ToastProvider } from "@/lib/contexts/ToastContext";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import DataAndAppProviders from "@/app/providers";
import ToastContainer from "@/components/layout/ToastContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
});

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
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${outfit.variable} ${firaCode.variable}`}>
      <body className="antialiased selection:bg-lime-500/20 selection:text-lime-300">
        <ThemeProvider>
          <ToastProvider>
            <ErrorBoundary>
              <AuthProvider>
                <DataAndAppProviders>
                  {children}
                  <ToastContainer />
                </DataAndAppProviders>
              </AuthProvider>
            </ErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

