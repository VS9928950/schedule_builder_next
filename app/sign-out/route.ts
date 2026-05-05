import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { toPublicUrl } from "@/lib/public-origin";

async function doLogout(req: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
}

export async function GET(req: Request) {
  return doLogout(req);
}

export async function POST(req: Request) {
  return doLogout(req);
}

