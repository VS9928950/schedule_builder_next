import VerifyEmailClient from "./VerifyEmailClient";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp?.token === "string" ? sp.token : "";
  return <VerifyEmailClient token={token} />;
}

