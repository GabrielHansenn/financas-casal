"use client";

// Last-resort boundary for errors in the root layout. It replaces the whole document, so it
// cannot rely on the app's CSS or theme: minimal inline styles that follow the OS color scheme.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <title>Erro · Finanças Casal</title>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "22rem" }}>
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Algo deu errado</h1>
          <p style={{ margin: 0, opacity: 0.75 }}>
            O app não conseguiu carregar. Verifique sua conexão e tente de novo.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "0.6rem 1rem", borderRadius: "0.5rem", border: "1px solid", cursor: "pointer", font: "inherit" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
