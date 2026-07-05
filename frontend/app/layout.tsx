import type { Metadata } from "next";
import { Inter, Outfit, Fira_Code } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { ToastProvider } from "@/lib/contexts/ToastContext";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import DataAndAppProviders from "@/app/providers";
import ToastContainer from "@/components/layout/ToastContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import JsonLd from "@/components/seo/JsonLd";
import "./globals.css";

const appleTouchIcon = {
  url: "/apple-touch-icon.png",
  sizes: "180x180",
  type: "image/png",
};

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
  title: "DebtMap — AI Code Health & Security Platform",
  description: "The AI-powered security and technical debt monitor for vibe-coded apps. Catch OWASP vulnerabilities, slopsquatted packages, and code issues before they ship.",
  keywords: "code security, vibe coding, AI code review, technical debt, OWASP, slopsquatting",
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    apple: appleTouchIcon,
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "DebtMap — AI Code Health & Security Platform",
    description: "Security scanning built for non-developer founders. Catch OWASP vulnerabilities and slopsquatted packages in apps built with Lovable, Bolt, or Cursor.",
    url: "https://debtmap.com",
    siteName: "DebtMap",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtMap — AI Code Health & Security Platform",
    description: "Security scanning built for non-developer founders. Catch OWASP vulnerabilities and slopsquatted packages in apps built with Lovable, Bolt, or Cursor.",
    images: ["https://debtmap.com/opengraph-image.png"],
  },
  metadataBase: new URL("https://debtmap.com"),
  alternates: { canonical: "https://debtmap.com" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${outfit.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <Script id="theme-init" strategy="beforeInteractive">
        {`
          (function() {
            try {
              var t = localStorage.getItem("debtmap-theme");
              if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                document.documentElement.classList.add("dark");
              }
            } catch(e) {}
          })();
        `}
      </Script>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-KM8Q5GSPXZ"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-KM8Q5GSPXZ');
        `}
      </Script>
      <body className="antialiased selection:bg-lime-500/20 selection:text-lime-300">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-500 focus:text-white focus:rounded-xl focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <JsonLd />
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

