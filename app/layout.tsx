import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule Builder",
  description: "Excel → Timeline → печать и Тильда"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <style>{`
          /* Fallback critical styles to avoid "unstyled" auth pages if static CSS is not linked. */
          body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 18px 60px; }
          .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
          .brand { font-weight: 800; letter-spacing: .2px; }
          .card { background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.14); border-radius: 16px; padding: 16px; box-shadow: 0 18px 48px rgba(15,23,42,.10); }
          .grid { display: grid; gap: 14px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
          .muted { color: #475569; }
          .error { color: #dc2626; }
          input, button, select, textarea { font: inherit; }
          input[type="text"], input[type="email"], input[type="password"], input[type="number"], select, textarea { width: 100%; border: 1px solid rgba(15,23,42,.14); border-radius: 12px; padding: 10px 12px; }
          button { border: 1px solid rgba(15,23,42,.14); background: rgba(37,99,235,.10); padding: 10px 14px; border-radius: 12px; cursor: pointer; }
          @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
        `}</style>
        {children}
      </body>
    </html>
  );
}

