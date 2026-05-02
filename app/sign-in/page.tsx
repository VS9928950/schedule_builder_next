import { headers } from "next/headers";
import LoginForm from "./LoginForm";

/** Вход на `/sign-in`: путь `/login` отдаётся через `next.config.js` → один 307 сюда (обход самопетли Next на `/login`). */
export default async function SignInPage() {
  await headers();
  return <LoginForm />;
}
