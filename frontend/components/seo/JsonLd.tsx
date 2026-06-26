const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Risk Guard AI",
  url: "https://riskguardai.vercel.app",
  logo: "https://riskguardai.vercel.app/favicon.svg",
  description: "AI-powered security and technical debt monitor for vibe-coded apps.",
  foundingDate: "2025",
  sameAs: [
    "https://github.com/debtmap",
    "https://twitter.com/debtmap",
  ],
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Risk Guard AI",
  url: "https://riskguardai.vercel.app",
  description: "AI-powered security and technical debt monitor for vibe-coded apps.",
};

const softwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Risk Guard AI",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  description:
    "AI-powered security and technical debt monitor for vibe-coded apps. Catch vulnerabilities before they become breaches.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "16000",
    priceCurrency: "INR",
    offerCount: "3",
  },
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      "name": "What is Risk Guard AI?",
      acceptedAnswer: {
        "@type": "Answer",
        "text": "Risk Guard AI is an AI-powered security scanner built for apps generated with AI coding tools like Lovable, Bolt, Cursor, and Replit. It finds OWASP vulnerabilities, detects slopsquatted packages, and generates one-click GitHub PR fixes — all explained in plain English.",
      },
    },
    {
      "@type": "Question",
      "name": "Do I need to be a developer to use Risk Guard AI?",
      acceptedAnswer: {
        "@type": "Answer",
        "text": "No. Risk Guard AI was built specifically for non-developer founders who shipped their app with AI. Every vulnerability is explained in plain English with clear instructions on what it means and how to fix it.",
      },
    },
    {
      "@type": "Question",
      "name": "What tools does Risk Guard AI work with?",
      acceptedAnswer: {
        "@type": "Answer",
        "text": "Risk Guard AI works with any GitHub repository, regardless of how it was built. Whether you used Lovable, Bolt, Cursor, Replit, or wrote the code yourself, we scan and protect it.",
      },
    },
    {
      "@type": "Question",
      "name": "Is my code stored on your servers?",
      acceptedAnswer: {
        "@type": "Answer",
        "text": "Your source code is scanned in real-time and is not permanently stored. Scan results — vulnerability data and health scores — are saved so you can track progress over time. Your actual code stays on GitHub.",
      },
    },
    {
      "@type": "Question",
      "name": "Can I cancel my subscription?",
      acceptedAnswer: {
        "@type": "Answer",
        "text": "Yes. There are no lock-in contracts. The Free plan is free forever, and paid plans can be cancelled at any time. You keep access to your dashboard until the billing period ends.",
      },
    },
  ],
};

const schemas = [organization, website, softwareApp, faqPage];

export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  );
}
