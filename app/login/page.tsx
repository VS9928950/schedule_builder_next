import LoginForm from "./LoginForm";

/** Серверная оболочка: иначе HEAD/crawler и часть браузеров ловят RSC 307 на тот же `/login`. */
export default function LoginPage() {
  return <LoginForm />;
}
