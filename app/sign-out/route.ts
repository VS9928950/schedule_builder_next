import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

function resolvePublicOrigin(req: Request) {
  const fromEnv = (process.env.APP_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

async function doLogout(req: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(`${resolvePublicOrigin(req)}/sign-in`, 303);
}

export async function GET(req: Request) {
  return doLogout(req);
}

export async function POST(req: Request) {
  return doLogout(req);
}

