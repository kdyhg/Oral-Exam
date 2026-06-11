import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api";
import { createSessionToken, isValidPin, sessionCookie } from "@/lib/auth";

const schema = z.object({ pin: z.string().min(1).max(100) });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { pin } = schema.parse(await request.json());
    if (!isValidPin(pin)) {
      return NextResponse.json({ error: "PIN이 올바르지 않습니다." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie.name, await createSessionToken(), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "PIN을 입력해 주세요." }, { status: 400 });
    }
    return apiError(error);
  }
}
