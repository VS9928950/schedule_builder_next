import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

async function doLogout(req: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/sign-in", req.url), 303);
}

export async function GET(req: Request) {
  return doLogout(req);
}

export async function POST(req: Request) {
  return doLogout(req);
}

