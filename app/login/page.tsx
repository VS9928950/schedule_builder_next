import LoginForm from "./LoginForm";

/** Статическая страница: убирает RSC-редирект 307 на тот же URL (см. curl -I /login). */
export const dynamic = "force-static";

export default function LoginPage() {
  return <LoginForm />;
}
