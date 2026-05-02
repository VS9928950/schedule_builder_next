import { headers } from "next/headers";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  await headers();
  return <RegisterForm />;
}
