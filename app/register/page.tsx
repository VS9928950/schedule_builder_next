import RegisterForm from "./RegisterForm";

// Симметрично со страницей входа: без статической оптимизации сегмента.
export const dynamic = "force-dynamic";

/** Без `headers()` — см. комментарий в `app/sign-in/page.tsx`. */
export default function RegisterPage() {
  return <RegisterForm />;
}
