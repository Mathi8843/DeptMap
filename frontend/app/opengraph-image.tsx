import { ImageResponse } from "next/og";

export const alt = "DebtMap — AI Code Health OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "radial-gradient(circle at 50% 0%, #15102a 0%, #06060c 60%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: "#b8ff57",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 800,
            color: "#000",
            marginBottom: 20,
          }}
        >
          D
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#eeeeff",
            letterSpacing: "-0.02em",
            marginBottom: 12,
          }}
        >
          DebtMap
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#8888bb",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          AI Code Health OS
        </div>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 24,
            fontSize: 14,
            color: "#b8ff57",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span>Vulnerability Scanner</span>
          <span style={{ color: "#44446a" }}>·</span>
          <span>Slopsquatting Detector</span>
          <span style={{ color: "#44446a" }}>·</span>
          <span>1-Click PR Fixes</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
