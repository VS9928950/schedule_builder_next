import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isMailerConfigured, sendEmail } from "@/lib/mailer";
import { consumeRateLimit, extractClientIp } from "@/lib/rate-limit";
import { resolveMailOrigin, toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
  if (user.role !== "admin") return NextResponse.redirect(toPublicUrl(req, "/app"), 303);
  const ip = extractClientIp(req);
  const rl = consumeRateLimit({ scope: "admin:invite", key: `${user.id}|${ip}`, limit: 15, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return NextResponse.redirect(toPublicUrl(req, "/app/admin?invite=error"), 303);

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin?invite=error"), 303);
  }

  if (!isMailerConfigured()) {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin?invite=error"), 303);
  }

  const baseUrl = resolveMailOrigin(req);
  const registerUrl = `${baseUrl}/register`;

  try {
    await sendEmail({
      to: email,
      subject: "Приглашение в Schedule Builder",
      text: `Здравствуйте!\n\nВас пригласили в Schedule Builder.\nЗарегистрируйтесь по ссылке: ${registerUrl}\n\nЕсли вы не ожидали это письмо, просто проигнорируйте его.`
    });
  } catch {
    return NextResponse.redirect(toPublicUrl(req, "/app/admin?invite=error"), 303);
  }

  return NextResponse.redirect(toPublicUrl(req, "/app/admin?invite=sent"), 303);
}

