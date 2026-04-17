import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "OneAce — Inventory Management for Growing Businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#fdfcfb",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        gap: 24,
        padding: 60,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: "#6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          O
        </div>
        <span style={{ fontSize: 40, fontWeight: 700, color: "#1e293b" }}>OneAce</span>
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: 52,
          fontWeight: 600,
          color: "#1e293b",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 900,
        }}
      >
        Inventory management for growing businesses
      </div>

      {/* Subhead */}
      <div
        style={{
          fontSize: 26,
          color: "#64748b",
          textAlign: "center",
          maxWidth: 780,
        }}
      >
        Offline-first · Barcode scanning · Multi-warehouse · Start free
      </div>

      {/* Price callout */}
      <div
        style={{
          marginTop: 8,
          background: "#eef2ff",
          borderRadius: 12,
          padding: "12px 32px",
          fontSize: 22,
          color: "#4338ca",
          fontWeight: 600,
        }}
      >
        Pro from $29/mo · 5× cheaper than Sortly Ultra
      </div>
    </div>,
    { ...size },
  );
}
