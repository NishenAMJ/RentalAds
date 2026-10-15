"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the whole
 * document, so it cannot rely on the app's providers or stylesheets and keeps its styling inline.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0c0c0d", color: "#ececee", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Something went wrong</h1>
          <p role="alert" style={{ color: "#9b9ba3", lineHeight: 1.6, margin: "0 0 24px" }}>
            We could not load the site. Please try again. If this keeps happening, come back in a few minutes.
          </p>
          <button type="button" onClick={reset} style={{ padding: "12px 22px", border: 0, borderRadius: 8, background: "#34d399", color: "#06281c", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
