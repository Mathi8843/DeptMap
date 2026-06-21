const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DebtMap",
  url: "https://dept-map.vercel.app",
  logo: "https://dept-map.vercel.app/favicon.ico",
  description: "AI-powered security and technical debt monitor for vibe-coded apps.",
  foundingDate: "2025",
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DebtMap",
  url: "https://dept-map.vercel.app",
  description: "AI-powered security and technical debt monitor for vibe-coded apps.",
};

const softwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DebtMap",
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

const schemas = [organization, website, softwareApp];

export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  );
}
