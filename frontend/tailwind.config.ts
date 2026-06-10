import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#070710",
          2: "#0d0d1a",
          3: "#121220",
          4: "#181828",
        },
        border: {
          DEFAULT: "#1f1f35",
          2: "#2e2e50",
        },
        text: {
          DEFAULT: "#eeeeff",
          2: "#8888bb",
          3: "#44446a",
        },
        lime: {
          DEFAULT: "#b8ff57",
          2: "#d4ff8a",
        },
        red: {
          DEFAULT: "#ff5757",
        },
        amber: {
          DEFAULT: "#ffaa33",
        },
        blue: {
          DEFAULT: "#5599ff",
        },
        purple: {
          DEFAULT: "#aa77ff",
        },
        teal: {
          DEFAULT: "#33ddbb",
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        display: ["Syne", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
