"use client";

/**
 * Root layout failure boundary — must render its own <html>/<body>
 * because the root layout itself is unavailable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: "Vazirmatn, system-ui, sans-serif", background: "#0a0d12", color: "#e8eef5" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>خطای جدی در برنامه</h1>
          <p style={{ maxWidth: "28rem", fontSize: "0.875rem", opacity: 0.8 }}>
            برنامه نتوانست بارگذاری شود. لطفاً صفحه را دوباره باز کنید.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#3dffa8",
              color: "#0a0d12",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
