import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Important: do not redirect from layout.
  // In some Next.js 15 runtime/build states this can affect public routes and create a redirect loop.
  // Access control remains in pages/routes that require auth.
  if (!user) return <>{children}</>;

  return (
    <div className="wrap">
      <div className="topbar no-print-chrome">
        <div className="row" style={{ gap: 12 }}>
          <div className="brand">Schedule Builder</div>
          <div className="chip">{user.email}</div>
        </div>
        <form
          action="/api/auth/logout"
          method="post"
        >
          <button className="secondary" type="submit">
            Выйти
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}

