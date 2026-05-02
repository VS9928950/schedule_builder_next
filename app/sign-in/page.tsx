import LoginForm from "./LoginForm";

// Защита от неожиданных статических оптимизаций Next 15 на экране входа.
export const dynamic = "force-dynamic";

/** Вход: только клиентская форма + `POST /api/auth/login`. Без `headers()` — иначе в проде Next 15 даёт 307 `Location: /sign-in` (петля static/dynamic). */
export default function SignInPage() {
  return <LoginForm />;
}
