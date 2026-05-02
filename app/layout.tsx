import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule Builder",
  description: "Excel → Timeline → печать и Тильда"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

