import LoginForm from "./LoginForm";

/** Вход: только клиентская форма + `POST /api/auth/login`. Без `headers()` — иначе в проде Next 15 даёт 307 `Location: /sign-in` (петля static/dynamic). */
export default function SignInPage() {
  return <LoginForm />;
}
