import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule Builder",
  description: "Excel → Timeline → печать и Тильда"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      {/* Root layout should only mount global css and page content.
          Topbar/logout belong to protected branch layout: app/app/layout.tsx */}
      <body>{children}</body>
    </html>
  );
}

