import { NextResponse } from "next/server";

import { sessionCookie } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
