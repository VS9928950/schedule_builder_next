import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { toPublicUrl } from "@/lib/public-origin";

export async function POST(req: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(toPublicUrl(req, "/sign-in"), 303);
}

