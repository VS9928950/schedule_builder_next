// Keep global styles available for protected /app branch too.
// This avoids unstyled dashboard pages in some standalone runtime bundles.
import "../globals.css";
import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return <>{children}</>;

  return <div className="wrap">{children}</div>;
}

