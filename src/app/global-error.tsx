"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#0b0b0f",
          color: "#f5f5f7",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 600 }}>
          PromptForge hit a snag
        </h1>
        <p style={{ marginTop: "0.75rem", color: "#a1a1aa", maxWidth: 380 }}>
          A critical error occurred while loading the app. Reloading usually
          fixes this.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            background: "#7c3aed",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
