import "../globals.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="wrap">{children}</div>;
}

