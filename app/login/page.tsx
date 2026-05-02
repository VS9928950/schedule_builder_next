import { headers } from "next/headers";
import LoginForm from "./LoginForm";

/**
 * Динамический рендер: иначе при force-static / prerender Next отдаёт 307 Location: /login (петля в браузере).
 */
export default async function LoginPage() {
  await headers();
  return <LoginForm />;
}
