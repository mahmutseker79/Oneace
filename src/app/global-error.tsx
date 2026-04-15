"use client";

// Sprint 37: Global error boundary.
//
// `global-error.tsx` catches errors thrown during the render of the
// root layout itself (or anywhere below it that no segment-level
// `error.tsx` handles first). Next.js 15 requires this file to be
// a Client Component, to render its own `<html>` and `<body>`
// (because the root layout may be the thing that failed), and to
// be deliberately minimal — this is the last line of defence before
// the user sees the default Next.js crash screen.
//
// We intentionally do not load any i18n here. This boundary runs
// when the root layout has crashed, which means `getMessages()`
// itself may be the culprit. A hard-coded English fallback keeps
// the error surface bootable regardless of what blew up upstream.
// The message is bland on purpose: we don't leak error details in
// production (they're logged via `reportError` below and surfaced
// in the server log aggregator).

import { useEffect } from "react";

import { captureException } from "@/lib/sentry";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Send to Sentry — no-op when DSN is unset.
    captureException(error);
    // eslint-disable-next-line no-console
    console.error("[global-error] unhandled render error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          backgroundColor: "#fdfcfb",
          color: "#1e293b",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              margin: "0 0 0.75rem 0",
            }}
          >
            The app hit an unexpected error.
          </h1>
          <p style={{ color: "#475569", margin: "0 0 1.5rem 0", lineHeight: 1.5 }}>
            We've logged what happened. You can try again, and if the problem persists please
            refresh the page or contact support with the reference below.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                color: "#94a3b8",
                margin: "0 0 1.5rem 0",
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.6rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#0f172a",
              color: "#f8fafc",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
